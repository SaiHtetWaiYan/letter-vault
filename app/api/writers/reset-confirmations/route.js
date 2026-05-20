import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db.js';

export async function POST() {
  const db = await getDb();
  await db.run('DELETE FROM confirmed_recipients');
  return NextResponse.json({ success: true, message: 'All recipient passcode confirmations cleared. Vault is now locked.' });
}
