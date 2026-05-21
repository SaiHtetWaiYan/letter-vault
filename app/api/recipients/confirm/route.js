import { NextResponse } from 'next/server';
import { getDb, getRecipientSections, parsePasscodes, bcrypt, getVaultUnlockStatus, getWriterRecipients } from '../../../../lib/db.js';
import { sendEmail, buildRecipientUnlockEmail } from '../../../../lib/email.js';

export async function POST(request) {
  const db = await getDb();
  const { readerName, passcodes } = await request.json();

  const recipient = await db.get(
    'SELECT * FROM recipients WHERE lower(reader_name) = lower(?)',
    readerName || '',
  );

  if (!recipient) {
    return NextResponse.json(
      { message: 'No recipient profile was found for this name.' },
      { status: 404 },
    );
  }

  const hashedPasscodes = parsePasscodes(recipient.passcodes);
  const submittedPasscodes = Array.isArray(passcodes) ? passcodes : [];

  const allPassed = await Promise.all(
    hashedPasscodes.map((hash) =>
      Promise.any(submittedPasscodes.map((p) => bcrypt.compare(p, hash))).catch(() => false),
    ),
  );

  if (allPassed.includes(false)) {
    return NextResponse.json(
      { message: 'All recipient passcodes must be confirmed.' },
      { status: 401 },
    );
  }

  // Snapshot vault state BEFORE this confirmation
  const writerId = recipient.writer_id;
  const before = await getVaultUnlockStatus(writerId);

  await db.run(
    'INSERT INTO confirmed_recipients (reader_name, confirmed_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE confirmed_at = VALUES(confirmed_at)',
    recipient.reader_name,
    new Date().toISOString(),
  );

  // Snapshot AFTER — if vault just crossed the threshold, notify all recipients
  if (!before.isUnlocked) {
    const after = await getVaultUnlockStatus(writerId);
    if (after.isUnlocked) {
      await notifyAllRecipients(writerId, db);
    }
  }

  return NextResponse.json(await getRecipientSections(recipient.reader_name));
}

async function notifyAllRecipients(writerId, db) {
  const writer = await db.get('SELECT name FROM writers WHERE id = ?', writerId);
  const recipients = await getWriterRecipients(writerId);

  await Promise.allSettled(
    recipients
      .filter((r) => r.email)
      .map((r) => {
        const { subject, html } = buildRecipientUnlockEmail({
          writerName: writer.name,
          readerName: r.readerName,
          triggeredByDms: false,
        });
        return sendEmail({ to: r.email, subject, html });
      }),
  );
}
