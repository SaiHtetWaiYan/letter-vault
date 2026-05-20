import { NextResponse } from 'next/server';
import { getDb, getRecipientSections, parsePasscodes, bcrypt } from '../../../../lib/db.js';

export async function POST(request) {
  const db = await getDb();
  const { readerName, passcodes } = await request.json();

  const recipient = await db.get(
    'SELECT * FROM recipients WHERE lower(reader_name) = lower(?)',
    readerName || '',
  );

  if (!recipient) {
    return NextResponse.json(
      { message: 'No recipient profile was found for this name.' },
      { status: 404 },
    );
  }

  const hashedPasscodes = parsePasscodes(recipient.passcodes);
  const submittedPasscodes = Array.isArray(passcodes) ? passcodes : [];

  // Each stored hash must match at least one submitted passcode
  const allPassed = await Promise.all(
    hashedPasscodes.map((hash) =>
      Promise.any(submittedPasscodes.map((p) => bcrypt.compare(p, hash))).catch(() => false),
    ),
  );

  if (allPassed.includes(false)) {
    return NextResponse.json(
      { message: 'All recipient passcodes must be confirmed.' },
      { status: 401 },
    );
  }

  await db.run(
    'INSERT INTO confirmed_recipients (reader_name, confirmed_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE confirmed_at = VALUES(confirmed_at)',
    recipient.reader_name,
    new Date().toISOString(),
  );

  return NextResponse.json(await getRecipientSections(recipient.reader_name));
}
