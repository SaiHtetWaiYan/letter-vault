import { NextResponse } from 'next/server';
import { getRecipientSections } from '../../../../../lib/db.js';

export async function GET(_request, { params }) {
  const { readerName } = await params;
  return NextResponse.json(await getRecipientSections(readerName));
}
