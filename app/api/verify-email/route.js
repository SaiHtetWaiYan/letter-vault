import { NextResponse } from 'next/server';
import { verifyEmailToken } from '../../../lib/db.js';
import { escapeHtml } from '../../../lib/sanitize.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse(page('Invalid link', 'This verification link is invalid or has expired.', false), {
      headers: { 'Content-Type': 'text/html' }, status: 400,
    });
  }

  const result = await verifyEmailToken(token);

  if (!result) {
    return new NextResponse(page('Invalid link', 'This verification link is invalid or has expired.', false), {
      headers: { 'Content-Type': 'text/html' }, status: 404,
    });
  }

  if (result.alreadyVerified) {
    return new NextResponse(
      page('Already verified', `${result.name}, your email is already verified. You can sign in.`, true),
      { headers: { 'Content-Type': 'text/html' }, status: 200 },
    );
  }

  return new NextResponse(
    page('Email verified ✓', `Welcome, ${result.name}. Your email has been verified — you can now sign in to your vault.`, true),
    { headers: { 'Content-Type': 'text/html' }, status: 200 },
  );
}

function page(title, message, ok) {
  const color = ok ? '#e8a84c' : '#c0392b';
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://letter-vault.saihtet.dev';
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeBase = escapeHtml(base);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
	  <title>${safeTitle} — Letter Vault</title>
  <style>
    body{font-family:Georgia,serif;background:#0d0d07;color:#e8d9b0;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px}
    .card{max-width:480px;width:100%;text-align:center;padding:48px 32px;border:1px solid rgba(232,168,76,0.15);border-radius:12px;background:#141408}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:26px;margin:0 0 12px;color:${color}}
    p{font-size:15px;color:#b8a878;line-height:1.7;margin:0 0 28px}
    a{display:inline-block;background:${color};color:#1a1209;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-family:sans-serif;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '✓' : '✕'}</div>
	    <h1>${safeTitle}</h1>
	    <p>${safeMessage}</p>
	    <a href="${safeBase}">Go to Letter Vault</a>
  </div>
</body>
</html>`;
}
