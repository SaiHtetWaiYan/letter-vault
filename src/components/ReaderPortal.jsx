import { useState } from 'react';
import StatusBadge from './StatusBadge';
import Logo from './Logo.jsx';
import AttachmentPlayer from './AttachmentPlayer.jsx';
import PhotoGallery from './PhotoGallery.jsx';

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function ReaderPortal({ readerName, posts, confirmedReaders, trustedReaders = [], unlockThreshold = 0, dmzUnlocked = false, onLogout }) {
  const [selectedPost, setSelectedPost] = useState(null);

  const confirmedTrustedCount = trustedReaders.filter(
    (n) => confirmedReaders.some((c) => c.trim().toLowerCase() === n.trim().toLowerCase()),
  ).length;
  const threshold = unlockThreshold > 0 ? unlockThreshold : trustedReaders.length;
  // Vault unlocks only when BOTH conditions are met:
  // 1. Dead-man's switch has fired (creator is unreachable)
  // 2. Required keyholders have confirmed (M-of-N threshold met)
  // If there are no keyholders, DMS alone unlocks the vault.
  const thresholdMet = trustedReaders.length > 0 && confirmedTrustedCount >= threshold;
  const isVaultUnlocked = trustedReaders.length === 0
    ? dmzUnlocked
    : dmzUnlocked && thresholdMet;

  function isSectionReadable(section) {
    if (isVaultUnlocked) return true;
    if (section.releasedAt) return true;
    if (section.releaseDate && new Date(section.releaseDate) <= new Date()) return true;
    return false;
  }

  function sectionReleaseLabel(section) {
    if (section.releaseDelayDays && !section.releaseDate) {
      return `Opens ${section.releaseDelayDays} days after vault unlocks`;
    }
    if (section.releaseDate) {
      return `Opens on ${new Date(section.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    return 'Sealed — awaiting keyholder confirmation';
  }

  function handleDownload(file) {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ── Single section view ─────────────────── */
  if (selectedPost) {
    return (
      <div className="min-h-screen page-enter">
        <SiteHeader readerName={readerName} onLogout={onLogout} />

        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          {/* Back button above article */}
          <button
            onClick={() => setSelectedPost(null)}
            className="btn-flat flex items-center gap-2 mb-5 -ml-1"
          >
            ← Back to sections
          </button>

          <article className="letter-card p-8 md:p-12 space-y-8">
            <div className="flex items-start justify-between gap-6 pb-7 border-b border-[rgba(232,168,76,0.1)]">
              <div className="space-y-1.5">
                <p className="eyebrow text-[0.6rem]">Letter section</p>
                <h1 className="text-3xl md:text-4xl font-serif leading-snug">
                  {selectedPost.title}
                </h1>
                <p className="text-xs text-[var(--parchment-40)]">{selectedPost.createdAt}</p>
              </div>
              <StatusBadge label={isSectionReadable(selectedPost) ? 'Unlocked' : 'Sealed'} tone={isSectionReadable(selectedPost) ? 'green' : 'red'} />
            </div>

            {isSectionReadable(selectedPost) ? (
              <div className="space-y-6">
                <div
                  className="text-[var(--parchment-70)] leading-[1.85] font-serif text-lg wysiwyg-output"
                  dangerouslySetInnerHTML={{ __html: selectedPost.text }}
                />
                {selectedPost.attachments?.length > 0 && (() => {
                  const photos = selectedPost.attachments.filter(f => f.type?.startsWith('image/'));
                  const others = selectedPost.attachments.filter(f => !f.type?.startsWith('image/'));
                  return (
                    <div className="pt-8 border-t border-[rgba(232,168,76,0.1)] space-y-5">
                      {photos.length > 0 && (
                        <div className="space-y-3">
                          <p className="eyebrow text-[0.6rem]">Photos</p>
                          <PhotoGallery photos={photos} />
                        </div>
                      )}
                      {others.length > 0 && (
                        <div className="space-y-3">
                          <p className="eyebrow text-[0.6rem]">Attachments</p>
                          <div className="grid gap-3">
                            {others.map((file, idx) => (
                              <AttachmentPlayer key={idx} file={file} onDownload={handleDownload} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <LockedMessage />
            )}
          </article>
        </main>
      </div>
    );
  }

  /* ── Grid view ───────────────────────────── */
  return (
    <div className="min-h-screen page-enter">
      <SiteHeader readerName={readerName} onLogout={onLogout} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10 space-y-7">
        {/* Vault status banner */}
        <div
          className={`letter-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
            isVaultUnlocked ? 'letter-card-unlocked' : 'letter-card-locked'
          }`}
        >
          <div className="space-y-1.5">
            <p className="eyebrow text-[0.6rem]">Vault release state</p>
            <h2 className="text-xl font-serif">
              {isVaultUnlocked ? 'All sections are unlocked' : 'Vault is sealed'}
            </h2>
            <p className="text-xs text-[var(--parchment-40)] leading-relaxed max-w-xl">
              {isVaultUnlocked
                ? 'The vault has been opened. Every assigned letter section is now readable.'
                : !dmzUnlocked
                  ? 'The vault is sealed. It will open when the time comes.'
                  : `Vault release triggered. Waiting for keyholders: ${confirmedTrustedCount} of ${threshold} required confirmation${threshold === 1 ? '' : 's'} received.`}
            </p>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge label={isVaultUnlocked ? 'Unlocked' : 'Sealed'} tone={isVaultUnlocked ? 'green' : 'red'} />
          </div>
        </div>

        {/* Sections grid */}
        {posts.length === 0 ? (
          <div className="letter-card p-12 text-center">
            <div className="seal-mark mx-auto mb-5 opacity-25"><Logo size={26} className="text-[var(--amber)]" /></div>
            <p className="text-[var(--parchment-40)] text-sm">No letter sections have been assigned to you yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {posts.map((post) => (
              <ReaderSectionCard
                key={post.id}
                post={post}
                isReadable={isSectionReadable(post)}
                releaseLabel={sectionReleaseLabel(post)}
                onSelect={() => setSelectedPost(post)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SiteHeader({ readerName, onLogout, left }) {
  return (
    <header className="border-b border-[rgba(232,168,76,0.08)] bg-[var(--ink-0)] sticky top-0 z-10 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 gap-4">

        {/* Left — branding or back button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {left ?? (
            <div className="flex items-center gap-2.5">
              <div className="seal-mark" style={{ width: 34, height: 34 }}><Logo size={20} className="text-[var(--amber)]" /></div>
              <span className="eyebrow text-[0.6rem] hidden sm:block">Letter Vault</span>
            </div>
          )}
        </div>

        {/* Centre — recipient chip */}
        <div className="flex items-center gap-2 rounded-full border border-[rgba(232,168,76,0.18)] bg-[rgba(232,168,76,0.05)] px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)] opacity-70 flex-shrink-0" />
          <span className="text-xs font-medium text-[var(--parchment-70)] tracking-wide">{readerName}</span>
        </div>

        {/* Right — log out */}
        <div className="flex-shrink-0">
          <button onClick={onLogout} className="btn-flat-danger">
            Log out
          </button>
        </div>

      </div>
    </header>
  );
}

function ReaderSectionCard({ post, isReadable, releaseLabel, onSelect }) {
  return (
    <article
      className={`letter-card flex flex-col justify-between cursor-pointer group ${
        isReadable ? 'letter-card-unlocked' : 'letter-card-locked'
      }`}
      onClick={onSelect}
    >
      <div className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-serif group-hover:text-[var(--amber)] transition-colors">
            {post.title}
          </h2>
          <StatusBadge label={isReadable ? 'Open' : 'Sealed'} tone={isReadable ? 'green' : 'red'} />
        </div>

        {isReadable ? (
          <p className="text-sm text-[var(--parchment-70)] font-serif leading-relaxed line-clamp-3">
            {stripHtml(post.text).substring(0, 130)}…
          </p>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-[rgba(232,168,76,0.1)] bg-[rgba(232,168,76,0.03)] px-4 py-3">
            <svg width="11" height="14" viewBox="0 0 11 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 opacity-40">
              <rect x="0.75" y="5.75" width="9.5" height="7.5" rx="1.25" stroke="rgba(232,168,76,0.9)" strokeWidth="1.1"/>
              <path d="M3 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="rgba(232,168,76,0.9)" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <p className="text-xs text-[var(--parchment-40)]">{releaseLabel}</p>
          </div>
        )}
      </div>

      <div className="px-6 pb-5 pt-3 border-t border-[rgba(232,168,76,0.08)] flex items-center justify-between">
        <span className="text-[10px] font-mono text-[var(--parchment-40)]">{post.createdAt}</span>
        <span className="text-[10px] text-[var(--amber)] font-semibold group-hover:underline">
          {isReadable ? 'Read →' : 'View status →'}
        </span>
      </div>
    </article>
  );
}

function LockedMessage() {
  return (
    <div className="py-14 text-center space-y-6">
      {/* SVG lock icon */}
      <div className="mx-auto flex items-center justify-center" style={{ width: 56, height: 56 }}>
        <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="20" width="32" height="26" rx="4" fill="none" stroke="rgba(232,168,76,0.25)" strokeWidth="1.5"/>
          <path d="M12 20V14a8 8 0 0 1 16 0v6" stroke="rgba(232,168,76,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="20" cy="33" r="3" fill="rgba(232,168,76,0.35)"/>
          <line x1="20" y1="36" x2="20" y2="41" stroke="rgba(232,168,76,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="space-y-2">
        <p className="eyebrow text-[0.65rem] opacity-60">Access restricted</p>
        <h3 className="text-xl font-serif text-[var(--parchment-70)]">This section is sealed</h3>
        <p className="text-xs text-[var(--parchment-40)] max-w-xs mx-auto leading-relaxed pt-1">
          The required number of keyholders must confirm with their passcode before the contents of this section are revealed.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(232,168,76,0.15)] bg-[rgba(232,168,76,0.04)] px-4 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)] opacity-50" />
        <span className="text-[11px] font-medium text-[var(--parchment-40)] tracking-wide">Waiting for keyholders</span>
      </div>
    </div>
  );
}
