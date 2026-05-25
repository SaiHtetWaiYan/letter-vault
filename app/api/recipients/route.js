import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Not found.' }, { status: 404 });
}
