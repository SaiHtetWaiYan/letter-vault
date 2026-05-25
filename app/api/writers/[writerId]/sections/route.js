import { NextResponse } from 'next/server';
import { createId, getDb, getWriterData, encrypt } from '../../../../../lib/db.js';
import { requireSameOrigin, requireWriter } from '../../../../../lib/auth.js';
import { sanitizeAttachments, sanitizeHtml } from '../../../../../lib/sanitize.js';

export async function POST(request, { params }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const db = await getDb();
  const { writerId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

  const { id, readerNames, title, summary, text, attachments, releaseDate, releaseDelayDays } = await request.json();
  const cleanText = sanitizeHtml(text);
  const cleanAttachments = sanitizeAttachments(attachments);
  // Normalise: only one of the two can be set
  const relDate = releaseDate || null;
  const relDelay = releaseDelayDays != null ? Math.max(1, Math.floor(Number(releaseDelayDays))) : null;

  if (!Array.isArray(readerNames) || readerNames.length === 0 || !title || !text) {
    return NextResponse.json(
      { message: 'Required recipients, title, and text are required.' },
      { status: 400 },
    );
  }
  const cleanReaderNames = [...new Set(readerNames.map((name) => String(name || '').trim()).filter(Boolean))];
  if (cleanReaderNames.length !== readerNames.length) {
    return NextResponse.json({ message: 'Selected recipients are invalid.' }, { status: 400 });
  }
  const placeholders = cleanReaderNames.map(() => '?').join(',');
  const knownReaders = await db.all(
    `SELECT reader_name FROM recipients WHERE writer_id = ? AND reader_name IN (${placeholders})`,
    writerId,
    ...cleanReaderNames,
  );
  if (knownReaders.length !== cleanReaderNames.length) {
    return NextResponse.json({ message: 'Every selected recipient must belong to this writer.' }, { status: 400 });
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
      `UPDATE will_sections SET title = ?, summary = ?, text = ?, attachments = ?,
        release_date = ?, release_delay_days = ?, released_at = NULL
       WHERE id = ? AND writer_id = ?`,
      title,
      summary || '',
      encrypt(cleanText),
      encrypt(JSON.stringify(cleanAttachments)),
      relDate,
      relDelay,
      id,
      writerId,
    );

    await db.run('DELETE FROM section_recipients WHERE section_id = ?', id);

    for (const readerName of cleanReaderNames) {
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
      `INSERT INTO will_sections
        (id, writer_id, title, summary, text, attachments, created_at, release_date, release_delay_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sectionId,
      writerId,
      title,
      summary || '',
      encrypt(cleanText),
      encrypt(JSON.stringify(cleanAttachments)),
      new Date().toISOString().slice(0, 10),
      relDate,
      relDelay,
    );

    for (const readerName of cleanReaderNames) {
      await db.run(
        'INSERT INTO section_recipients (section_id, reader_name) VALUES (?, ?)',
        sectionId,
        readerName,
      );
    }
  }

  return NextResponse.json(await getWriterData(writerId), { status: 200 });
}
