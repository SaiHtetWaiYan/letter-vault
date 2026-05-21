import { NextResponse } from 'next/server';
import { setDmsConfig, getWriterData } from '../../../../../lib/db.js';

export async function PATCH(request, { params }) {
  const { writerId } = await params;
  const { inactivityDays, graceDays } = await request.json();

  if (
    !Number.isInteger(inactivityDays) || inactivityDays < 1 ||
    !Number.isInteger(graceDays) || graceDays < 1
  ) {
    return NextResponse.json(
      { message: 'inactivityDays and graceDays must be positive integers.' },
      { status: 400 },
    );
  }

  await setDmsConfig(writerId, { inactivityDays, graceDays });
  return NextResponse.json(await getWriterData(writerId));
}
