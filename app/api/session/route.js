import { NextResponse } from 'next/server';
import { getReaderSession, getWriterSession } from '../../../lib/auth.js';
import { getRecipientSections, getWriterProfile } from '../../../lib/db.js';

export async function GET() {
  const writerSession = await getWriterSession();
  if (writerSession?.type === 'writer') {
    const writer = await getWriterProfile(writerSession.writerId);
    if (writer) {
      return NextResponse.json({ type: 'writer', writer });
    }
  }

  const readerSession = await getReaderSession();
  if (readerSession?.type === 'reader') {
    const data = await getRecipientSections(readerSession.readerName, readerSession.writerId);
    return NextResponse.json({ type: 'recipient', readerName: readerSession.readerName, ...data });
  }

  return NextResponse.json({ type: null });
}
