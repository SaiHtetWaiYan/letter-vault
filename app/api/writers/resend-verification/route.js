import { NextResponse } from 'next/server';
import { getUnverifiedWriterByEmail, createVerificationToken } from '../../../../lib/db.js';
import { sendEmail, buildVerificationEmail } from '../../../../lib/email.js';
import { rateLimit } from '../../../../lib/rateLimit.js';
import { requireSameOrigin } from '../../../../lib/auth.js';

export async function POST(request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const limited = await rateLimit(request, 'resend-verification', { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

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
