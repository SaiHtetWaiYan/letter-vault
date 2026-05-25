import { NextResponse } from 'next/server';
import { getWriterData } from '../../../../../lib/db.js';
import { requireWriter } from '../../../../../lib/auth.js';

export async function GET(_request, { params }) {
  const { writerId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;
  return NextResponse.json(await getWriterData(writerId));
}
