import { NextResponse } from 'next/server';
import { getDb } from './db.js';

export async function rateLimit(request, key, { limit = 10, windowMs = 60_000 } = {}) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const db = await getDb();
  const bucket = await db.get('SELECT attempt_count, reset_at FROM rate_limits WHERE bucket_key = ?', bucketKey);

  if (!bucket || Number(bucket.reset_at) <= now) {
    await db.run(
      `INSERT INTO rate_limits (bucket_key, attempt_count, reset_at)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE attempt_count = 1, reset_at = VALUES(reset_at)`,
      bucketKey,
      now + windowMs,
    );
    return null;
  }

  const nextCount = Number(bucket.attempt_count) + 1;
  await db.run(
    'UPDATE rate_limits SET attempt_count = ? WHERE bucket_key = ?',
    nextCount,
    bucketKey,
  );

  if (nextCount > limit) {
    return NextResponse.json(
      { message: 'Too many attempts. Please wait a moment and try again.' },
      { status: 429 },
    );
  }

  return null;
}
