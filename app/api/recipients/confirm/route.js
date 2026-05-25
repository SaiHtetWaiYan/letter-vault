import { NextResponse } from 'next/server';
import { findRecipientByPasscodes, getRecipientSections, getVaultUnlockStatus, getWriterRecipients, confirmRecipient, getDb } from '../../../../lib/db.js';
import { sendEmail, buildRecipientUnlockEmail } from '../../../../lib/email.js';
import { requireSameOrigin, setReaderSession } from '../../../../lib/auth.js';
import { rateLimit } from '../../../../lib/rateLimit.js';

export async function POST(request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const limited = await rateLimit(request, 'recipient-confirm', { limit: 12, windowMs: 60_000 });
  if (limited) return limited;

  const { readerName, passcodes } = await request.json();
  const submittedPasscodes = Array.isArray(passcodes) ? passcodes : [];
  const { recipient, matches } = await findRecipientByPasscodes(readerName, submittedPasscodes);

  if (!matches.length) {
    return NextResponse.json(
      { message: 'Recipient name or passcode is incorrect.' },
      { status: 401 },
    );
  }

  if (!recipient) {
    return NextResponse.json(
      { message: 'More than one matching recipient exists. Ask the letter creator to use a unique recipient name.' },
      { status: 409 },
    );
  }

  // Snapshot vault state BEFORE this confirmation
  const writerId = recipient.writer_id;
  const before = await getVaultUnlockStatus(writerId);

  await confirmRecipient(recipient);

  // Snapshot AFTER — if vault just crossed the threshold, notify all recipients
  if (!before.isUnlocked) {
    const after = await getVaultUnlockStatus(writerId);
    if (after.isUnlocked) {
      await notifyAllRecipients(writerId);
    }
  }

  const response = NextResponse.json(await getRecipientSections(recipient.reader_name, writerId));
  setReaderSession(response, recipient);
  return response;
}

async function notifyAllRecipients(writerId) {
  const db = await getDb();
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
