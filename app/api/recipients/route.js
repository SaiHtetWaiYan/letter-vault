import { NextResponse } from 'next/server';
import { getAllRecipients } from '../../../lib/db.js';

export async function GET() {
  return NextResponse.json(await getAllRecipients());
}
