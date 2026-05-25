import { useState } from 'react';

export default function CreateReaderForm({ onSave, onCancel }) {
  const [readerName, setReaderName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [isTrusted, setIsTrusted] = useState(true);
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const cleanName = readerName.trim();
    const cleanPasscode = passcode.trim();
    if (!cleanName || !cleanPasscode) {
      setError('Please enter a recipient name and a passcode.');
      return;
    }
    if (cleanPasscode.length < 4) {
      setError('Passcode must be at least 4 characters.');
      return;
    }
    const message = onSave({ readerName: cleanName, passcodes: [cleanPasscode], isTrusted, email: email.trim() || undefined });
    setError(message);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5 page-enter">
      <div className="letter-card p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[rgba(232,168,76,0.1)]">
          <div>
            <p className="eyebrow text-[0.6rem] mb-1.5">Recipient setup</p>
            <h2 className="text-2xl font-serif">Create recipient</h2>
            <p className="mt-1.5 text-xs text-[var(--parchment-40)] leading-relaxed max-w-sm">
              Add a recipient name and access passcode. Keyholders must confirm to unlock sections;
              beneficiaries read once the vault is unlocked.
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

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="eyebrow-dim">Recipient name</label>
            <input
              value={readerName}
              onChange={(e) => setReaderName(e.target.value)}
              placeholder="e.g. alice"
              className="vault-input px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="eyebrow-dim">Passcode</label>
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Set access passcode"
              className="vault-input px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="eyebrow-dim">
              Email address <span className="normal-case text-[var(--parchment-40)] font-normal">(optional — for unlock notification)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@email.com"
              className="vault-input px-4 py-3 text-sm outline-none"
            />
            <p className="text-[11px] text-[var(--parchment-40)] leading-relaxed">
              If provided, this person will receive an email when the vault unlocks.
            </p>
          </div>

          <label className="flex items-start gap-3.5 rounded-lg border border-[rgba(232,168,76,0.12)] bg-[var(--ink-2)] p-4 cursor-pointer group">
            <input
              type="checkbox"
              id="isTrusted"
              checked={isTrusted}
              onChange={(e) => setIsTrusted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--amber)] cursor-pointer flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--parchment)] group-hover:text-[var(--amber)] transition-colors">
                Trusted keyholder
              </p>
              <p className="text-xs text-[var(--parchment-40)] mt-1 leading-relaxed">
                When checked, this recipient must confirm with their passcode to unlock any sections
                they are assigned to. When unchecked, they are a beneficiary who gains access once
                all keyholders have confirmed.
              </p>
            </div>
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--crimson-border)] bg-[var(--crimson-bg)] px-4 py-3 text-xs font-semibold text-[var(--crimson-bright)]">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="letter-btn-primary px-7 py-3 text-sm">
          Save recipient →
        </button>
      </div>
    </form>
  );
}
