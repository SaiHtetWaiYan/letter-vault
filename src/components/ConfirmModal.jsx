import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmModal({ title, message, onConfirm, onCancel }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="letter-panel w-full max-w-md p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)]">
        <p className="eyebrow text-[0.6rem] mb-1.5">Confirm action</p>
        <h3 className="text-lg font-serif text-[var(--parchment)] pb-4 border-b border-[rgba(232,168,76,0.1)]">
          {title}
        </h3>

        <p className="mt-4 text-sm text-[var(--parchment-70)] leading-relaxed">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[rgba(232,168,76,0.08)]">
          <button
            type="button"
            onClick={onCancel}
            className="btn-flat text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="letter-btn-danger px-4 py-2 text-xs font-bold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
