import { useEffect, useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import Logo from './Logo.jsx';

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function BlogDashboard({
  posts,
  readers,
  confirmedReaders = [],
  trustedReaders = [],
  unlockThreshold = 0,
  storedUnlockThreshold = null,
  onSaveUnlockThreshold,
  dms = null,
  dmzUnlocked = false,
  onSaveDmsConfig,
  onCreateReader,
  onCreatePost,
  onEditPost,
  onDeletePost,
  onDeleteReader,
  onResetConfirmations,
}) {
  const [activeTab, setActiveTab] = useState('sections');
  const [selectedPost, setSelectedPost] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'post'|'reader', id, name }

  const totalPasscodes = readers.reduce((t, r) => t + r.passcodes.length, 0);
  const confirmedTrustedCount = trustedReaders.filter(
    (n) => confirmedReaders.some((c) => c.trim().toLowerCase() === n.trim().toLowerCase()),
  ).length;
  const effectiveThreshold = unlockThreshold > 0 ? unlockThreshold : trustedReaders.length;
  const isVaultUnlocked = dmzUnlocked || (trustedReaders.length > 0 && confirmedTrustedCount >= effectiveThreshold);

  /* ── Single post view ─────────────────────── */
  if (selectedPost) {
    return (
      <div className="space-y-4 page-enter">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPost(null)}
            className="btn-flat flex items-center gap-2 -ml-1"
          >
            ← Back to sections
          </button>
          <button
            onClick={() => onEditPost(selectedPost)}
            className="letter-btn-primary px-5 py-2 text-sm"
          >
            Edit section
          </button>
        </div>

        <article className="letter-card p-8 md:p-12">
          <div className="flex items-start justify-between gap-6 pb-7 mb-8 border-b border-[rgba(232,168,76,0.1)]">
            <div className="space-y-2">
              <p className="eyebrow text-[0.6rem]">Letter section</p>
              <h2 className="text-3xl font-serif leading-snug">{selectedPost.title}</h2>
              <p className="text-xs text-[var(--parchment-40)]">
                Recipients:&nbsp;
                <span className="text-[var(--parchment-70)]">{selectedPost.readerNames.join(', ')}</span>
              </p>
            </div>
            <StatusBadge label={isVaultUnlocked ? 'Unlocked' : 'Sealed'} tone={isVaultUnlocked ? 'green' : 'red'} />
          </div>

          <div
            className="text-[var(--parchment-70)] leading-relaxed font-serif text-lg wysiwyg-output space-y-5"
            dangerouslySetInnerHTML={{ __html: selectedPost.text }}
          />

          {selectedPost.attachments?.length > 0 && (
            <div className="mt-12 pt-8 border-t border-[rgba(232,168,76,0.1)]">
              <p className="eyebrow text-[0.6rem] mb-4">Secured attachments</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {selectedPost.attachments.map((file, idx) => (
                  <AttachmentRow key={idx} file={file} />
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    );
  }

  /* ── Dashboard view ───────────────────────── */
  return (
    <section className="space-y-6 page-enter">
      {/* Top overview */}
      <div className="letter-card p-7 grid sm:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-2">
          <p className="eyebrow text-[0.6rem]">Creator dashboard</p>
          <h2 className="text-3xl font-serif">Letter access control</h2>
          <p className="text-sm text-[var(--parchment-70)] leading-relaxed max-w-2xl">
            Configure sealed letter sections, assign recipients as keyholders or beneficiaries,
            and monitor vault release state.
          </p>
          {trustedReaders.length > 0 && (
            <ThresholdControl
              trustedCount={trustedReaders.length}
              effectiveThreshold={effectiveThreshold}
              storedThreshold={storedUnlockThreshold}
              confirmedCount={confirmedTrustedCount}
              onSave={onSaveUnlockThreshold}
            />
          )}
          <DeadManControl dms={dms} dmzUnlocked={dmzUnlocked} onSave={onSaveDmsConfig} />
          {confirmedReaders.length > 0 && (
            <div className="pt-2">
              <button
                onClick={onResetConfirmations}
                className="letter-btn-danger px-4 py-2 text-xs font-bold"
              >
                Re-lock vault (reset confirmations)
              </button>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="flex sm:flex-col gap-6 sm:gap-5 sm:items-end">
          <StatusBadge label={isVaultUnlocked ? 'Vault unlocked' : 'Vault sealed'} tone={isVaultUnlocked ? 'green' : 'red'} />
          <div className="flex gap-6 sm:gap-5">
            {[['Recipients', readers.length], ['Passcodes', totalPasscodes], ['Sections', posts.length]].map(
              ([label, value]) => (
                <div key={label} className="stat-block text-center mb-2">
                  <span className="stat-number">{value}</span>
                  <span className="stat-label block">{label}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(232,168,76,0.1)]">
        {[
          { key: 'sections', label: `Sections (${posts.length})` },
          { key: 'recipients', label: `Recipients (${readers.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all font-[var(--font-display)] ${
              activeTab === key
                ? 'border-[var(--amber)] text-[var(--parchment)]'
                : 'border-transparent text-[var(--parchment-40)] hover:text-[var(--parchment-70)]'
            }`}
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.15em' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'sections' ? (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-serif">Letter sections</h3>
              <p className="text-xs text-[var(--parchment-40)] mt-0.5">
                {trustedReaders.length > 0
                  ? `Sections unlock once ${effectiveThreshold} of ${trustedReaders.length} keyholder${trustedReaders.length === 1 ? '' : 's'} confirm${effectiveThreshold === 1 ? 's' : ''}.`
                  : 'Add a keyholder to enable vault unlock.'}
              </p>
            </div>
            <button
              onClick={onCreatePost}
              disabled={readers.length === 0}
              className="letter-btn-primary px-5 py-2.5 text-sm self-start sm:self-auto"
            >
              + New section
            </button>
          </div>

          {posts.length === 0 ? (
            <EmptyState
              title="No letter sections yet"
              body={
                readers.length === 0
                  ? 'First create a recipient in the Recipients tab, then compose your first section.'
                  : 'Create your first sealed letter section above.'
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <SectionCard
                  key={post.id}
                  post={post}
                  isVaultUnlocked={isVaultUnlocked}
                  onSelect={() => setSelectedPost(post)}
                  onDelete={() => setConfirmDelete({ type: 'post', id: post.id, name: post.title })}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-serif">Configured recipients</h3>
              <p className="text-xs text-[var(--parchment-40)] mt-0.5">
                Keyholders must confirm with their passcode; beneficiaries read once unlocked.
              </p>
            </div>
            <button
              onClick={onCreateReader}
              className="letter-btn-ghost px-5 py-2.5 text-sm self-start sm:self-auto"
            >
              + Add recipient
            </button>
          </div>

          {readers.length === 0 ? (
            <EmptyState
              title="No recipients yet"
              body="Create a recipient keyholder to begin setting up secure access for your letters."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {readers.map((reader) => (
                <RecipientCard
                  key={reader.id}
                  reader={reader}
                  onDelete={() => setConfirmDelete({ type: 'reader', id: reader.id, name: reader.readerName })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${confirmDelete.type === 'post' ? 'section' : 'recipient'}?`}
          message={`"${confirmDelete.name}" will be permanently deleted and cannot be recovered.`}
          onConfirm={() => {
            if (confirmDelete.type === 'post') onDeletePost(confirmDelete.id);
            else onDeleteReader(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </section>
  );
}

function SectionCard({ post, isVaultUnlocked, onSelect, onDelete }) {
  return (
    <article
      className={`letter-card flex flex-col justify-between group ${
        isVaultUnlocked ? 'letter-card-unlocked' : 'letter-card-locked'
      }`}
    >
      <div className="p-6 space-y-3 cursor-pointer" onClick={onSelect}>
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-base font-serif leading-snug group-hover:text-[var(--amber)] transition-colors">
            {post.title}
          </h4>
          <StatusBadge label={isVaultUnlocked ? 'Open' : 'Sealed'} tone={isVaultUnlocked ? 'green' : 'red'} />
        </div>

        <p className="text-xs text-[var(--parchment-40)]">
          {post.readerNames.join(', ')}
        </p>

        <p className="text-sm text-[var(--parchment-70)] font-serif leading-relaxed line-clamp-3">
          {stripHtml(post.text).substring(0, 110)}…
        </p>
      </div>

      <div className="px-6 pb-4 pt-3 border-t border-[rgba(232,168,76,0.08)] flex items-center justify-between">
        <span className="text-[10px] font-mono text-[var(--parchment-40)]">{post.createdAt}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="btn-flat-danger text-xs px-2 py-1"
          title="Delete section"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function RecipientCard({ reader, onDelete }) {
  return (
    <div className="letter-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-serif text-base text-[var(--parchment)]">{reader.readerName}</p>
          <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
            {reader.isTrusted ? (
              <span className="text-[var(--amber)]">Keyholder</span>
            ) : (
              <span className="text-[var(--parchment-40)]">Beneficiary</span>
            )}
          </p>
        </div>
        <StatusBadge label={`${reader.passcodeCount ?? 1} key`} tone="amber" />
      </div>

      <hr className="letter-rule" />

      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--parchment-40)] mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              Passcode
            </p>
            <code className="rounded border border-[var(--amber-border)] bg-[var(--amber-subtle)] px-3 py-1.5 text-xs text-[var(--amber)] font-mono">
              {reader.passcodesDisplay?.[0] ?? '••••••••'}
            </code>
          </div>
          {reader.email && (
            <p className="text-[10px] text-[var(--parchment-40)] truncate" title={reader.email}>
              ✉ {reader.email}
            </p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="btn-flat-danger text-xs px-2 py-1 flex-shrink-0"
          title="Delete recipient"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AttachmentRow({ file }) {
  function download() {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] p-3.5 text-xs">
      <span className="text-[var(--parchment-70)] font-medium truncate">
        {file.name}&nbsp;
        <span className="text-[var(--parchment-40)]">({(file.size / 1024).toFixed(1)} KB)</span>
      </span>
      <button
        type="button"
        onClick={download}
        className="btn-amber"
      >
        Download
      </button>
    </div>
  );
}

function DeadManControl({ dms, dmzUnlocked, onSave }) {
  const [inactivityDays, setInactivityDays] = useState(dms?.inactivityDays ?? 90);
  const [graceDays, setGraceDays] = useState(dms?.graceDays ?? 30);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setInactivityDays(dms?.inactivityDays ?? 90);
    setGraceDays(dms?.graceDays ?? 30);
  }, [dms]);

  async function handleSave() {
    setSaving(true);
    setMsg('');
    const err = await onSave({ inactivityDays: Number(inactivityDays), graceDays: Number(graceDays) });
    setSaving(false);
    setMsg(err || 'Saved.');
  }

  const lastActive = dms?.lastActiveAt ? new Date(dms.lastActiveAt) : null;
  const warningSent = dms?.warningSentAt ? new Date(dms.warningSentAt) : null;

  function daysAgo(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function daysUntilWarning() {
    if (!lastActive) return null;
    const elapsed = daysAgo(lastActive);
    return Math.max(0, inactivityDays - elapsed);
  }

  function daysUntilUnlock() {
    if (!warningSent) return null;
    const elapsed = daysAgo(warningSent);
    return Math.max(0, graceDays - elapsed);
  }

  const status = dmzUnlocked
    ? { label: 'Vault opened automatically', tone: 'green' }
    : warningSent
    ? { label: `Warning sent — auto-unlock in ${daysUntilUnlock()} day${daysUntilUnlock() === 1 ? '' : 's'}`, tone: 'red' }
    : lastActive
    ? { label: `Active — warning in ${daysUntilWarning()} day${daysUntilWarning() === 1 ? '' : 's'}`, tone: 'amber' }
    : { label: 'Not yet activated (log in to start)', tone: 'dim' };

  const toneClass = {
    green: 'text-[var(--color-sage)]',
    red: 'text-[var(--color-garnet)]',
    amber: 'text-[var(--amber)]',
    dim: 'text-[var(--parchment-40)]',
  }[status.tone];

  return (
    <div className="pt-3 mt-2 border-t border-[rgba(232,168,76,0.08)] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow text-[0.58rem]">Dead-man's switch</p>
        <span className={`text-[11px] font-medium ${toneClass}`}>{status.label}</span>
      </div>

      {!dmzUnlocked && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="text-xs text-[var(--parchment-70)] flex items-center gap-2">
              Warn after
              <input
                type="number"
                min={1}
                max={3650}
                value={inactivityDays}
                onChange={(e) => setInactivityDays(e.target.value)}
                className="w-16 rounded border border-[var(--amber-border)] bg-[var(--ink-2)] px-2 py-1 text-sm text-[var(--parchment)] font-mono"
              />
              days of inactivity
            </label>
            <label className="text-xs text-[var(--parchment-70)] flex items-center gap-2">
              Auto-unlock after
              <input
                type="number"
                min={1}
                max={365}
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                className="w-16 rounded border border-[var(--amber-border)] bg-[var(--ink-2)] px-2 py-1 text-sm text-[var(--parchment)] font-mono"
              />
              more days
            </label>
            <button
              onClick={handleSave}
              disabled={saving}
              className="letter-btn-primary px-3 py-1 text-xs disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <p className="text-[11px] text-[var(--parchment-40)] leading-relaxed">
            If you don't log in for <strong className="text-[var(--parchment-70)]">{inactivityDays} days</strong>, we'll email you a check-in link.
            If you don't respond within <strong className="text-[var(--parchment-70)]">{graceDays} more days</strong>, the vault opens automatically
            and your letters are delivered. Logging in at any time resets the timer.
          </p>
          {msg && <p className="text-[11px] text-[var(--amber)]">{msg}</p>}
        </div>
      )}

      {dmzUnlocked && (
        <p className="text-[11px] text-[var(--parchment-40)]">
          The dead-man's switch triggered. All recipients have been notified and the vault is now open.
        </p>
      )}
    </div>
  );
}

function ThresholdControl({ trustedCount, effectiveThreshold, storedThreshold, confirmedCount, onSave }) {
  const [value, setValue] = useState(effectiveThreshold);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Keep input in sync if threshold updates from server (e.g. keyholders added/removed)
  useEffect(() => {
    setValue(effectiveThreshold);
  }, [effectiveThreshold]);

  async function handleSave() {
    setSaving(true);
    setMsg('');
    const err = await onSave(Number(value));
    setSaving(false);
    setMsg(err || 'Saved.');
  }

  async function handleReset() {
    setSaving(true);
    setMsg('');
    const err = await onSave(null);
    setSaving(false);
    setMsg(err || 'Reset to default (majority).');
  }

  const isDirty = Number(value) !== effectiveThreshold;
  const isDefault = storedThreshold == null;

  return (
    <div className="pt-3 mt-2 border-t border-[rgba(232,168,76,0.08)] space-y-2">
      <p className="eyebrow text-[0.58rem]">Unlock threshold (M-of-N)</p>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-[var(--parchment-70)] flex items-center gap-2">
          Require
          <input
            type="number"
            min={1}
            max={trustedCount}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-16 rounded border border-[var(--amber-border)] bg-[var(--ink-2)] px-2 py-1 text-sm text-[var(--parchment)] font-mono"
          />
          of {trustedCount} keyholder{trustedCount === 1 ? '' : 's'}
        </label>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty || Number(value) < 1 || Number(value) > trustedCount}
          className="letter-btn-primary px-3 py-1 text-xs disabled:opacity-40"
        >
          Save
        </button>
        {!isDefault && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="btn-flat text-xs"
            title="Reset to majority default"
          >
            Reset
          </button>
        )}
      </div>
      <p className="text-[11px] text-[var(--parchment-40)]">
        {confirmedCount} of {effectiveThreshold} required confirmation{effectiveThreshold === 1 ? '' : 's'} received.
        {isDefault && ' Currently using majority default.'}
      </p>
      {msg && <p className="text-[11px] text-[var(--amber)]">{msg}</p>}
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="letter-card p-12 text-center border-dashed">
      <div className="seal-mark mx-auto mb-5 opacity-30"><Logo size={26} className="text-[var(--amber)]" /></div>
      <h3 className="text-base font-serif text-[var(--parchment)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--parchment-40)] max-w-xs mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
