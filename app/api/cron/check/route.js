import { NextResponse } from 'next/server';
import {
  getDmsCheckList,
  markWarningSent,
  markDmzUnlocked,
  getWriterRecipients,
} from '../../../../lib/db.js';
import { sendEmail, buildWarningEmail, buildUnlockEmail } from '../../../../lib/email.js';

// Protect the endpoint with a shared secret so only your cron job can call it.
// Set CRON_SECRET in .env and pass it as: Authorization: Bearer <secret>
function isAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — open (dev only)
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function POST(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });
  }

  const now = new Date();
  const writers = await getDmsCheckList();

  const results = { warned: [], unlocked: [], skipped: [] };

  for (const writer of writers) {
    const lastActive = writer.last_active_at ? new Date(writer.last_active_at) : null;
    const warningSent = writer.warning_sent_at ? new Date(writer.warning_sent_at) : null;
    const inactivityMs = writer.inactivity_days * 24 * 60 * 60 * 1000;
    const graceMs = writer.grace_days * 24 * 60 * 60 * 1000;

    // If the creator has never logged in, skip (they haven't activated DMS yet)
    if (!lastActive) {
      results.skipped.push(writer.email);
      continue;
    }

    const inactiveSince = now - lastActive;

    // Phase 2: Warning already sent — check if grace period expired → auto-unlock
    if (warningSent) {
      const graceSince = now - warningSent;
      if (graceSince >= graceMs) {
        await markDmzUnlocked(writer.id);

        // Notify all recipients
        const recipients = await getWriterRecipients(writer.id);
        const { subject, html } = buildUnlockEmail({ writerName: writer.name });
        // We don't store recipient emails yet — notify placeholder (future feature)
        // For now, just log. When recipient emails are added this loop sends to each.
        for (const r of recipients) {
          if (r.email) {
            await sendEmail({ to: r.email, subject, html });
          }
        }

        results.unlocked.push(writer.email);
      }
      continue;
    }

    // Phase 1: No warning yet — check if inactivity period expired → send warning
    if (inactiveSince >= inactivityMs) {
      const { subject, html } = buildWarningEmail({
        writerName: writer.name,
        heartbeatToken: writer.heartbeat_token,
        graceDays: writer.grace_days,
      });
      await sendEmail({ to: writer.email, subject, html });
      await markWarningSent(writer.id);
      results.warned.push(writer.email);
    } else {
      results.skipped.push(writer.email);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
