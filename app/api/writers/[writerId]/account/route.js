import { NextResponse } from 'next/server';
import { updateWriterAccount, createVerificationToken } from '../../../../../lib/db.js';
import { sendEmail, buildVerificationEmail, buildEmailChangedEmail } from '../../../../../lib/email.js';

export async function PATCH(request, { params }) {
  const { writerId } = await params;
  const { name, email, newPassword, currentPassword } = await request.json();

  if (!currentPassword) {
    return NextResponse.json({ message: 'Current password is required.' }, { status: 400 });
  }

  const result = await updateWriterAccount(writerId, { name, email, newPassword, currentPassword });

  if (result.error) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  // Email changed — send verification to new address
  if (result.emailChanged) {
    const { subject, html } = buildVerificationEmail({
      writerName: result.name,
      verificationToken: result.verificationToken,
    });
    await sendEmail({ to: result.newEmail, subject, html });
  }

  return NextResponse.json({
    ok: true,
    emailChanged: result.emailChanged || false,
    name: result.name,
  });
}
