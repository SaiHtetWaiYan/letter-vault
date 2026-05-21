import { NextResponse } from 'next/server';
import { getUnverifiedWriterByEmail, createVerificationToken } from '../../../../lib/db.js';
import { sendEmail, buildVerificationEmail } from '../../../../lib/email.js';

export async function POST(request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
  }

  const writer = await getUnverifiedWriterByEmail(email);

  // Always return 200 to avoid revealing whether an account exists
  if (!writer || writer.email_verified) {
    return NextResponse.json({ ok: true });
  }

  const token = await createVerificationToken(writer.id);
  const { subject, html } = buildVerificationEmail({ writerName: writer.name, verificationToken: token });
  await sendEmail({ to: email, subject, html });

  return NextResponse.json({ ok: true });
}
