import { NextResponse } from 'next/server';
import { getWriterData, setUnlockThreshold } from '../../../../../lib/db.js';
import { requireSameOrigin, requireWriter } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const { writerId } = await params;
  const auth = await requireWriter(writerId);
  if (auth.error) return auth.error;

  const { unlockThreshold } = await request.json();

  if (unlockThreshold !== null && (!Number.isInteger(unlockThreshold) || unlockThreshold < 1)) {
    return NextResponse.json(
      { message: 'unlockThreshold must be a positive integer or null.' },
      { status: 400 },
    );
  }

  await setUnlockThreshold(writerId, unlockThreshold);
  return NextResponse.json(await getWriterData(writerId));
}
