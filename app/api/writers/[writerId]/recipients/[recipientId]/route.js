import { NextResponse } from 'next/server';
import { getDb, getWriterData } from '../../../../../../lib/db.js';
import { requireSameOrigin, requireWriter } from '../../../../../../lib/auth.js';

export async function DELETE(request, { params }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const db = await getDb();
  const { writerId, recipientId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

  const existing = await db.get(
    'SELECT id FROM recipients WHERE id = ? AND writer_id = ?',
    recipientId,
    writerId,
  );

  if (!existing) {
    return NextResponse.json({ message: 'Recipient not found.' }, { status: 404 });
  }

  await db.run('DELETE FROM recipients WHERE id = ? AND writer_id = ?', recipientId, writerId);

  return NextResponse.json(await getWriterData(writerId), { status: 200 });
}
