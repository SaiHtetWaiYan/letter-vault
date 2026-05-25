import mysql from 'mysql2/promise';
import { randomUUID, createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sanitizeHtml } from './sanitize.js';

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

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
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
    email: row.email || null,
  };
  if (includePasscodes) {
    base.passcodeCount = parsePasscodes(row.passcodes).length;
  }
  return base;
}

// ── getDb — returns a db-like object compatible with all existing routes ──────

let setupPromise = null;

async function ensureSetup() {
  if (!setupPromise) {
    setupPromise = setupDatabase().catch((err) => {
      setupPromise = null; // allow retry if setup failed
      throw err;
    });
  }
  return setupPromise;
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
      password TEXT NOT NULL,
      unlock_threshold INT NULL,
      inactivity_days INT NOT NULL DEFAULT 90,
      grace_days INT NOT NULL DEFAULT 30,
      keyholder_grace_days INT NOT NULL DEFAULT 14,
      last_active_at DATETIME NULL,
      warning_sent_at DATETIME NULL,
      dmz_unlocked_at DATETIME NULL,
      keyholders_notified_at DATETIME NULL,
      force_unlocked TINYINT(1) NOT NULL DEFAULT 0,
      heartbeat_token VARCHAR(36) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: add any missing columns to existing writers table
  const [existingCols] = await p.execute(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'writers'`,
  );
  const existing = new Set(existingCols.map((r) => r.COLUMN_NAME));
  const migrations = [
    ['unlock_threshold',    'INT NULL'],
    ['inactivity_days',     'INT NOT NULL DEFAULT 90'],
    ['grace_days',          'INT NOT NULL DEFAULT 30'],
    ['keyholder_grace_days','INT NOT NULL DEFAULT 14'],
    ['last_active_at',      'DATETIME NULL'],
    ['warning_sent_at',     'DATETIME NULL'],
    ['dmz_unlocked_at',     'DATETIME NULL'],
    ['keyholders_notified_at', 'DATETIME NULL'],
    ['force_unlocked',      'TINYINT(1) NOT NULL DEFAULT 0'],
    ['heartbeat_token',     'VARCHAR(64) NULL'],
    ['email_verified',          'TINYINT(1) NOT NULL DEFAULT 0'],
    ['verification_token',      'VARCHAR(64) NULL'],
    ['verification_token_expires_at', 'DATETIME NULL'],
    ['reset_token',             'VARCHAR(64) NULL'],
    ['reset_token_expires_at',  'DATETIME NULL'],
  ];
  for (const [col, def] of migrations) {
    if (!existing.has(col)) {
      await p.execute(`ALTER TABLE writers ADD COLUMN ${col} ${def}`);
    }
  }
  if (existing.has('heartbeat_token')) {
    const heartbeatCol = existingCols.find((r) => r.COLUMN_NAME === 'heartbeat_token');
    if (Number(heartbeatCol.CHARACTER_MAXIMUM_LENGTH || 0) < 64) {
      await p.execute('ALTER TABLE writers MODIFY heartbeat_token VARCHAR(64) NULL');
    }
  }
  for (const col of ['verification_token', 'reset_token']) {
    if (existing.has(col)) {
      const tokenCol = existingCols.find((r) => r.COLUMN_NAME === col);
      if (Number(tokenCol.CHARACTER_MAXIMUM_LENGTH || 0) < 64) {
        await p.execute(`ALTER TABLE writers MODIFY ${col} VARCHAR(64) NULL`);
      }
    }
  }

  await p.execute(`
    CREATE TABLE IF NOT EXISTS recipients (
      id VARCHAR(36) PRIMARY KEY,
      writer_id VARCHAR(36) NOT NULL,
      reader_name VARCHAR(255) NOT NULL,
      passcodes TEXT NOT NULL,
      passcodes_display TEXT,
      is_trusted TINYINT(1) DEFAULT 0,
      email VARCHAR(255) NULL,
      UNIQUE KEY unique_writer_reader (writer_id, reader_name),
      FOREIGN KEY (writer_id) REFERENCES writers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: add email to existing recipients table if missing
  const [rCols] = await p.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recipients' AND COLUMN_NAME = 'email'`,
  );
  if (rCols.length === 0) {
    await p.execute('ALTER TABLE recipients ADD COLUMN email VARCHAR(255) NULL');
  }

  await p.execute(`
    CREATE TABLE IF NOT EXISTS will_sections (
      id VARCHAR(36) PRIMARY KEY,
      writer_id VARCHAR(36) NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      text LONGTEXT NOT NULL,
      attachments LONGTEXT,
      created_at VARCHAR(20) NOT NULL,
      release_date DATE NULL,
      release_delay_days INT NULL,
      released_at DATETIME NULL,
      FOREIGN KEY (writer_id) REFERENCES writers(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migration: add release columns to existing will_sections table
  const [sCols] = await p.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'will_sections'`,
  );
  const existingS = new Set(sCols.map((r) => r.COLUMN_NAME));
  for (const [col, def] of [
    ['release_date',       'DATE NULL'],
    ['release_delay_days', 'INT NULL'],
    ['released_at',        'DATETIME NULL'],
  ]) {
    if (!existingS.has(col)) {
      await p.execute(`ALTER TABLE will_sections ADD COLUMN ${col} ${def}`);
    }
  }

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
      writer_id VARCHAR(36) NOT NULL,
      reader_name VARCHAR(255) NOT NULL,
      recipient_id VARCHAR(36) NULL,
      confirmed_at VARCHAR(50) NOT NULL,
      PRIMARY KEY (writer_id, reader_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await migrateConfirmedRecipients(p);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket_key VARCHAR(255) PRIMARY KEY,
      attempt_count INT NOT NULL,
      reset_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[{ count }]] = await p.execute('SELECT COUNT(*) as count FROM writers');
  if (Number(count) === 0 && process.env.SEED_DEMO_DATA === 'true') {
    await seedDatabase(p);
  }
}

async function migrateConfirmedRecipients(p) {
  const [cols] = await p.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'confirmed_recipients'`,
  );
  const existing = new Set(cols.map((r) => r.COLUMN_NAME));

  if (!existing.has('writer_id')) {
    await p.execute('ALTER TABLE confirmed_recipients ADD COLUMN writer_id VARCHAR(36) NULL FIRST');
    await p.execute(`
      UPDATE confirmed_recipients cr
      JOIN recipients r ON lower(r.reader_name) = lower(cr.reader_name)
      SET cr.writer_id = r.writer_id
      WHERE cr.writer_id IS NULL
    `);
    await p.execute('DELETE FROM confirmed_recipients WHERE writer_id IS NULL');
  }

  if (!existing.has('recipient_id')) {
    await p.execute('ALTER TABLE confirmed_recipients ADD COLUMN recipient_id VARCHAR(36) NULL AFTER reader_name');
    await p.execute(`
      UPDATE confirmed_recipients cr
      JOIN recipients r ON r.writer_id = cr.writer_id AND lower(r.reader_name) = lower(cr.reader_name)
      SET cr.recipient_id = r.id
      WHERE cr.recipient_id IS NULL
    `);
  }

  const [keyRows] = await p.execute(
    `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'confirmed_recipients'
       AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
  );
  const primaryKey = keyRows.map((r) => r.COLUMN_NAME).join(',');
  if (primaryKey !== 'writer_id,reader_name') {
    await p.execute('ALTER TABLE confirmed_recipients MODIFY writer_id VARCHAR(36) NOT NULL');
    await p.execute('ALTER TABLE confirmed_recipients DROP PRIMARY KEY');
    await p.execute('ALTER TABLE confirmed_recipients ADD PRIMARY KEY (writer_id, reader_name)');
  }
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seedDatabase(p) {
  const writerId = createId();
  const hashedPassword = await bcrypt.hash('writer123', SALT_ROUNDS);
  await p.execute(
    'INSERT INTO writers (id, name, email, password, email_verified) VALUES (?, ?, ?, ?, 1)',
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
  const byName = new Map();
  for (const row of rows) {
    const key = row.reader_name.toLowerCase();
    const passcodeCount = parsePasscodes(row.passcodes).length;
    const existing = byName.get(key);
    if (!existing || passcodeCount > existing.passcodeCount) {
      byName.set(key, { readerName: row.reader_name, passcodeCount });
    }
  }
  return [...byName.values()].sort((a, b) => a.readerName.localeCompare(b.readerName));
}

export async function findRecipientByPasscodes(readerName, submittedPasscodes) {
  await ensureSetup();
  const p = getPool();
  const cleanPasscodes = Array.isArray(submittedPasscodes)
    ? submittedPasscodes.map((pcode) => String(pcode || '')).filter(Boolean)
    : [];
  const [recipients] = await p.execute(
    'SELECT * FROM recipients WHERE lower(reader_name) = lower(?)',
    [readerName || ''],
  );

  const matches = [];
  for (const recipient of recipients) {
    const hashes = parsePasscodes(recipient.passcodes);
    const allPassed = await Promise.all(
      hashes.map((hash) =>
        Promise.any(cleanPasscodes.map((pcode) => bcrypt.compare(pcode, hash))).catch(() => false),
      ),
    );
    if (!allPassed.includes(false)) {
      matches.push(recipient);
    }
  }

  if (matches.length !== 1) return { matches };
  return { recipient: matches[0], matches };
}

export async function confirmRecipient(recipient) {
  await ensureSetup();
  await getPool().execute(
    `INSERT INTO confirmed_recipients (writer_id, reader_name, recipient_id, confirmed_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE recipient_id = VALUES(recipient_id), confirmed_at = VALUES(confirmed_at)`,
    [recipient.writer_id, recipient.reader_name, recipient.id, new Date().toISOString()],
  );
}

export async function clearWriterConfirmations(writerId) {
  await ensureSetup();
  await getPool().execute('DELETE FROM confirmed_recipients WHERE writer_id = ?', [writerId]);
}

// Majority of trusted keyholders, rounded up. Falls back to 1 so a vault with
// at least one keyholder is never permanently sealed.
function defaultThreshold(trustedCount) {
  if (trustedCount <= 0) return 0;
  return Math.ceil(trustedCount / 2);
}

function resolveThreshold(stored, trustedCount) {
  if (trustedCount <= 0) return 0;
  if (stored == null) return defaultThreshold(trustedCount);
  return Math.min(Math.max(1, Number(stored)), trustedCount);
}

export async function getWriterData(writerId) {
  await ensureSetup();
  const p = getPool();

  const [[writer]] = await p.execute(
    'SELECT unlock_threshold, inactivity_days, grace_days, keyholder_grace_days, last_active_at, warning_sent_at, dmz_unlocked_at, keyholders_notified_at FROM writers WHERE id = ?',
    [writerId],
  );

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
      text: sanitizeHtml(decrypt(section.text)),
      attachments: JSON.parse(decrypt(section.attachments) || '[]'),
      createdAt: section.created_at,
      releaseDate: section.release_date ? section.release_date.toISOString?.().slice(0,10) ?? String(section.release_date).slice(0,10) : null,
      releaseDelayDays: section.release_delay_days ?? null,
      releasedAt: section.released_at ?? null,
    });
  }

  const [confirmedRows] = await p.execute(
    `SELECT cr.reader_name
     FROM confirmed_recipients cr
     JOIN recipients r ON r.writer_id = cr.writer_id AND lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ?
     ORDER BY lower(cr.reader_name)`,
    [writerId],
  );

  const [trustedRows] = await p.execute(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    [writerId],
  );

  const trustedReaders = trustedRows.map((r) => r.reader_name);
  const unlockThreshold = resolveThreshold(writer?.unlock_threshold, trustedReaders.length);

  return {
    readers: recipients.map((row) => rowToRecipient(row, true)),
    posts,
    confirmedReaders: confirmedRows.map((r) => r.reader_name),
    trustedReaders,
    unlockThreshold,
    storedUnlockThreshold: writer?.unlock_threshold ?? null,
    dms: {
      inactivityDays: writer?.inactivity_days ?? 90,
      graceDays: writer?.grace_days ?? 30,
      keyholderGraceDays: writer?.keyholder_grace_days ?? 14,
      lastActiveAt: writer?.last_active_at ?? null,
      warningSentAt: writer?.warning_sent_at ?? null,
      dmzUnlockedAt: writer?.dmz_unlocked_at ?? null,
      keyholdersNotifiedAt: writer?.keyholders_notified_at ?? null,
    },
  };
}

export async function getRecipientSections(readerName, writerId) {
  await ensureSetup();
  const p = getPool();

  const [sections] = await p.execute(
    `SELECT DISTINCT ws.*
     FROM will_sections ws
     JOIN section_recipients sr ON sr.section_id = ws.id
     WHERE lower(sr.reader_name) = lower(?)
       AND ws.writer_id = ?
     ORDER BY ws.created_at DESC`,
    [readerName, writerId],
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
      text: sanitizeHtml(decrypt(section.text)),
      attachments: JSON.parse(decrypt(section.attachments) || '[]'),
      createdAt: section.created_at,
      releaseDate: section.release_date ? section.release_date.toISOString?.().slice(0,10) ?? String(section.release_date).slice(0,10) : null,
      releaseDelayDays: section.release_delay_days ?? null,
      releasedAt: section.released_at ?? null,
    });
  }

  const [confirmedRows] = await p.execute(
    `SELECT cr.reader_name
     FROM confirmed_recipients cr
     JOIN recipients r ON r.writer_id = cr.writer_id AND lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ?
     ORDER BY lower(cr.reader_name)`,
    [writerId],
  );

  const [trustedRows] = await p.execute(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    [writerId],
  );

  const [[writer]] = await p.execute(
    'SELECT unlock_threshold, dmz_unlocked_at FROM writers WHERE id = ?',
    [writerId],
  );
  const trustedReaders = trustedRows.map((r) => r.reader_name);
  const unlockThreshold = resolveThreshold(writer?.unlock_threshold, trustedReaders.length);

  return {
    posts,
    confirmedReaders: confirmedRows.map((r) => r.reader_name),
    trustedReaders,
    unlockThreshold,
    dmzUnlocked: writer?.dmz_unlocked_at != null,
  };
}

export async function setUnlockThreshold(writerId, value) {
  await ensureSetup();
  const p = getPool();
  const normalized = value == null ? null : Math.max(1, Math.floor(Number(value)));
  await p.execute('UPDATE writers SET unlock_threshold = ? WHERE id = ?', [normalized, writerId]);
}

export async function touchLastActive(writerId) {
  await ensureSetup();
  const p = getPool();
  // Also generate a heartbeat_token if missing
  await p.execute(
    'UPDATE writers SET last_active_at = NOW(), warning_sent_at = NULL WHERE id = ?',
    [writerId],
  );
}

export async function createHeartbeatToken(writerId) {
  await ensureSetup();
  const token = randomUUID();
  await getPool().execute(
    'UPDATE writers SET heartbeat_token = ? WHERE id = ?',
    [hashToken(token), writerId],
  );
  return token;
}

export async function setDmsConfig(writerId, { inactivityDays, graceDays, keyholderGraceDays }) {
  await ensureSetup();
  const p = getPool();
  await p.execute(
    'UPDATE writers SET inactivity_days = ?, grace_days = ?, keyholder_grace_days = ? WHERE id = ?',
    [
      Math.max(1, Math.floor(inactivityDays)),
      Math.max(1, Math.floor(graceDays)),
      Math.max(1, Math.floor(keyholderGraceDays ?? 14)),
      writerId,
    ],
  );
}

// ── Unlock notifications ─────────────────────────────────────────────────────

// Returns all recipients (with email) for a writer — used to notify on unlock
export async function getWriterRecipients(writerId) {
  await ensureSetup();
  const p = getPool();
  const [rows] = await p.execute(
    'SELECT reader_name, email, is_trusted FROM recipients WHERE writer_id = ?',
    [writerId],
  );
  return rows.map((r) => ({ readerName: r.reader_name, email: r.email || null, isTrusted: Boolean(r.is_trusted) }));
}

// Check vault unlock status — returns { isUnlocked, confirmedTrustedCount, threshold }
export async function getVaultUnlockStatus(writerId) {
  await ensureSetup();
  const p = getPool();

  const [[writer]] = await p.execute(
    'SELECT unlock_threshold, dmz_unlocked_at, force_unlocked FROM writers WHERE id = ?',
    [writerId],
  );
  const dmzFired = writer?.dmz_unlocked_at != null;
  const forced = Boolean(writer?.force_unlocked);

  const [trustedRows] = await p.execute(
    'SELECT reader_name FROM recipients WHERE is_trusted = 1 AND writer_id = ?',
    [writerId],
  );
  const [confirmedRows] = await p.execute(
    `SELECT cr.reader_name FROM confirmed_recipients cr
     JOIN recipients r ON r.writer_id = cr.writer_id AND lower(r.reader_name) = lower(cr.reader_name)
     WHERE r.writer_id = ? AND r.is_trusted = 1`,
    [writerId],
  );

  const trustedCount = trustedRows.length;
  const confirmedTrustedCount = confirmedRows.length;
  const threshold = resolveThreshold(writer?.unlock_threshold, trustedCount);
  const thresholdMet = trustedCount > 0 && confirmedTrustedCount >= threshold;

  // Vault unlocks when:
  // - force_unlocked flag is set (keyholder grace period expired), OR
  // - DMS fired AND (no keyholders OR threshold met)
  const isUnlocked = forced || (
    trustedCount === 0
      ? dmzFired
      : dmzFired && thresholdMet
  );

  return { isUnlocked, confirmedTrustedCount, threshold };
}

// Called by cron — returns all writers needing a warning or auto-unlock
export async function getDmsCheckList() {
  await ensureSetup();
  const p = getPool();
  const [rows] = await p.execute(
    `SELECT w.id, w.name, w.email,
            w.inactivity_days, w.grace_days, w.keyholder_grace_days,
            w.last_active_at, w.warning_sent_at,
            w.dmz_unlocked_at, w.keyholders_notified_at
     FROM writers w
     WHERE w.dmz_unlocked_at IS NULL OR w.keyholders_notified_at IS NOT NULL`,
  );
  return rows;
}

export async function markWarningSent(writerId) {
  await ensureSetup();
  const p = getPool();
  await p.execute('UPDATE writers SET warning_sent_at = NOW() WHERE id = ?', [writerId]);
}

export async function markKeyholdersNotified(writerId) {
  await ensureSetup();
  const p = getPool();
  await p.execute('UPDATE writers SET keyholders_notified_at = NOW() WHERE id = ?', [writerId]);
}

export async function clearKeyholdersNotified(writerId) {
  await ensureSetup();
  const p = getPool();
  await p.execute('UPDATE writers SET keyholders_notified_at = NULL WHERE id = ?', [writerId]);
}

// Force unlock — used when keyholder grace period expires without confirmations
export async function forceUnlock(writerId) {
  await ensureSetup();
  const p = getPool();
  await p.execute('UPDATE writers SET force_unlocked = 1 WHERE id = ?', [writerId]);
}

export async function markDmzUnlocked(writerId) {
  await ensureSetup();
  const p = getPool();
  await p.execute('UPDATE writers SET dmz_unlocked_at = NOW() WHERE id = ?', [writerId]);
}

// Count trusted keyholders for a writer
export async function getTrustedCount(writerId) {
  await ensureSetup();
  const p = getPool();
  const [[row]] = await p.execute(
    'SELECT COUNT(*) AS n FROM recipients WHERE writer_id = ? AND is_trusted = 1',
    [writerId],
  );
  return Number(row?.n ?? 0);
}


export async function createVerificationToken(writerId) {
  await ensureSetup();
  const token = randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await getPool().execute(
    'UPDATE writers SET verification_token = ?, verification_token_expires_at = ?, email_verified = 0 WHERE id = ?',
    [hashToken(token), expires, writerId],
  );
  return token;
}

export async function verifyEmailToken(token) {
  await ensureSetup();
  const p = getPool();
  const [[writer]] = await p.execute(
    'SELECT id, name, email_verified, verification_token_expires_at FROM writers WHERE verification_token = ?',
    [hashToken(token)],
  );
  if (!writer) return null;
  if (writer.email_verified) return { alreadyVerified: true, name: writer.name };
  if (writer.verification_token_expires_at && new Date(writer.verification_token_expires_at) < new Date()) {
    return null;
  }
  await p.execute(
    'UPDATE writers SET email_verified = 1, verification_token = NULL, verification_token_expires_at = NULL WHERE id = ?',
    [writer.id],
  );
  return { ok: true, name: writer.name };
}

export async function getUnverifiedWriterByEmail(email) {
  await ensureSetup();
  const [[writer]] = await getPool().execute(
    'SELECT id, name, email, email_verified FROM writers WHERE email = ?',
    [email],
  );
  return writer || null;
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function createResetToken(email) {
  await ensureSetup();
  const p = getPool();
  const [[writer]] = await p.execute(
    'SELECT id, name, email_verified FROM writers WHERE email = ?',
    [email],
  );
  if (!writer || !writer.email_verified) return null; // don't reveal unverified accounts
  const token = randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await p.execute(
    'UPDATE writers SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?',
    [hashToken(token), expires, writer.id],
  );
  return { token, name: writer.name };
}

export async function getWriterByResetToken(token) {
  await ensureSetup();
  const [[writer]] = await getPool().execute(
    'SELECT id, name, reset_token_expires_at FROM writers WHERE reset_token = ?',
    [hashToken(token)],
  );
  if (!writer) return null;
  if (new Date(writer.reset_token_expires_at) < new Date()) return { expired: true };
  return writer;
}

export async function resetPasswordByToken(token, newPassword) {
  await ensureSetup();
  const p = getPool();
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const [result] = await p.execute(
    `UPDATE writers SET password = ?, reset_token = NULL, reset_token_expires_at = NULL
     WHERE reset_token = ? AND reset_token_expires_at > NOW()`,
    [hashed, hashToken(token)],
  );
  return result.affectedRows > 0;
}

// ── Account update ────────────────────────────────────────────────────────────

export async function updateWriterAccount(writerId, { name, email, newPassword, currentPassword }) {
  await ensureSetup();
  const p = getPool();

  const [[writer]] = await p.execute(
    'SELECT id, name, email, password FROM writers WHERE id = ?',
    [writerId],
  );
  if (!writer) return { error: 'Account not found.' };

  // Always require current password
  const valid = await bcrypt.compare(currentPassword, writer.password);
  if (!valid) return { error: 'Current password is incorrect.' };

  const emailChanged = email && email.toLowerCase() !== writer.email.toLowerCase();
  let verificationToken = null;

  if (emailChanged) {
    // Check email not taken by another account
    const [[existing]] = await p.execute(
      'SELECT id FROM writers WHERE email = ? AND id != ?',
      [email, writerId],
    );
    if (existing) return { error: 'This email address is already in use.' };
    verificationToken = randomUUID();
  }

  const hashedNew = newPassword ? await bcrypt.hash(newPassword, SALT_ROUNDS) : null;

  await p.execute(
    `UPDATE writers SET
       name = ?,
       email = ?,
       ${hashedNew ? 'password = ?,' : ''}
       ${emailChanged ? 'email_verified = 0, verification_token = ?,' : ''}
       id = id
     WHERE id = ?`,
    [
      name || writer.name,
      email || writer.email,
      ...(hashedNew ? [hashedNew] : []),
      ...(emailChanged ? [hashToken(verificationToken)] : []),
      writerId,
    ],
  );

  return { ok: true, emailChanged, verificationToken, newEmail: email || writer.email, name: name || writer.name };
}

// ── Scheduled release ─────────────────────────────────────────────────────────

// Returns sections whose fixed release_date has passed and haven't been released yet
export async function getSectionsToRelease() {
  await ensureSetup();
  const [rows] = await getPool().execute(
    `SELECT ws.id, ws.writer_id, ws.title, ws.release_date,
            w.name AS writer_name
     FROM will_sections ws
     JOIN writers w ON w.id = ws.writer_id
     WHERE ws.release_date IS NOT NULL
       AND ws.released_at IS NULL
       AND ws.release_date <= CURDATE()`,
  );
  return rows;
}

export async function markSectionReleased(sectionId) {
  await ensureSetup();
  await getPool().execute(
    'UPDATE will_sections SET released_at = NOW() WHERE id = ?',
    [sectionId],
  );
}

// When DMS fires, set release_date for relative-delay sections
export async function applyRelativeReleaseDates(writerId, dmzUnlockedAt) {
  await ensureSetup();
  const p = getPool();
  const baseDate = new Date(dmzUnlockedAt);
  const [sections] = await p.execute(
    `SELECT id, release_delay_days FROM will_sections
     WHERE writer_id = ? AND release_delay_days IS NOT NULL AND release_date IS NULL`,
    [writerId],
  );
  for (const s of sections) {
    const releaseDate = new Date(baseDate);
    releaseDate.setDate(releaseDate.getDate() + s.release_delay_days);
    await p.execute(
      'UPDATE will_sections SET release_date = ? WHERE id = ?',
      [releaseDate.toISOString().slice(0, 10), s.id],
    );
  }
}

// Get assigned reader names + their emails for a section
export async function getSectionRecipients(sectionId) {
  await ensureSetup();
  const p = getPool();
  const [rows] = await p.execute(
    `SELECT r.reader_name, r.email
     FROM section_recipients sr
     JOIN will_sections ws ON ws.id = sr.section_id
     JOIN recipients r ON r.writer_id = ws.writer_id AND lower(r.reader_name) = lower(sr.reader_name)
     WHERE sr.section_id = ?`,
    [sectionId],
  );
  return rows.map((r) => ({ readerName: r.reader_name, email: r.email || null }));
}

export async function resetHeartbeat(token) {
  await ensureSetup();
  const p = getPool();
  const [[writer]] = await p.execute(
    'SELECT id, name, dmz_unlocked_at FROM writers WHERE heartbeat_token = ?',
    [hashToken(token)],
  );
  if (!writer) return null;
  if (writer.dmz_unlocked_at) return { alreadyUnlocked: true, name: writer.name };
  await p.execute(
    'UPDATE writers SET last_active_at = NOW(), warning_sent_at = NULL, heartbeat_token = NULL WHERE heartbeat_token = ?',
    [hashToken(token)],
  );
  return { ok: true, name: writer.name };
}

export async function getWriterProfile(writerId) {
  await ensureSetup();
  const [[writer]] = await getPool().execute(
    'SELECT id, name, email FROM writers WHERE id = ? AND email_verified = 1',
    [writerId],
  );
  return writer || null;
}
