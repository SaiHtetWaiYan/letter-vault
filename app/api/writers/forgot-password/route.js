import { NextResponse } from 'next/server';
import { createResetToken } from '../../../../lib/db.js';
import { sendEmail, buildPasswordResetEmail } from '../../../../lib/email.js';

export async function POST(request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ ok: true }); // always return 200

  const result = await createResetToken(email);
  if (result) {
    const { subject, html } = buildPasswordResetEmail({ writerName: result.name, resetToken: result.token });
    await sendEmail({ to: email, subject, html });
  }

  // Always return ok — don't reveal whether account exists
  return NextResponse.json({ ok: true });
}
