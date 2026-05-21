import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  function show(message, tone = 'success') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function dismiss(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, show, dismiss };
}

export default function ToastContainer({ toasts, onDismiss }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !toasts.length) return null;

  const content = (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          style={{ pointerEvents: 'auto' }}
          className={`
            flex items-center gap-3 px-5 py-3 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]
            border text-sm font-medium cursor-pointer
            animate-[fadeSlideUp_0.25s_ease_forwards]
            ${t.tone === 'error'
              ? 'bg-[var(--crimson-bg)] border-[var(--crimson-border)] text-[var(--crimson-bright)]'
              : 'bg-[#141408] border-[rgba(232,168,76,0.3)] text-[var(--parchment)]'
            }
          `}
        >
          <span className={t.tone === 'error' ? 'text-[var(--crimson-bright)]' : 'text-[var(--amber)]'}>
            {t.tone === 'error' ? '✕' : '✓'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
