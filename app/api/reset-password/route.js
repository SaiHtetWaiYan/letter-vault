import { NextResponse } from 'next/server';
import { getWriterByResetToken, resetPasswordByToken } from '../../../lib/db.js';
import { escapeHtml } from '../../../lib/sanitize.js';
import { rateLimit } from '../../../lib/rateLimit.js';
import { requireSameOrigin } from '../../../lib/auth.js';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://letter-vault.saihtet.dev';

// GET — show the reset form
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) return html(errorPage('Invalid link', 'This password reset link is invalid.'));

  const writer = await getWriterByResetToken(token);
  if (!writer) return html(errorPage('Invalid link', 'This password reset link is invalid or has already been used.'));
  if (writer.expired) return html(errorPage('Link expired', 'This password reset link has expired. Please request a new one.'));

  return html(formPage(token));
}

// POST — handle the form submission
export async function POST(request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const limited = await rateLimit(request, 'reset-password', { limit: 8, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.formData();
  const token = body.get('token');
  const password = body.get('password');
  const confirm = body.get('confirm');

  if (!token || !password) return html(errorPage('Missing fields', 'Please fill in all required fields.'));
  if (password.length < 8) return html(formPage(token, 'Password must be at least 8 characters.'));
  if (password !== confirm) return html(formPage(token, 'Passwords do not match.'));

  const ok = await resetPasswordByToken(token, password);
  if (!ok) return html(errorPage('Link expired', 'This reset link is invalid or has expired. Please request a new one.'));

  return html(successPage());
}

function html(body) {
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html' } });
}

function shell(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Reset password — Letter Vault</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Georgia,serif;background:#0d0d07;color:#e8d9b0;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px}
    .card{max-width:420px;width:100%;padding:40px 32px;border:1px solid rgba(232,168,76,0.15);border-radius:12px;background:#141408}
    .brand{font-size:18px;font-weight:bold;color:#e8a84c;margin-bottom:4px}
    hr{border:none;border-top:1px solid rgba(232,168,76,0.2);margin:16px 0 24px}
    h1{font-size:22px;margin:0 0 10px;color:#e8d9b0}
    p{font-size:14px;color:#b8a878;line-height:1.7;margin:0 0 20px}
    label{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7a6a4a;margin-bottom:6px}
    input[type=password]{width:100%;background:#0a0c10;border:1px solid rgba(232,168,76,0.2);border-radius:6px;color:#e8d9b0;font-family:inherit;font-size:14px;padding:11px 14px;outline:none;margin-bottom:16px}
    input[type=password]:focus{border-color:rgba(232,168,76,0.5)}
    .error{background:rgba(180,40,40,0.12);border:1px solid rgba(180,40,40,0.3);border-radius:6px;color:#e87070;font-size:13px;padding:10px 14px;margin-bottom:16px}
    button{width:100%;background:#e8a84c;color:#1a1209;border:none;border-radius:6px;font-family:inherit;font-size:14px;font-weight:bold;padding:13px;cursor:pointer;margin-top:4px}
    button:hover{background:#f0b85c}
    a{color:#e8a84c}
    .back{display:inline-block;margin-top:20px;font-size:13px;color:#7a6a4a;text-decoration:none}
    .back:hover{color:#b8a878}
    .icon{font-size:40px;text-align:center;margin-bottom:16px}
  </style>
</head>
<body><div class="card">${content}</div></body>
</html>`;
}

function formPage(token, errorMsg = '') {
  return shell(`
    <div class="brand">Letter Vault</div><hr/>
    <h1>Reset your password</h1>
    <p>Choose a new password for your account. Must be at least 8 characters.</p>
    ${errorMsg ? `<div class="error">${escapeHtml(errorMsg)}</div>` : ''}
    <form method="POST" action="/api/reset-password">
      <input type="hidden" name="token" value="${escapeHtml(token)}"/>
      <label>New password</label>
      <input type="password" name="password" placeholder="At least 8 characters" required minlength="8" autofocus/>
      <label>Confirm password</label>
      <input type="password" name="confirm" placeholder="Repeat your new password" required/>
      <button type="submit">Set new password →</button>
    </form>
    <a class="back" href="${escapeHtml(BASE)}">← Back to Letter Vault</a>
  `);
}

function successPage() {
  return shell(`
    <div class="icon">✓</div>
    <h1 style="text-align:center;color:#e8a84c">Password updated</h1>
    <p style="text-align:center">Your password has been reset. You can now sign in with your new password.</p>
    <a href="${escapeHtml(BASE)}" style="display:block;text-align:center;background:#e8a84c;color:#1a1209;padding:13px;border-radius:6px;font-weight:bold;text-decoration:none">Sign in →</a>
  `);
}

function errorPage(title, message) {
  return shell(`
    <div class="icon" style="color:#e87070">✕</div>
    <h1 style="text-align:center;color:#e87070">${escapeHtml(title)}</h1>
    <p style="text-align:center">${escapeHtml(message)}</p>
    <a href="${escapeHtml(BASE)}" style="display:block;text-align:center;background:#e8a84c;color:#1a1209;padding:13px;border-radius:6px;font-weight:bold;text-decoration:none">Back to Letter Vault</a>
  `);
}
