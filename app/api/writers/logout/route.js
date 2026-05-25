import { NextResponse } from 'next/server';
import { clearAuthCookies, requireSameOrigin } from '../../../../lib/auth.js';

export async function POST(request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
