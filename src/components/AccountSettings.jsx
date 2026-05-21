import { useState } from 'react';

export default function AccountSettings({ writer, onSave, onCancel }) {
  const [name, setName] = useState(writer.name || '');
  const [email, setEmail] = useState(writer.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!currentPassword) { setError('Current password is required to save changes.'); return; }
    if (newPassword && newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword && newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }

    setSaving(true);
    const err = await onSave({
      name: name.trim(),
      email: email.trim(),
      currentPassword,
      newPassword: newPassword || undefined,
    });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <section className="space-y-6 page-enter max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="btn-flat flex items-center gap-2 -ml-1">
          ← Back
        </button>
      </div>

      <div className="letter-card p-8 space-y-8">
        <div className="space-y-1">
          <p className="eyebrow text-[0.6rem]">Account</p>
          <h2 className="text-2xl font-serif">Account settings</h2>
          <p className="text-xs text-[var(--parchment-40)] leading-relaxed">
            Update your name, email address, or password. Current password is always required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile */}
          <div className="space-y-4">
            <p className="eyebrow text-[0.58rem] text-[var(--parchment-40)]">Profile</p>
            <div className="space-y-1.5">
              <label className="eyebrow-dim">Full name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="vault-input px-4 py-3 text-sm outline-none w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow-dim">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="vault-input px-4 py-3 text-sm outline-none w-full"
              />
              {email !== writer.email && (
                <p className="text-[11px] text-[var(--amber)] leading-relaxed">
                  ⚠ Changing your email will require re-verification. You'll be logged out.
                </p>
              )}
            </div>
          </div>

          <hr className="letter-rule" />

          {/* Password */}
          <div className="space-y-4">
            <p className="eyebrow text-[0.58rem] text-[var(--parchment-40)]">Password</p>
            <div className="space-y-1.5">
              <label className="eyebrow-dim">New password <span className="normal-case text-[var(--parchment-40)] font-normal">(leave blank to keep current)</span></label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="vault-input px-4 py-3 text-sm outline-none w-full"
              />
            </div>
            {newPassword && (
              <div className="space-y-1.5">
                <label className="eyebrow-dim">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="vault-input px-4 py-3 text-sm outline-none w-full"
                />
              </div>
            )}
          </div>

          <hr className="letter-rule" />

          {/* Current password */}
          <div className="space-y-1.5">
            <label className="eyebrow-dim">Current password <span className="text-[var(--amber)]">*</span></label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Required to save any changes"
              className="vault-input px-4 py-3 text-sm outline-none w-full"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[var(--crimson-border)] bg-[var(--crimson-bg)] px-4 py-3 text-xs font-semibold text-[var(--crimson-bright)]">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="letter-btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onCancel} className="btn-flat px-6 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
