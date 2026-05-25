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

export function buildVerificationEmail({ writerName, verificationToken }) {
  const verifyUrl = `${BASE_URL}/api/verify-email?token=${verificationToken}`;
  return {
    subject: 'Letter Vault — Verify your email address',
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>Hello ${writerName},</p>
  <p>Thank you for creating an account. Please verify your email address to activate your vault.</p>
  <p style="margin:32px 0">
    <a href="${verifyUrl}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      Verify my email address
    </a>
  </p>
  <p style="font-size:12px;color:#888">
    Or copy this link into your browser:<br/>
    <a href="${verifyUrl}" style="color:#e8a84c">${verifyUrl}</a>
  </p>
  <p style="font-size:12px;color:#888;margin-top:32px">
    If you did not create this account, you can safely ignore this email.
  </p>
</div>`,
  };
}

export function buildRecipientInviteEmail({ writerName, readerName, passcode, isTrusted }) {
  return {
    subject: `${writerName} has named you in their Letter Vault`,
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>

  <p>Hello ${readerName},</p>

  <p>
    <strong>${writerName}</strong> has added you as a recipient in their private Letter Vault —
    a sealed collection of personal letters to be delivered when the time comes.
  </p>

  ${isTrusted ? `
  <p>
    You have been designated as a <strong>trusted keyholder</strong>. This means your confirmation
    will be required before the vault can open and the letters can be read.
    When the time comes, you will need to visit Letter Vault and enter your name and passcode to confirm.
  </p>
  ` : `
  <p>
    You have been designated as a <strong>beneficiary</strong>. Once the required keyholders have
    confirmed, the letters assigned to you will become available to read.
  </p>
  `}

  <div style="background:#fffdf5;border:1px solid #e8a84c;border-radius:8px;padding:20px 24px;margin:28px 0">
    <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#888">Your access details</p>
    <p style="margin:0 0 4px;font-size:15px"><strong>Name:</strong> ${readerName}</p>
    <p style="margin:0;font-size:15px"><strong>Passcode:</strong> <code style="background:#f5f0e8;padding:2px 8px;border-radius:4px;font-size:14px">${passcode}</code></p>
  </div>

  <p style="font-size:13px;color:#555">
    Keep this passcode safe — you will need it to access your letters.
    There is nothing you need to do right now. You will be notified when the vault opens.
  </p>

  <p style="margin:32px 0">
    <a href="${BASE_URL}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      Visit Letter Vault
    </a>
  </p>

  <p style="font-size:12px;color:#999;margin-top:32px">
    Letter Vault is a private posthumous letter system. Your details were added by ${writerName}.
  </p>
</div>`,
  };
}

export function buildPreviewEmail({ writerName, sectionTitle, sectionText }) {
  // Strip images/large data from text for email preview
  const cleanText = sectionText.replace(/src="data:[^"]*"/g, 'src=""');
  return {
    subject: `[Preview] "${sectionTitle}" — Letter Vault`,
    html: `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:18px;font-weight:bold;margin-bottom:4px;color:#e8a84c">Letter Vault — Section Preview</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p style="font-size:12px;color:#888;border:1px solid #daa520;border-radius:6px;padding:10px 14px;background:#fffbf0">
    ⚠ This is a <strong>preview</strong> sent to you as the creator. Recipients will see this section after the vault unlocks.
  </p>
  <h2 style="font-size:24px;margin:24px 0 8px">${sectionTitle}</h2>
  <div style="font-size:15px;line-height:1.85;color:#333">
    ${cleanText}
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px"/>
  <p style="font-size:12px;color:#999">Preview requested by <strong>${writerName}</strong> · Letter Vault</p>
</div>`,
  };
}

export function buildScheduledReleaseEmail({ writerName, readerName, sectionTitle }) {
  return {
    subject: `A letter from ${writerName} is now available for you`,
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>Hello ${readerName},</p>
  <p><strong>${writerName}</strong> scheduled a letter section to be delivered to you today.</p>
  <blockquote style="border-left:3px solid #e8a84c;margin:16px 0;padding:8px 16px;color:#555;font-style:italic">
    "${sectionTitle}"
  </blockquote>
  <p>You can now read this section by visiting Letter Vault and entering your name and passcode.</p>
  <p style="margin:32px 0">
    <a href="${BASE_URL}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      Read my letter
    </a>
  </p>
</div>`,
  };
}

export function buildPasswordResetEmail({ writerName, resetToken }) {
  const resetUrl = `${BASE_URL}/api/reset-password?token=${resetToken}`;
  return {
    subject: 'Letter Vault — Reset your password',
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>Hello ${writerName},</p>
  <p>We received a request to reset your password. Click the button below to choose a new one.</p>
  <p>This link expires in <strong>1 hour</strong>.</p>
  <p style="margin:32px 0">
    <a href="${resetUrl}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      Reset my password
    </a>
  </p>
  <p style="font-size:12px;color:#888">
    Or copy this link:<br/>
    <a href="${resetUrl}" style="color:#e8a84c">${resetUrl}</a>
  </p>
  <p style="font-size:12px;color:#888;margin-top:32px">
    If you didn't request this, you can safely ignore this email — your password won't change.
  </p>
</div>`,
  };
}

export function buildEmailChangedEmail({ writerName, newEmail }) {
  const verifyUrl = `${BASE_URL}`;
  return {
    subject: 'Letter Vault — Verify your new email address',
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>Hello ${writerName},</p>
  <p>Your email address has been updated to <strong>${newEmail}</strong>.</p>
  <p>Please verify your new address to continue accessing your vault.</p>
  <p style="margin:32px 0">
    <a href="${verifyUrl}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      Go to Letter Vault
    </a>
  </p>
</div>`,
  };
}

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

export function buildRecipientUnlockEmail({ writerName, readerName, triggeredByDms = false, needsKeyholder = false }) {
  const actionText = triggeredByDms && needsKeyholder
    ? '<p>The vault release has been triggered. As a keyholder, please log in and confirm with your passcode to help unlock the vault for all recipients.</p>'
    : triggeredByDms
      ? '<p>The vault has been opened automatically. You can now read the letter sections assigned to you.</p>'
      : '<p>The vault is now open. You can read the letter sections assigned to you.</p>';

  return {
    subject: `${writerName} has left you a letter`,
    html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin-bottom:4px">Letter Vault</p>
  <hr style="border:none;border-top:1px solid #e8a84c;margin-bottom:24px"/>
  <p>Hello ${readerName},</p>
  <p><strong>${writerName}</strong> has left a sealed letter for you.</p>
  ${actionText}
  <p style="margin:32px 0">
    <a href="${BASE_URL}"
       style="background:#e8a84c;color:#1a1209;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
      ${triggeredByDms && needsKeyholder ? 'Confirm my passcode' : 'Read my letter'}
    </a>
  </p>
  <p style="font-size:12px;color:#888">
    Visit <a href="${BASE_URL}" style="color:#e8a84c">${BASE_URL}</a> and enter your name
    and passcode to access your assigned sections.
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
