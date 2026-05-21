import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import StatusBadge from './StatusBadge.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import AttachmentPlayer from './AttachmentPlayer.jsx';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export default function SectionPreviewModal({ post, writer, onClose }) {
  const [emailStatus, setEmailStatus] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="letter-panel w-full max-w-2xl my-auto shadow-[0_20px_60px_rgba(0,0,0,0.95)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — matches ConfirmModal pattern */}
        <div className="p-6 pb-4 border-b border-[rgba(232,168,76,0.1)]">
          <p className="eyebrow text-[0.6rem] mb-1.5">Section preview</p>
          <h3 className="text-lg font-serif text-[var(--parchment)]">{post.title}</h3>
          <p className="text-xs text-[var(--parchment-40)] mt-1">
            Recipients: {post.readerNames.join(', ')}
          </p>
        </div>

        {/* Scrollable content — reader portal simulation */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          <div
            className="text-[var(--parchment-70)] leading-[1.85] font-serif text-base wysiwyg-output"
            dangerouslySetInnerHTML={{ __html: post.text }}
          />

          {photos.length > 0 && (
            <div className="pt-5 border-t border-[rgba(232,168,76,0.08)] space-y-3">
              <p className="eyebrow text-[0.6rem]">Photos</p>
              <PhotoGallery photos={photos} />
            </div>
          )}

          {others.length > 0 && (
            <div className="pt-5 border-t border-[rgba(232,168,76,0.08)] space-y-3">
              <p className="eyebrow text-[0.6rem]">Attachments</p>
              <div className="grid gap-3">
                {others.map((file, idx) => (
                  <AttachmentPlayer key={idx} file={file} onDownload={() => {}} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — matches ConfirmModal pattern */}
        <div className="px-6 py-4 border-t border-[rgba(232,168,76,0.08)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={sendPreview}
            disabled={emailStatus === 'sending' || emailStatus === 'sent'}
            className="btn-flat text-xs disabled:opacity-40"
          >
            {emailStatus === 'sending' ? 'Sending…'
              : emailStatus === 'sent' ? '✓ Sent to your email'
              : emailStatus === 'error' ? 'Failed — try again'
              : 'Send to my email'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="letter-btn-primary px-4 py-2 text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(content, document.body) : null;
}
