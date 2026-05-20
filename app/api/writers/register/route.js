import { NextResponse } from 'next/server';
import { createId, getDb, bcrypt, SALT_ROUNDS } from '../../../../lib/db.js';

export async function POST(request) {
  const db = await getDb();
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ message: 'Name, email, and password are required.' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ message: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  try {
    const id = createId();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await db.run(
      'INSERT INTO writers (id, name, email, password) VALUES (?, ?, ?, ?)',
      id, name, email, hashedPassword,
    );
    return NextResponse.json({ id, name, email }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: 'A will creator account with this email already exists.' },
      { status: 409 },
    );
  }
}
