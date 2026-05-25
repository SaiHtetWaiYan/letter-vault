import { NextResponse } from 'next/server';
import { getRecipientSections } from '../../../../../lib/db.js';
import { requireReader } from '../../../../../lib/auth.js';

export async function GET(_request, { params }) {
  const { readerName } = await params;
  const auth = await requireReader(readerName);
  if (auth.error) return auth.error;

  return NextResponse.json(await getRecipientSections(readerName, auth.session.writerId));
}
