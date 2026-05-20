import { useState } from 'react';
import WysiwygEditor from './WysiwygEditor.jsx';

export default function CreatePostForm({ readers, onSave, onCancel, post }) {
  const [selectedReaders, setSelectedReaders] = useState(
    post ? post.readerNames : readers[0] ? [readers[0].readerName] : [],
  );
  const [title, setTitle] = useState(post ? post.title : '');
  const [text, setText] = useState(post ? post.text : '');
  const [attachments, setAttachments] = useState(post ? post.attachments || [] : []);
  const [error, setError] = useState('');

  function toggleReader(readerName) {
    setSelectedReaders((prev) =>
      prev.includes(readerName) ? prev.filter((r) => r !== readerName) : [...prev, readerName],
    );
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setAttachments((current) => [
            ...current,
            { name: file.name, type: file.type, size: file.size, data: e.target.result },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments((current) => current.filter((_, i) => i !== index));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selectedReaders.length === 0 || !title.trim() || !text.trim()) {
      setError('Please select at least one recipient and fill in the title and body.');
      return;
    }
    onSave({
      id: post ? post.id : undefined,
      readerNames: selectedReaders,
      title: title.trim(),
      summary: '',
      text: text.trim(),
      attachments,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 page-enter">
      <div className="letter-card p-8 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[rgba(232,168,76,0.1)]">
          <div>
            <p className="eyebrow text-[0.6rem] mb-1.5">Letter section</p>
            <h2 className="text-2xl font-serif">{post ? 'Edit section' : 'New section'}</h2>
            <p className="mt-1.5 text-xs text-[var(--parchment-40)] leading-relaxed max-w-sm">
              Select which recipients can access this section. It stays sealed until every
              assigned keyholder confirms.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="btn-flat flex-shrink-0"
          >
            Cancel
          </button>
        </div>

        {/* Recipient checkboxes */}
        <div className="space-y-3">
          <p className="eyebrow-dim">Assigned recipients</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {readers.map((reader) => {
              const isSelected = selectedReaders.includes(reader.readerName);
              return (
                <label
                  key={reader.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[var(--amber)] bg-[var(--amber-subtle)]'
                      : 'border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] hover:border-[rgba(232,168,76,0.25)]'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--parchment)]">
                      {reader.readerName}
                    </span>
                    <span className="text-[10px]" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {reader.isTrusted ? (
                        <span className="text-[var(--amber)]">Keyholder</span>
                      ) : (
                        <span className="text-[var(--parchment-40)]">Beneficiary</span>
                      )}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleReader(reader.readerName)}
                    className="h-4 w-4 accent-[var(--amber)]"
                  />
                </label>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="eyebrow-dim">Section title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Final wishes"
            className="vault-input px-4 py-3 text-sm outline-none"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="eyebrow-dim">Letter body</label>
          <WysiwygEditor
            value={text}
            onChange={setText}
            placeholder="Write the letter text recipients will read after all assigned keyholders confirm…"
          />
        </div>

        {/* Attachments */}
        <div className="space-y-3 pt-1 border-t border-[rgba(232,168,76,0.1)]">
          <div>
            <p className="eyebrow-dim">Secure attachments</p>
            <p className="text-xs text-[var(--parchment-40)] mt-1">
              Files are stored with the section and downloadable only after unlock.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(232,168,76,0.15)] bg-[var(--ink-2)] p-7 hover:border-[rgba(232,168,76,0.3)] transition cursor-pointer">
            <span className="text-2xl">📎</span>
            <span className="text-sm font-semibold text-[var(--parchment-70)]">Click to upload files</span>
            <span className="text-[11px] text-[var(--parchment-40)]">Any file type · up to 10 MB</span>
            <input type="file" multiple onChange={handleFileChange} className="hidden" />
          </label>

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] p-3"
                >
                  <div className="truncate min-w-0">
                    <p className="text-xs font-semibold text-[var(--parchment)] truncate">{file.name}</p>
                    <p className="text-[10px] text-[var(--parchment-40)]">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="letter-btn-danger px-3 py-1.5 text-xs font-bold flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--crimson-border)] bg-[var(--crimson-bg)] px-4 py-3 text-xs font-semibold text-[var(--crimson-bright)]">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="letter-btn-primary px-7 py-3 text-sm">
          Save section →
        </button>
      </div>
    </form>
  );
}
