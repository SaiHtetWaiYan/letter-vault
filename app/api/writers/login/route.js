import { NextResponse } from 'next/server';
import { getDb, bcrypt, touchLastActive } from '../../../../lib/db.js';

export async function POST(request) {
  const db = await getDb();
  const { email, password } = await request.json();

  const writer = await db.get(
    'SELECT id, name, email, password FROM writers WHERE email = ?',
    email,
  );

  const valid = writer && await bcrypt.compare(password, writer.password);
  if (!valid) {
    return NextResponse.json(
      { message: 'Email or password is incorrect.' },
      { status: 401 },
    );
  }

  // Reset inactivity timer on every login
  await touchLastActive(writer.id);

  return NextResponse.json({ id: writer.id, name: writer.name, email: writer.email });
}
