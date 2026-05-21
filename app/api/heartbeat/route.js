import { NextResponse } from 'next/server';
import { resetHeartbeat } from '../../../lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse(html('Invalid link', 'This heartbeat link is invalid or has expired.', false), {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  const result = await resetHeartbeat(token);

  if (!result) {
    return new NextResponse(html('Invalid link', 'This heartbeat link is invalid or has expired.', false), {
      headers: { 'Content-Type': 'text/html' },
      status: 404,
    });
  }

  if (result.alreadyUnlocked) {
    return new NextResponse(
      html('Vault already opened', `The vault for ${result.name} has already been opened. Your timer cannot be reset.`, false),
      { headers: { 'Content-Type': 'text/html' }, status: 200 },
    );
  }

  return new NextResponse(
    html("You're confirmed alive", `Hello ${result.name} — your inactivity timer has been reset. Your letters remain sealed.`, true),
    { headers: { 'Content-Type': 'text/html' }, status: 200 },
  );
}

function html(title, message, ok) {
  const color = ok ? '#e8a84c' : '#c0392b';
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://letter-vault.saihtet.dev';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — Letter Vault</title>
  <style>
    body{font-family:Georgia,serif;background:#0d0d07;color:#e8d9b0;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px}
    .card{max-width:480px;text-align:center;padding:48px 32px;border:1px solid rgba(232,168,76,0.15);border-radius:12px;background:#141408}
    .icon{font-size:40px;margin-bottom:16px}
    h1{font-size:24px;margin:0 0 12px;color:${color}}
    p{font-size:15px;color:#b8a878;line-height:1.6;margin:0 0 28px}
    a{display:inline-block;background:${color};color:#1a1209;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-family:sans-serif;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '✓' : '✕'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${base}">Go to Letter Vault</a>
  </div>
</body>
</html>`;
}
