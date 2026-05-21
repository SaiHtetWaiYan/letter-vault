import { NextResponse } from 'next/server';
import { sendEmail } from '../../../lib/email.js';

export async function POST(request) {
  const { to } = await request.json();

  if (!to) {
    return NextResponse.json({ message: 'to is required' }, { status: 400 });
  }

  await sendEmail({
    to,
    subject: 'Letter Vault — Test Email ✓',
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;color:#e8a84c;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <h2 style="margin:0 0 12px">SMTP is working ✓</h2>
  <p>This is a test email sent from your Letter Vault instance.</p>
  <p>Dead-man's switch warning and unlock emails will be delivered successfully.</p>
  <p style="font-size:12px;color:#888;margin-top:32px">Sent from: ${process.env.SMTP_HOST}</p>
</div>`,
  });

  return NextResponse.json({ ok: true, to });
}
