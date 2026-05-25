import { NextResponse } from 'next/server';
import {
  getDmsCheckList,
  markWarningSent,
  markKeyholdersNotified,
  clearKeyholdersNotified,
  forceUnlock,
  markDmzUnlocked,
  getWriterRecipients,
  getSectionsToRelease,
  markSectionReleased,
  getSectionRecipients,
  applyRelativeReleaseDates,
  getVaultUnlockStatus,
  getTrustedCount,
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
  const results = {
    warned: [],
    keyholdersNotified: [],
    unlocked: [],
    skipped: [],
    sectionsReleased: [],
  };

  // ── 1. Dead-man's switch checks ───────────────────────────────────────────
  const writers = await getDmsCheckList();

  for (const writer of writers) {
    const lastActive = writer.last_active_at ? new Date(writer.last_active_at) : null;
    const warningSent = writer.warning_sent_at ? new Date(writer.warning_sent_at) : null;
    const dmzUnlockedAt = writer.dmz_unlocked_at ? new Date(writer.dmz_unlocked_at) : null;
    const keyholdersNotifiedAt = writer.keyholders_notified_at ? new Date(writer.keyholders_notified_at) : null;
    const inactivityMs = writer.inactivity_days * 24 * 60 * 60 * 1000;
    const graceMs = writer.grace_days * 24 * 60 * 60 * 1000;
    const keyholderGraceMs = (writer.keyholder_grace_days ?? 14) * 24 * 60 * 60 * 1000;

    // ── PHASE A: Vault is fully unlocked + keyholders were notified → check final auto-unlock window ──
    if (dmzUnlockedAt && keyholdersNotifiedAt) {
      // Already in keyholder confirmation window. Check if expired.
      const vaultStatus = await getVaultUnlockStatus(writer.id);
      if (vaultStatus.isUnlocked) {
        // Keyholders confirmed — vault is open. Clear the notified flag so we don't recheck.
        await clearKeyholdersNotified(writer.id);
        continue;
      }

      const sinceKeyholderNotify = now - keyholdersNotifiedAt;
      if (sinceKeyholderNotify >= keyholderGraceMs) {
        // Keyholders never confirmed — force unlock and notify all recipients (including beneficiaries)
        await forceUnlock(writer.id);
        await clearKeyholdersNotified(writer.id);
        await notifyAllOnUnlock(writer, { forced: true });
        results.unlocked.push(writer.email + ' (forced)');
      }
      continue;
    }

    if (!lastActive) { results.skipped.push(writer.email); continue; }

    const inactiveSince = now - lastActive;

    // ── PHASE B: Warning was sent → check if grace period expired (DMS should fire) ──
    if (warningSent && !dmzUnlockedAt) {
      const graceSince = now - warningSent;
      if (graceSince >= graceMs) {
        // DMS fires — mark vault as ready to unlock, but DON'T unlock yet if there are keyholders
        await markDmzUnlocked(writer.id);
        await applyRelativeReleaseDates(writer.id, now);

        const trustedCount = await getTrustedCount(writer.id);

        if (trustedCount === 0) {
          // No keyholders — unlock immediately and notify all
          await notifyAllOnUnlock(writer, { forced: false });
          results.unlocked.push(writer.email);
        } else {
          // Notify keyholders ONLY — beneficiaries wait until vault opens
          await markKeyholdersNotified(writer.id);
          await notifyKeyholdersOnly(writer);
          results.keyholdersNotified.push(writer.email);
        }
      }
      continue;
    }

    // ── PHASE C: First inactivity check → send warning email ──
    if (!warningSent && inactiveSince >= inactivityMs) {
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

// Notify keyholders only — first stage when DMS fires and keyholders exist
async function notifyKeyholdersOnly(writer) {
  const recipients = await getWriterRecipients(writer.id);
  await Promise.allSettled(
    recipients
      .filter((r) => r.email && r.isTrusted)
      .map((r) => {
        const { subject, html } = buildRecipientUnlockEmail({
          writerName: writer.name,
          readerName: r.readerName,
          triggeredByDms: true,
          needsKeyholder: true,
        });
        return sendEmail({ to: r.email, subject, html });
      }),
  );
}

// Notify all recipients on full vault unlock
async function notifyAllOnUnlock(writer, { forced }) {
  const recipients = await getWriterRecipients(writer.id);
  await Promise.allSettled(
    recipients.filter((r) => r.email).map((r) => {
      const { subject, html } = buildRecipientUnlockEmail({
        writerName: writer.name,
        readerName: r.readerName,
        triggeredByDms: true,
        needsKeyholder: false,
        forced,
      });
      return sendEmail({ to: r.email, subject, html });
    }),
  );
}
