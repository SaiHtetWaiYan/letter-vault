import { NextResponse } from 'next/server';
import { createId, getDb, getWriterData, bcrypt, SALT_ROUNDS } from '../../../../../lib/db.js';
import { sendEmail, buildRecipientInviteEmail } from '../../../../../lib/email.js';
import { requireSameOrigin, requireWriter } from '../../../../../lib/auth.js';

export async function POST(request, { params }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const db = await getDb();
  const { writerId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

  const { readerName, passcodes, isTrusted, email } = await request.json();

  if (!readerName || !Array.isArray(passcodes) || passcodes.length === 0 || !email) {
    return NextResponse.json(
      { message: 'Recipient name, passcode, and email are all required.' },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return NextResponse.json(
      { message: 'Please provide a valid email address.' },
      { status: 400 },
    );
  }

  const shortPasscode = passcodes.find((p) => String(p || '').length < 4);
  if (shortPasscode !== undefined) {
    return NextResponse.json(
      { message: 'Each passcode must be at least 4 characters.' },
      { status: 400 },
    );
  }

  try {
    const hashedPasscodes = await Promise.all(
      passcodes.map((p) => bcrypt.hash(p, SALT_ROUNDS)),
    );
    await db.run(
      'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
      createId(),
	      writerId,
	      readerName,
	      JSON.stringify(hashedPasscodes),
	      null,
      isTrusted ? 1 : 0,
      email || null,
    );

    // Send invitation email if recipient has an email address
    if (email) {
      const writer = await db.get('SELECT name FROM writers WHERE id = ?', writerId);
      if (writer) {
        const { subject, html } = buildRecipientInviteEmail({
          writerName: writer.name,
          readerName,
	          isTrusted: Boolean(isTrusted),
	        });
        await sendEmail({ to: email, subject, html });
      }
    }

    return NextResponse.json(await getWriterData(writerId), { status: 201 });
  } catch {
    return NextResponse.json({ message: 'This recipient name already exists.' }, { status: 409 });
  }
}
