import { NextResponse } from 'next/server';
import { clearWriterConfirmations } from '../../../../lib/db.js';
import { requireSameOrigin, requireWriter } from '../../../../lib/auth.js';

export async function POST(request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { writerId } = await request.json();
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

  await clearWriterConfirmations(writerId);
  return NextResponse.json({ success: true, message: 'Recipient passcode confirmations cleared. Vault is now locked.' });
}
