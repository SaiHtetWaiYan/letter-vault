import { NextResponse } from 'next/server';
import { createId, getDb, getWriterData, bcrypt, SALT_ROUNDS, encrypt } from '../../../../../lib/db.js';

export async function POST(request, { params }) {
  const db = await getDb();
  const { writerId } = await params;
  const { readerName, passcodes, isTrusted, email } = await request.json();

  if (!readerName || !Array.isArray(passcodes) || passcodes.length === 0) {
    return NextResponse.json(
      { message: 'Recipient name and passcodes are required.' },
      { status: 400 },
    );
  }

  try {
    const hashedPasscodes = await Promise.all(
      passcodes.map((p) => bcrypt.hash(p, SALT_ROUNDS)),
    );
    await db.run(
      'INSERT INTO recipients (id, writer_id, reader_name, passcodes, passcodes_display, is_trusted, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
      createId(),
      writerId,
      readerName,
      JSON.stringify(hashedPasscodes),
      encrypt(JSON.stringify(passcodes)),
      isTrusted ? 1 : 0,
      email || null,
    );
    return NextResponse.json(await getWriterData(writerId), { status: 201 });
  } catch {
    return NextResponse.json({ message: 'This recipient name already exists.' }, { status: 409 });
  }
}
