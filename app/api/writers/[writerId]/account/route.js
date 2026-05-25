import { NextResponse } from 'next/server';
import { updateWriterAccount } from '../../../../../lib/db.js';
import { sendEmail, buildVerificationEmail } from '../../../../../lib/email.js';
import { clearAuthCookies, requireSameOrigin, requireWriter } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { writerId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

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

  const response = NextResponse.json({
    ok: true,
    emailChanged: result.emailChanged || false,
    name: result.name,
  });
  if (result.emailChanged) clearAuthCookies(response);
  return response;
}
