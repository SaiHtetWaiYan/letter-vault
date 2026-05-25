import { NextResponse } from 'next/server';
import {
  getDmsCheckList,
  markWarningSent,
  markDmzUnlocked,
  getWriterRecipients,
  getSectionsToRelease,
  markSectionReleased,
  getSectionRecipients,
  applyRelativeReleaseDates,
  getVaultUnlockStatus,
  createHeartbeatToken,
} from '../../../../lib/db.js';
import {
  sendEmail,
  buildWarningEmail,
  buildRecipientUnlockEmail,
  buildScheduledReleaseEmail,
} from '../../../../lib/email.js';

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function POST(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });
  }

  // Prevent abuse even with valid secret — max 5 calls per minute
  const { rateLimit } = await import('../../../../lib/rateLimit.js');
  const limited = await rateLimit(request, 'cron-check', { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const now = new Date();
  const results = { warned: [], unlocked: [], skipped: [], sectionsReleased: [] };

  // ── 1. Dead-man's switch checks ───────────────────────────────────────────
  const writers = await getDmsCheckList();

  for (const writer of writers) {
    const lastActive = writer.last_active_at ? new Date(writer.last_active_at) : null;
    const warningSent = writer.warning_sent_at ? new Date(writer.warning_sent_at) : null;
    const inactivityMs = writer.inactivity_days * 24 * 60 * 60 * 1000;
    const graceMs = writer.grace_days * 24 * 60 * 60 * 1000;

    if (!lastActive) { results.skipped.push(writer.email); continue; }

    const inactiveSince = now - lastActive;

    if (warningSent) {
      const graceSince = now - warningSent;
      if (graceSince >= graceMs) {
        await markDmzUnlocked(writer.id);

        // Set release dates for relative-delay sections using now as anchor
        await applyRelativeReleaseDates(writer.id, now);

        // Check if keyholders still need to confirm
        const vaultStatus = await getVaultUnlockStatus(writer.id);
        const hasKeyholders = !vaultStatus.isUnlocked && vaultStatus.threshold > 0;

        // Notify all recipients with emails
        const recipients = await getWriterRecipients(writer.id);
        await Promise.allSettled(
          recipients.filter((r) => r.email).map((r) => {
            const { subject, html } = buildRecipientUnlockEmail({
              writerName: writer.name,
              readerName: r.readerName,
              triggeredByDms: true,
              needsKeyholder: hasKeyholders && r.isTrusted,
            });
            return sendEmail({ to: r.email, subject, html });
          }),
        );

        results.unlocked.push(writer.email);
      }
      continue;
    }

    if (inactiveSince >= inactivityMs) {
      const heartbeatToken = await createHeartbeatToken(writer.id);
      const { subject, html } = buildWarningEmail({
        writerName: writer.name,
        heartbeatToken,
        graceDays: writer.grace_days,
      });
      await sendEmail({ to: writer.email, subject, html });
      await markWarningSent(writer.id);
      results.warned.push(writer.email);
    } else {
      results.skipped.push(writer.email);
    }
  }

  // ── 2. Scheduled section release checks ──────────────────────────────────
  const sectionsToRelease = await getSectionsToRelease();

  for (const section of sectionsToRelease) {
    await markSectionReleased(section.id);

    // Notify assigned recipients who have email addresses
    const sectionRecipients = await getSectionRecipients(section.id);
    await Promise.allSettled(
      sectionRecipients.filter((r) => r.email).map((r) => {
        const { subject, html } = buildScheduledReleaseEmail({
          writerName: section.writer_name,
          readerName: r.readerName,
          sectionTitle: section.title,
        });
        return sendEmail({ to: r.email, subject, html });
      }),
    );

    results.sectionsReleased.push({ id: section.id, title: section.title });
  }

  return NextResponse.json({ ok: true, ...results });
}
