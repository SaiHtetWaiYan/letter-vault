import { NextResponse } from 'next/server';
import { createId, getDb, getWriterData, encrypt } from '../../../../../lib/db.js';

export async function POST(request, { params }) {
  const db = await getDb();
  const { writerId } = await params;
  const { id, readerNames, title, summary, text, attachments } = await request.json();

  if (!Array.isArray(readerNames) || readerNames.length === 0 || !title || !text) {
    return NextResponse.json(
      { message: 'Required recipients, title, and text are required.' },
      { status: 400 },
    );
  }

  if (id) {
    // Edit existing section
    const existing = await db.get(
      'SELECT id FROM will_sections WHERE id = ? AND writer_id = ?',
      id,
      writerId,
    );
    if (!existing) {
      return NextResponse.json(
        { message: 'Will section not found.' },
        { status: 404 },
      );
    }

    await db.run(
      'UPDATE will_sections SET title = ?, summary = ?, text = ?, attachments = ? WHERE id = ? AND writer_id = ?',
      title,
      summary || '',
      encrypt(text),
      encrypt(JSON.stringify(attachments || [])),
      id,
      writerId,
    );

    await db.run('DELETE FROM section_recipients WHERE section_id = ?', id);

    for (const readerName of readerNames) {
      await db.run(
        'INSERT INTO section_recipients (section_id, reader_name) VALUES (?, ?)',
        id,
        readerName,
      );
    }
  } else {
    // Create new section
    const sectionId = createId();
    await db.run(
      'INSERT INTO will_sections (id, writer_id, title, summary, text, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      sectionId,
      writerId,
      title,
      summary || '',
      encrypt(text),
      encrypt(JSON.stringify(attachments || [])),
      new Date().toISOString().slice(0, 10),
    );

    for (const readerName of readerNames) {
      await db.run(
        'INSERT INTO section_recipients (section_id, reader_name) VALUES (?, ?)',
        sectionId,
        readerName,
      );
    }
  }

  return NextResponse.json(await getWriterData(writerId), { status: 200 });
}
