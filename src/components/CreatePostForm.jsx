import { useState } from 'react';
import WysiwygEditor from './WysiwygEditor.jsx';
import DatePicker from './DatePicker.jsx';
import VoiceVideoRecorder from './VoiceVideoRecorder.jsx';

function inferReleaseMode(post) {
  if (!post) return 'global';
  if (post.releaseDelayDays) return 'delay';
  if (post.releaseDate) return 'date';
  return 'global';
}

export default function CreatePostForm({ readers, onSave, onCancel, post }) {
  const [selectedReaders, setSelectedReaders] = useState(
    post ? post.readerNames : readers[0] ? [readers[0].readerName] : [],
  );
  const [title, setTitle] = useState(post ? post.title : '');
  const [text, setText] = useState(post ? post.text : '');
  const [attachments, setAttachments] = useState(post ? post.attachments || [] : []);
  const [releaseMode, setReleaseMode] = useState(inferReleaseMode(post));
  const [releaseDate, setReleaseDate] = useState(post?.releaseDate || '');
  const [releaseDelayDays, setReleaseDelayDays] = useState(post?.releaseDelayDays || 30);
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
      releaseDate: releaseMode === 'date' ? releaseDate : null,
      releaseDelayDays: releaseMode === 'delay' ? Number(releaseDelayDays) : null,
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

        {/* Unlock condition */}
        <div className="space-y-3">
          <p className="eyebrow-dim">Unlock condition</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { value: 'global', label: 'Global unlock', desc: 'Readable when vault opens (keyholders or dead-man\'s switch)' },
              { value: 'date',   label: 'Fixed date',    desc: 'Opens on a specific calendar date regardless of vault state' },
              { value: 'delay',  label: 'After unlock',  desc: 'Opens N days after the dead-man\'s switch triggers' },
            ].map(({ value, label, desc }) => (
              <label
                key={value}
                className={`flex flex-col gap-1 rounded-lg border p-4 cursor-pointer transition-all ${
                  releaseMode === value
                    ? 'border-[var(--amber)] bg-[var(--amber-subtle)]'
                    : 'border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] hover:border-[rgba(232,168,76,0.25)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="releaseMode"
                    value={value}
                    checked={releaseMode === value}
                    onChange={() => setReleaseMode(value)}
                    className="accent-[var(--amber)]"
                  />
                  <span className="text-sm font-semibold text-[var(--parchment)]">{label}</span>
                </div>
                <p className="text-[11px] text-[var(--parchment-40)] leading-relaxed pl-5">{desc}</p>
              </label>
            ))}
          </div>

          {releaseMode === 'date' && (
            <div className="space-y-1.5">
              <label className="eyebrow-dim">Release date</label>
              <DatePicker
                value={releaseDate}
                onChange={setReleaseDate}
                min={new Date().toISOString().slice(0, 10)}
              />
              <p className="text-[11px] text-[var(--parchment-40)]">
                This section will become readable on this date, even if the vault is still sealed.
              </p>
            </div>
          )}

          {releaseMode === 'delay' && (
            <div className="space-y-1.5">
              <label className="eyebrow-dim">Delay after dead-man's switch triggers</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={releaseDelayDays}
                  onChange={(e) => setReleaseDelayDays(e.target.value)}
                  className="vault-input px-4 py-3 text-sm outline-none w-24"
                />
                <span className="text-sm text-[var(--parchment-70)]">days after unlock</span>
              </div>
              <p className="text-[11px] text-[var(--parchment-40)]">
                e.g. 365 = opens ~1 year after your dead-man's switch fires. Good for anniversary letters.
              </p>
            </div>
          )}
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

        {/* ── Media & attachments ─────────────────────────────────────────── */}
        <div className="space-y-6 pt-1 border-t border-[rgba(232,168,76,0.1)]">
          <p className="eyebrow-dim">Media &amp; attachments</p>

          {/* Photos */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--parchment-70)]">Photos</p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(232,168,76,0.15)] bg-[var(--ink-2)] p-6 hover:border-[rgba(232,168,76,0.3)] transition cursor-pointer">
              <span className="text-sm font-semibold text-[var(--parchment-70)]">Click to add photos</span>
              <span className="text-[11px] text-[var(--parchment-40)]">JPG, PNG, GIF, WebP — shown as gallery after unlock</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {/* Photo preview grid */}
            {attachments.filter(f => f.type?.startsWith('image/')).length > 0 && (
              <div className={`grid gap-2 ${
                attachments.filter(f => f.type?.startsWith('image/')).length === 1 ? 'grid-cols-1' :
                attachments.filter(f => f.type?.startsWith('image/')).length === 2 ? 'grid-cols-2' :
                'grid-cols-3'
              }`}>
                {attachments.map((file, idx) => file.type?.startsWith('image/') && (
                  <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square bg-[var(--ink-2)]">
                    <img src={file.data} alt={file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/70 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice / Video */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--parchment-70)]">Voice or video message</p>
            <VoiceVideoRecorder
              onAdd={(recording) => setAttachments((curr) => [...curr, recording])}
            />
            {attachments.filter(f => f.type?.startsWith('audio/') || f.type?.startsWith('video/')).map((file, idx) => (
              <div key={idx} className="rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] p-3 space-y-2">
                {file.type?.startsWith('audio/') && (
                  <audio controls src={file.data} className="w-full h-9" style={{ accentColor: 'var(--amber)' }} />
                )}
                {file.type?.startsWith('video/') && (
                  <video controls src={file.data} className="w-full rounded-lg max-h-40 bg-black" />
                )}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[var(--parchment)] truncate">
                    {file.type?.startsWith('audio/') ? '🎙 ' : '🎬 '}{file.name}
                  </p>
                  <button type="button" onClick={() => removeAttachment(attachments.indexOf(file))} className="letter-btn-danger px-3 py-1.5 text-xs font-bold flex-shrink-0">Remove</button>
                </div>
              </div>
            ))}
          </div>

          {/* Other files */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--parchment-70)]">Files</p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(232,168,76,0.15)] bg-[var(--ink-2)] p-6 hover:border-[rgba(232,168,76,0.3)] transition cursor-pointer">
              <span className="text-2xl">📎</span>
              <span className="text-sm font-semibold text-[var(--parchment-70)]">Click to attach files</span>
              <span className="text-[11px] text-[var(--parchment-40)]">PDF, DOC, and other documents</span>
              <input
                type="file"
                multiple
                accept="application/*,text/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {attachments.filter(f => !f.type?.startsWith('image/') && !f.type?.startsWith('audio/') && !f.type?.startsWith('video/')).map((file, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] p-3">
                <div className="truncate min-w-0">
                  <p className="text-xs font-semibold text-[var(--parchment)] truncate">📎 {file.name}</p>
                  <p className="text-[10px] text-[var(--parchment-40)]">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={() => removeAttachment(attachments.indexOf(file))} className="letter-btn-danger px-3 py-1.5 text-xs font-bold flex-shrink-0">Remove</button>
              </div>
            ))}
          </div>
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
