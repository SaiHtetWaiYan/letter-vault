import { NextResponse } from 'next/server';
import { setDmsConfig, getWriterData } from '../../../../../lib/db.js';
import { requireSameOrigin, requireWriter } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { writerId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

  const { inactivityDays, graceDays, keyholderGraceDays } = await request.json();

  if (
    !Number.isInteger(inactivityDays) || inactivityDays < 1 ||
    !Number.isInteger(graceDays) || graceDays < 1 ||
    (keyholderGraceDays != null && (!Number.isInteger(keyholderGraceDays) || keyholderGraceDays < 1))
  ) {
    return NextResponse.json(
      { message: 'inactivityDays, graceDays and keyholderGraceDays must be positive integers.' },
      { status: 400 },
    );
  }

  await setDmsConfig(writerId, { inactivityDays, graceDays, keyholderGraceDays });
  return NextResponse.json(await getWriterData(writerId));
}
