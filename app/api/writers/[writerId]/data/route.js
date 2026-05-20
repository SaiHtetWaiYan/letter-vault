import { NextResponse } from 'next/server';
import { getWriterData } from '../../../../../lib/db.js';

export async function GET(_request, { params }) {
  const { writerId } = await params;
  return NextResponse.json(await getWriterData(writerId));
}
