import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { randomUUID, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// ── AES-256-GCM encryption ───────────────────────────────────────────────────

function getEncryptionKey() {
  const hex = process.env.LETTER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('LETTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate one with: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')"');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12) + tag(16) + ciphertext — all hex-encoded with a prefix marker
  return 'enc:' + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(value) {
  if (!value || !value.startsWith('enc:')) return value;
  const key = getEncryptionKey();
  const buf = Buffer.from(value.slice(4), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'lastwill.sqlite');

let dbPromise;

function createId() {
  return randomUUID();
}

function parsePasscodes(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function rowToRecipient(row, includePasscodes = false) {
  const base = {
    id: row.id,
    writerId: row.writer_id,
    readerName: row.reader_name,
    passcodeCount: parsePasscodes(row.passcodes).length,
    isTrusted: Boolean(row.is_trusted),
  };
  if (includePasscodes) {
    // passcodes = bcrypt hashes (for verification)
    base.passcodes = parsePasscodes(row.passcodes);
    // passcodes_display = AES-decrypted originals (for writer UI only)
    try {
      base.passcodesDisplay = row.passcodes_display
        ? JSON.parse(decrypt(row.passcodes_display))
        : [];
    } catch {
      base.passcodesDisplay = [];
    }
  }
  return base;
}

async function setupDatabase() {
  await mkdir(dataDir, { recursive: true });
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS writers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY,
      writer_id TEXT NOT NULL,
      reader_name TEXT NOT NULL,
      passcodes TEXT NOT NULL,
      passcodes_display TEXT,
      is_trusted INTEGER DEFAULT 0,
      UNIQUE(writer_id, reader_name),
      FOREIGN KEY(writer_id) REFERENCES writers(id)
    );

    CREATE TABLE IF NOT EXISTS will_sections (
      id TEXT PRIMARY KEY,
      writer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      text TEXT NOT NULL,
      attachments TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(writer_id) REFERENCES writers(id)
    );

    CREATE TABLE IF NOT EXISTS section_recipients (
      section_id TEXT NOT NULL,
      reader_name TEXT NOT NULL,
      PRIMARY KEY(section_id, reader_name),
      FOREIGN KEY(section_id) REFERENCES will_sections(id)
    );

    CREATE TABLE IF NOT EXISTS confirmed_recipients (
      reader_name TEXT PRIMARY KEY,
      confirmed_at TEXT NOT NULL
    );
  `);

  try {
    await db.exec('ALTER TABLE will_sections ADD COLUMN attachments TEXT');
  } catch (e) {
    // Column already exists or table is being created fresh
  }

  try {
    await db.exec('ALTER TABLE recipients ADD COLUMN is_trusted INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists or table is being created fresh
  }

  try {
    await db.exec('ALTER TABLE recipients ADD COLUMN passcodes_display TEXT');
  } catch (e) {
    // Column already exists or table is being created fresh
  }

  const writerCount = await db.get('SELECT COUNT(*) as count FROM writers');
  if (writerCount.count === 0) {
    await seedDatabase(db);
  }

  return db;
}

async function seedDatabase(db) {
  const writerId = createId();
  const hashedPassword = await bcrypt.hash('writer123', SALT_ROUNDS);
  await db.run(
    'INSERT INTO writers (id, name, email, password) VALUES (?, ?, ?, ?)',
    writerId, 'James Harlow', 'testator@example.com', hashedPassword,
  );

  // Recipients
  const [hAlpha, hBeta, hGamma] = await Promise.all([
    bcrypt.hash('alpha', SALT_ROUNDS),
    bcrypt.hash('beta', SALT_ROUNDS),
    bcrypt.hash('gamma', SALT_ROUNDS),
  ]);

  // Alice — trusted keyholder
  await db.run(
    'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted) VALUES (?, ?, ?, ?, ?, ?)',
    createId(), writerId, 'alice', JSON.stringify([hAlpha]), encrypt(JSON.stringify(['alpha'])), 1,
  );
  // Bob — trusted keyholder
  await db.run(
    'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted) VALUES (?, ?, ?, ?, ?, ?)',
    createId(), writerId, 'bob', JSON.stringify([hBeta]), encrypt(JSON.stringify(['beta'])), 1,
  );
  // Sarah — beneficiary
  await db.run(
    'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted) VALUES (?, ?, ?, ?, ?, ?)',
    createId(), writerId, 'sarah', JSON.stringify([hGamma]), encrypt(JSON.stringify(['gamma'])), 0,
  );

  // ── Section 1: Personal Letter (alice + bob must unlock) ─────────────────
  const personalId = createId();
  await db.run(
    'INSERT INTO will_sections (id, writer_id, title, summary, text, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    personalId, writerId,
    'A Letter to Those I Love',
    'Personal farewell message.',
    encrypt(`<p>If you are reading this, then the time has come for me to say the things I always meant to say in person but never quite found the courage to.</p>

<p>Alice — you have been my closest confidant for as long as I can remember. Your steadiness, your honesty, and your quiet kindness have been a gift I never deserved but always treasured. I hope you know that.</p>

<p>Bob — thank you for every argument, every long drive, every late night where we solved nothing and felt better anyway. You taught me that presence is its own kind of love.</p>

<p>Do not grieve too long. Live loudly. Look after each other.</p>

<p>With all my love,<br/><em>James</em></p>`),
    encrypt(JSON.stringify([])),
    '2026-05-01',
  );
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', personalId, 'alice');
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', personalId, 'bob');

  // ── Section 2: Estate & Assets (alice + bob must unlock) ─────────────────
  const assetsId = createId();
  await db.run(
    'INSERT INTO will_sections (id, writer_id, title, summary, text, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    assetsId, writerId,
    'Estate & Financial Instructions',
    'Property, accounts, and distribution.',
    encrypt(`<h2>Property</h2>
<p>The house at 14 Elmwood Drive is to be sold within 12 months of my passing. Proceeds should be split equally between Alice and Bob after all outstanding mortgage payments are settled.</p>

<h2>Bank Accounts</h2>
<p>My primary account at First National Bank (account ending 4821) should be used first to settle any outstanding debts, funeral expenses, and legal fees. The remaining balance is to be distributed as follows:</p>
<ul>
  <li>Alice Harlow — 40%</li>
  <li>Bob Harlow — 40%</li>
  <li>Sarah Kendall — 20%</li>
</ul>

<h2>Investment Portfolio</h2>
<p>My brokerage account (reference: JH-992-X) is managed by Vantage Wealth. Contact them at the earliest opportunity. Alice has power of attorney and should handle the transfer process.</p>

<h2>Digital Assets</h2>
<p>Access credentials for all digital accounts are stored in the encrypted vault described in the separate Technology section. Bob holds the master passphrase.</p>`),
    encrypt(JSON.stringify([])),
    '2026-05-02',
  );
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', assetsId, 'alice');
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', assetsId, 'bob');

  // ── Section 3: Message for Sarah (alice + bob unlock, sarah reads) ────────
  const sarahId = createId();
  await db.run(
    'INSERT INTO will_sections (id, writer_id, title, summary, text, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sarahId, writerId,
    'For Sarah',
    'Private message for Sarah.',
    encrypt(`<p>Sarah,</p>

<p>I have always admired the way you move through the world — with grace and without apology. You reminded me that it is possible to be both gentle and fierce at the same time.</p>

<p>I have left a small sum for you. It is not meant to solve anything, only to give you a little breathing room to do something you have been putting off. You know what it is.</p>

<p>The blue ceramic bowl on the kitchen shelf was my mother's. I would like you to have it.</p>

<p>Take care of yourself first. Always.</p>

<p><em>James</em></p>`),
    encrypt(JSON.stringify([])),
    '2026-05-03',
  );
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', sarahId, 'alice');
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', sarahId, 'bob');
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', sarahId, 'sarah');

  // ── Section 4: Funeral Wishes (alice only) ────────────────────────────────
  const funeralId = createId();
  await db.run(
    'INSERT INTO will_sections (id, writer_id, title, summary, text, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    funeralId, writerId,
    'Funeral & Memorial Wishes',
    'Practical arrangements.',
    encrypt(`<h2>Arrangements</h2>
<p>I would prefer a simple, private ceremony. No more than thirty people. Outdoors if the weather allows — the garden at Elmwood, or the park where we used to walk on Sunday mornings.</p>

<h2>Music</h2>
<p>Please play <em>Clair de Lune</em> by Debussy. If that feels too heavy, anything by Bill Evans will do. No hymns, please.</p>

<h2>Readings</h2>
<p>If anyone wishes to speak, I ask only that they keep it honest. I was not perfect. No need to pretend otherwise.</p>

<h2>After</h2>
<p>I would like my ashes scattered at the coast — somewhere with a wide horizon. Alice will know the place.</p>

<h2>A Note</h2>
<p>Do not let the day be solemn for too long. Share a meal. Open a good bottle. Tell embarrassing stories. That is how I would like to be remembered.</p>`),
    encrypt(JSON.stringify([])),
    '2026-05-04',
  );
  await db.run('INSERT INTO section_recipients VALUES (?, ?)', funeralId, 'alice');
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = setupDatabase();
  }

  return dbPromise;
}

export async function getAllRecipients() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM recipients ORDER BY lower(reader_name)');
  return rows.map((row) => rowToRecipient(row, false));
}

export async function getWriterData(writerId) {
  const db = await getDb();
  const recipients = await db.all(
    'SELECT * FROM recipients WHERE writer_id = ? ORDER BY lower(reader_name)',
    writerId,
  );
  const sections = await db.all(
    'SELECT * FROM will_sections WHERE writer_id = ? ORDER BY created_at DESC',
    writerId,
  );

  const posts = [];
  for (const section of sections) {
    const requiredRows = await db.all(
      'SELECT reader_name FROM section_recipients WHERE section_id = ? ORDER BY lower(reader_name)',
      section.id,
    );
    posts.push({
      id: section.id,
      writerId: section.writer_id,
      readerNames: requiredRows.map((row) => row.reader_name),
      title: section.title,
      summary: section.summary,
      text: decrypt(section.text),
      attachments: JSON.parse(decrypt(section.attachments) || '[]'),
      createdAt: section.created_at,
    });
  }

  const confirmedRows = await db.all(
    `SELECT cr.reader_name
     FROM confirmed_recipients cr
     JOIN recipients r ON lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ?
     ORDER BY lower(cr.reader_name)`,
    writerId,
  );

  const trustedRows = await db.all(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    writerId,
  );

  return {
    readers: recipients.map((row) => rowToRecipient(row, true)),
    posts,
    confirmedReaders: confirmedRows.map((row) => row.reader_name),
    trustedReaders: trustedRows.map((row) => row.reader_name),
  };
}

export async function getRecipientSections(readerName) {
  const db = await getDb();
  const sections = await db.all(
    `SELECT DISTINCT ws.*
     FROM will_sections ws
     JOIN section_recipients sr ON sr.section_id = ws.id
     WHERE lower(sr.reader_name) = lower(?)
     ORDER BY ws.created_at DESC`,
    readerName,
  );

  const posts = [];
  for (const section of sections) {
    const requiredRows = await db.all(
      'SELECT reader_name FROM section_recipients WHERE section_id = ? ORDER BY lower(reader_name)',
      section.id,
    );
    posts.push({
      id: section.id,
      writerId: section.writer_id,
      readerNames: requiredRows.map((row) => row.reader_name),
      title: section.title,
      summary: section.summary,
      text: decrypt(section.text),
      attachments: JSON.parse(decrypt(section.attachments) || '[]'),
      createdAt: section.created_at,
    });
  }

  const recipient = await db.get(
    'SELECT writer_id FROM recipients WHERE lower(reader_name) = lower(?)',
    readerName,
  );
  const writerId = recipient ? recipient.writer_id : null;

  const confirmedRows = await db.all(
    `SELECT cr.reader_name 
     FROM confirmed_recipients cr
     JOIN recipients r ON lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ?
     ORDER BY lower(cr.reader_name)`,
    writerId,
  );

  const trustedRows = await db.all(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    writerId,
  );

  return {
    posts,
    confirmedReaders: confirmedRows.map((row) => row.reader_name),
    trustedReaders: trustedRows.map((row) => row.reader_name),
  };
}

export { createId, parsePasscodes, bcrypt, SALT_ROUNDS };
