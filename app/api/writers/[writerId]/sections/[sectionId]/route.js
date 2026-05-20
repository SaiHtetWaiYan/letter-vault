import { NextResponse } from 'next/server';
import { getDb, getWriterData } from '../../../../../../lib/db.js';

export async function DELETE(request, { params }) {
  const db = await getDb();
  const { writerId, sectionId } = await params;

  const existing = await db.get(
    'SELECT id FROM will_sections WHERE id = ? AND writer_id = ?',
    sectionId,
    writerId,
  );

  if (!existing) {
    return NextResponse.json({ message: 'Section not found.' }, { status: 404 });
  }

  await db.run('DELETE FROM section_recipients WHERE section_id = ?', sectionId);
  await db.run('DELETE FROM will_sections WHERE id = ? AND writer_id = ?', sectionId, writerId);

  return NextResponse.json(await getWriterData(writerId), { status: 200 });
}
