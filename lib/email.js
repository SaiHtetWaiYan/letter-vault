import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || 'Letter Vault <no-reply@letter-vault.saihtet.dev>';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://letter-vault.saihtet.dev';

export async function sendEmail({ to, subject, html }) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[email] SMTP not configured — skipping email to', to);
    return;
  }
  await transport.sendMail({ from: FROM, to, subject, html });
}

// ── Email templates ────────────────────────────────────────────────────────────

export function buildWarningEmail({ writerName, heartbeatToken, graceDays }) {
  const heartbeatUrl = `${BASE_URL}/api/heartbeat?token=${heartbeatToken}`;
  return {
    subject: 'Letter Vault — Are you still there?',
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>Hello ${writerName},</p>
  <p>
    Your Letter Vault has not detected any activity from you recently.
    If you are well, please click the button below to confirm and reset your inactivity timer.
  </p>
  <p>
    <strong>If we do not hear from you within ${graceDays} day${graceDays === 1 ? '' : 's'},
    your vault will automatically unlock and your letters will be delivered to your recipients.</strong>
  </p>
  <p style="margin:32px 0">
    <a href="${heartbeatUrl}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      I'm still here — reset my timer
    </a>
  </p>
  <p style="font-size:12px;color:#888">
    Or copy this link into your browser:<br/>
    <a href="${heartbeatUrl}" style="color:#e8a84c">${heartbeatUrl}</a>
  </p>
  <p style="font-size:12px;color:#888;margin-top:32px">
    You can also log in to your Letter Vault account to reset the timer.
  </p>
</div>`,
  };
}

export function buildUnlockEmail({ writerName }) {
  return {
    subject: `${writerName} has left you a letter`,
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>A letter has been left for you by <strong>${writerName}</strong>.</p>
  <p>
    The vault has been opened. You can now read the letter sections assigned to you
    by visiting Letter Vault and entering your name and passcode.
  </p>
  <p style="margin:32px 0">
    <a href="${BASE_URL}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      Read my letter
    </a>
  </p>
  <p style="font-size:12px;color:#888">
    Or visit: <a href="${BASE_URL}" style="color:#e8a84c">${BASE_URL}</a>
  </p>
</div>`,
  };
}
