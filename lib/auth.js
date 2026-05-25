import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const WRITER_COOKIE = 'letter_writer_session';
const READER_COOKIE = 'letter_reader_session';
const ONE_WEEK = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.LETTER_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to a strong random value.');
  }
  return secret;
}

function sign(value) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(raw) {
  if (!raw || !raw.includes('.')) return null;
  const [payload, signature] = raw.split('.');
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function cookieOptions(maxAge = ONE_WEEK) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export function setWriterSession(response, writer) {
  response.cookies.set(
    WRITER_COOKIE,
    encodeSession({ type: 'writer', writerId: writer.id, email: writer.email }),
    cookieOptions(),
  );
}

export function setReaderSession(response, recipient) {
  response.cookies.set(
    READER_COOKIE,
    encodeSession({
      type: 'reader',
      writerId: recipient.writer_id,
      readerName: recipient.reader_name,
      recipientId: recipient.id,
    }),
    cookieOptions(),
  );
}

export function clearAuthCookies(response) {
  response.cookies.set(WRITER_COOKIE, '', cookieOptions(0));
  response.cookies.set(READER_COOKIE, '', cookieOptions(0));
}

export async function getWriterSession() {
  const store = await cookies();
  return decodeSession(store.get(WRITER_COOKIE)?.value);
}

export async function getReaderSession() {
  const store = await cookies();
  return decodeSession(store.get(READER_COOKIE)?.value);
}

export async function requireWriter(writerId) {
  const session = await getWriterSession();
  if (!session || session.type !== 'writer' || session.writerId !== writerId) {
    return {
      error: NextResponse.json({ message: 'Please sign in again.' }, { status: 401 }),
    };
  }
  return { session };
}

export function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const expected = new Set([url.origin]);
  if (host) expected.add(`${proto}://${host}`);

  const originUrl = origin ? new URL(origin) : null;
  const isLoopbackMatch = originUrl &&
    ['localhost', '127.0.0.1', '[::1]'].includes(originUrl.hostname) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    originUrl.port === url.port;

  if (!origin || (!expected.has(origin) && !isLoopbackMatch)) {
    return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  }
  return null;
}

export async function requireReader(readerName) {
  const session = await getReaderSession();
  if (
    !session ||
    session.type !== 'reader' ||
    session.readerName.toLowerCase() !== String(readerName || '').toLowerCase()
  ) {
    return {
      error: NextResponse.json({ message: 'Please confirm your passcode again.' }, { status: 401 }),
    };
  }
  return { session };
}
