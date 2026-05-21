import { useEffect, useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import AttachmentPlayer from './AttachmentPlayer.jsx';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

function stripHtml(html) {
  return html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

export default function SectionPreviewModal({ post, writer, onClose }) {
  const [emailStatus, setEmailStatus] = useState(''); // '' | 'sending' | 'sent' | 'error'

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function sendPreview() {
    setEmailStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/writers/${writer.id}/preview-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: post.id }),
      });
      setEmailStatus(res.ok ? 'sent' : 'error');
    } catch {
      setEmailStatus('error');
    }
  }

  const photos = post.attachments?.filter(f => f.type?.startsWith('image/')) || [];
  const others = post.attachments?.filter(f => !f.type?.startsWith('image/')) || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Preview badge bar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--amber)] border border-[rgba(232,168,76,0.3)] rounded-full px-3 py-1">
              👁 Preview — creator only
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Send to email button */}
            <button
              type="button"
              onClick={sendPreview}
              disabled={emailStatus === 'sending' || emailStatus === 'sent'}
              className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(232,168,76,0.2)] text-[var(--parchment-70)] hover:text-[var(--amber)] hover:border-[rgba(232,168,76,0.4)] transition-all disabled:opacity-40"
            >
              {emailStatus === 'sending' ? 'Sending…'
                : emailStatus === 'sent' ? '✓ Sent to your email'
                : emailStatus === 'error' ? '✕ Failed — try again'
                : '✉ Send to my email'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[var(--parchment-40)] hover:text-[var(--parchment)] transition-colors text-base"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Simulated reader portal view */}
        <article className="letter-card p-8 md:p-12 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 pb-7 border-b border-[rgba(232,168,76,0.1)]">
            <div className="space-y-1.5">
              <p className="eyebrow text-[0.6rem]">Letter section</p>
              <h1 className="text-3xl md:text-4xl font-serif leading-snug">{post.title}</h1>
              <p className="text-xs text-[var(--parchment-40)]">{post.createdAt}</p>
            </div>
            <StatusBadge label="Unlocked" tone="green" />
          </div>

          {/* Body */}
          <div
            className="text-[var(--parchment-70)] leading-[1.85] font-serif text-lg wysiwyg-output"
            dangerouslySetInnerHTML={{ __html: post.text }}
          />

          {/* Photos */}
          {photos.length > 0 && (
            <div className="pt-8 border-t border-[rgba(232,168,76,0.1)] space-y-3">
              <p className="eyebrow text-[0.6rem]">Photos</p>
              <PhotoGallery photos={photos} />
            </div>
          )}

          {/* Other attachments */}
          {others.length > 0 && (
            <div className="pt-8 border-t border-[rgba(232,168,76,0.1)] space-y-3">
              <p className="eyebrow text-[0.6rem]">Attachments</p>
              <div className="grid gap-3">
                {others.map((file, idx) => (
                  <AttachmentPlayer key={idx} file={file} onDownload={() => {}} />
                ))}
              </div>
            </div>
          )}
        </article>

        <p className="text-center text-[11px] text-[var(--parchment-40)] mt-4">
          Recipients: {post.readerNames.join(', ')} · Click outside or press Esc to close
        </p>
      </div>
    </div>
  );
}
