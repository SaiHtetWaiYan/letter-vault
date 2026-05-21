import { NextResponse } from 'next/server';
import { getDb, decrypt } from '../../../../../lib/db.js';
import { sendEmail, buildPreviewEmail } from '../../../../../lib/email.js';

export async function POST(request, { params }) {
  const { writerId } = await params;
  const { sectionId } = await request.json();

  const db = await getDb();

  const writer = await db.get('SELECT name, email FROM writers WHERE id = ?', writerId);
  if (!writer) return NextResponse.json({ message: 'Writer not found.' }, { status: 404 });

  const section = await db.get(
    'SELECT title, text FROM will_sections WHERE id = ? AND writer_id = ?',
    sectionId, writerId,
  );
  if (!section) return NextResponse.json({ message: 'Section not found.' }, { status: 404 });

  const { subject, html } = buildPreviewEmail({
    writerName: writer.name,
    sectionTitle: section.title,
    sectionText: decrypt(section.text),
  });

  await sendEmail({ to: writer.email, subject, html });

  return NextResponse.json({ ok: true });
}
