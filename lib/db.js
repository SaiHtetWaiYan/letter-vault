import mysql from 'mysql2/promise';
import { randomUUID, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const SALT_ROUNDS = 12;
export { bcrypt };

// ── Connection pool ──────────────────────────────────────────────────────────

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: '+00:00',
    });
  }
  return pool;
}

// ── AES-256-GCM encryption ───────────────────────────────────────────────────

function getEncryptionKey() {
  const hex = process.env.LETTER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('LETTER_ENCRYPTION_KEY must be a 64-char hex string.');
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

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createId() {
  return randomUUID();
}

export function parsePasscodes(value) {
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
    base.passcodes = parsePasscodes(row.passcodes);
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

// ── getDb — returns a db-like object compatible with all existing routes ──────

let setupDone = false;

async function ensureSetup() {
  if (setupDone) return;
  setupDone = true;
  await setupDatabase();
}

export async function getDb() {
  await ensureSetup();
  const p = getPool();
  return {
    async get(sql, ...params) {
      const [rows] = await p.execute(sql, params);
      return rows[0];
    },
    async all(sql, ...params) {
      const [rows] = await p.execute(sql, params);
      return rows;
    },
    async run(sql, ...params) {
      const [result] = await p.execute(sql, params);
      return result;
    },
    async exec(sql) {
      await p.query(sql);
    },
  };
}

// ── Schema setup ─────────────────────────────────────────────────────────────

async function setupDatabase() {
  const p = getPool();

  await p.execute(`
    CREATE TABLE IF NOT EXISTS writers (
      id VARCHAR(36) PRIMARY KEY,
      name TEXT NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS recipients (
      id VARCHAR(36) PRIMARY KEY,
      writer_id VARCHAR(36) NOT NULL,
      reader_name VARCHAR(255) NOT NULL,
      passcodes TEXT NOT NULL,
      passcodes_display TEXT,
      is_trusted TINYINT(1) DEFAULT 0,
      UNIQUE KEY unique_writer_reader (writer_id, reader_name),
      FOREIGN KEY (writer_id) REFERENCES writers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS will_sections (
      id VARCHAR(36) PRIMARY KEY,
      writer_id VARCHAR(36) NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      text LONGTEXT NOT NULL,
      attachments LONGTEXT,
      created_at VARCHAR(20) NOT NULL,
      FOREIGN KEY (writer_id) REFERENCES writers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS section_recipients (
      section_id VARCHAR(36) NOT NULL,
      reader_name VARCHAR(255) NOT NULL,
      PRIMARY KEY (section_id, reader_name),
      FOREIGN KEY (section_id) REFERENCES will_sections(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS confirmed_recipients (
      reader_name VARCHAR(255) PRIMARY KEY,
      confirmed_at VARCHAR(50) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[{ count }]] = await p.execute('SELECT COUNT(*) as count FROM writers');
  if (Number(count) === 0) {
    await seedDatabase(p);
  }
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seedDatabase(p) {
  const writerId = createId();
  const hashedPassword = await bcrypt.hash('writer123', SALT_ROUNDS);
  await p.execute(
    'INSERT INTO writers (id, name, email, password) VALUES (?, ?, ?, ?)',
    [writerId, 'James Harlow', 'testator@example.com', hashedPassword],
  );

  const [hAlpha, hBeta, hGamma] = await Promise.all([
    bcrypt.hash('alpha', SALT_ROUNDS),
    bcrypt.hash('beta', SALT_ROUNDS),
    bcrypt.hash('gamma', SALT_ROUNDS),
  ]);

  await p.execute(
    'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted) VALUES (?, ?, ?, ?, ?, ?)',
    [createId(), writerId, 'alice', JSON.stringify([hAlpha]), encrypt(JSON.stringify(['alpha'])), 1],
  );
  await p.execute(
    'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted) VALUES (?, ?, ?, ?, ?, ?)',
    [createId(), writerId, 'bob', JSON.stringify([hBeta]), encrypt(JSON.stringify(['beta'])), 1],
  );
  await p.execute(
    'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted) VALUES (?, ?, ?, ?, ?, ?)',
    [createId(), writerId, 'sarah', JSON.stringify([hGamma]), encrypt(JSON.stringify(['gamma'])), 0],
  );

  // Sections
  const sections = [
    {
      title: 'A Letter to Those I Love',
      summary: 'Personal farewell message.',
      text: `<p>If you are reading this, then the time has come for me to say the things I always meant to say in person but never quite found the courage to.</p><p>Alice — you have been my closest confidant for as long as I can remember. Your steadiness, your honesty, and your quiet kindness have been a gift I never deserved but always treasured. I hope you know that.</p><p>Bob — thank you for every argument, every long drive, every late night where we solved nothing and felt better anyway. You taught me that presence is its own kind of love.</p><p>Do not grieve too long. Live loudly. Look after each other.</p><p>With all my love,<br/><em>James</em></p>`,
      date: '2026-05-01',
      recipients: ['alice', 'bob'],
    },
    {
      title: 'Estate & Financial Instructions',
      summary: 'Property, accounts, and distribution.',
      text: `<h2>Property</h2><p>The house at 14 Elmwood Drive is to be sold within 12 months of my passing. Proceeds should be split equally between Alice and Bob after all outstanding mortgage payments are settled.</p><h2>Bank Accounts</h2><p>My primary account at First National Bank (account ending 4821) should be used first to settle any outstanding debts, funeral expenses, and legal fees. The remaining balance is to be distributed as follows:</p><ul><li>Alice Harlow — 40%</li><li>Bob Harlow — 40%</li><li>Sarah Kendall — 20%</li></ul><h2>Investment Portfolio</h2><p>My brokerage account (reference: JH-992-X) is managed by Vantage Wealth. Contact them at the earliest opportunity. Alice has power of attorney and should handle the transfer process.</p>`,
      date: '2026-05-02',
      recipients: ['alice', 'bob'],
    },
    {
      title: 'For Sarah',
      summary: 'Private message for Sarah.',
      text: `<p>Sarah,</p><p>I have always admired the way you move through the world — with grace and without apology. You reminded me that it is possible to be both gentle and fierce at the same time.</p><p>I have left a small sum for you. It is not meant to solve anything, only to give you a little breathing room to do something you have been putting off. You know what it is.</p><p>The blue ceramic bowl on the kitchen shelf was my mother's. I would like you to have it.</p><p>Take care of yourself first. Always.</p><p><em>James</em></p>`,
      date: '2026-05-03',
      recipients: ['alice', 'bob', 'sarah'],
    },
    {
      title: 'Funeral & Memorial Wishes',
      summary: 'Practical arrangements.',
      text: `<h2>Arrangements</h2><p>I would prefer a simple, private ceremony. No more than thirty people. Outdoors if the weather allows — the garden at Elmwood, or the park where we used to walk on Sunday mornings.</p><h2>Music</h2><p>Please play <em>Clair de Lune</em> by Debussy. If that feels too heavy, anything by Bill Evans will do. No hymns, please.</p><h2>After</h2><p>I would like my ashes scattered at the coast — somewhere with a wide horizon. Alice will know the place.</p><p>Do not let the day be solemn for too long. Share a meal. Open a good bottle. Tell embarrassing stories. That is how I would like to be remembered.</p>`,
      date: '2026-05-04',
      recipients: ['alice'],
    },
  ];

  for (const section of sections) {
    const sectionId = createId();
    await p.execute(
      'INSERT INTO will_sections (id, writer_id, title, summary, text, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sectionId, writerId, section.title, section.summary, encrypt(section.text), encrypt(JSON.stringify([])), section.date],
    );
    for (const reader of section.recipients) {
      await p.execute('INSERT INTO section_recipients (section_id, reader_name) VALUES (?, ?)', [sectionId, reader]);
    }
  }
}

// ── Public data functions ─────────────────────────────────────────────────────

export async function getAllRecipients() {
  await ensureSetup();
  const [rows] = await getPool().execute('SELECT * FROM recipients ORDER BY lower(reader_name)');
  return rows.map((row) => rowToRecipient(row, false));
}

export async function getWriterData(writerId) {
  await ensureSetup();
  const p = getPool();

  const [recipients] = await p.execute(
    'SELECT * FROM recipients WHERE writer_id = ? ORDER BY lower(reader_name)',
    [writerId],
  );
  const [sections] = await p.execute(
    'SELECT * FROM will_sections WHERE writer_id = ? ORDER BY created_at DESC',
    [writerId],
  );

  const posts = [];
  for (const section of sections) {
    const [requiredRows] = await p.execute(
      'SELECT reader_name FROM section_recipients WHERE section_id = ? ORDER BY lower(reader_name)',
      [section.id],
    );
    posts.push({
      id: section.id,
      writerId: section.writer_id,
      readerNames: requiredRows.map((r) => r.reader_name),
      title: section.title,
      summary: section.summary,
      text: decrypt(section.text),
      attachments: JSON.parse(decrypt(section.attachments) || '[]'),
      createdAt: section.created_at,
    });
  }

  const [confirmedRows] = await p.execute(
    `SELECT cr.reader_name
     FROM confirmed_recipients cr
     JOIN recipients r ON lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ?
     ORDER BY lower(cr.reader_name)`,
    [writerId],
  );

  const [trustedRows] = await p.execute(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    [writerId],
  );

  return {
    readers: recipients.map((row) => rowToRecipient(row, true)),
    posts,
    confirmedReaders: confirmedRows.map((r) => r.reader_name),
    trustedReaders: trustedRows.map((r) => r.reader_name),
  };
}

export async function getRecipientSections(readerName) {
  await ensureSetup();
  const p = getPool();

  const [sections] = await p.execute(
    `SELECT DISTINCT ws.*
     FROM will_sections ws
     JOIN section_recipients sr ON sr.section_id = ws.id
     WHERE lower(sr.reader_name) = lower(?)
     ORDER BY ws.created_at DESC`,
    [readerName],
  );

  const posts = [];
  for (const section of sections) {
    const [requiredRows] = await p.execute(
      'SELECT reader_name FROM section_recipients WHERE section_id = ? ORDER BY lower(reader_name)',
      [section.id],
    );
    posts.push({
      id: section.id,
      writerId: section.writer_id,
      readerNames: requiredRows.map((r) => r.reader_name),
      title: section.title,
      summary: section.summary,
      text: decrypt(section.text),
      attachments: JSON.parse(decrypt(section.attachments) || '[]'),
      createdAt: section.created_at,
    });
  }

  const [[recipient]] = await p.execute(
    'SELECT writer_id FROM recipients WHERE lower(reader_name) = lower(?)',
    [readerName],
  );
  const writerId = recipient?.writer_id ?? null;

  const [confirmedRows] = await p.execute(
    `SELECT cr.reader_name
     FROM confirmed_recipients cr
     JOIN recipients r ON lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ?
     ORDER BY lower(cr.reader_name)`,
    [writerId],
  );

  const [trustedRows] = await p.execute(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    [writerId],
  );

  return {
    posts,
    confirmedReaders: confirmedRows.map((r) => r.reader_name),
    trustedReaders: trustedRows.map((r) => r.reader_name),
  };
}
