import { useMemo, useState } from 'react';
import Logo from './Logo.jsx';

function getReaderPasscodeCount(readers, readerName) {
  const match = readers.find(
    (r) => r.readerName.toLowerCase() === readerName.trim().toLowerCase(),
  );
  return match ? (match.passcodeCount ?? 1) : 0;
}

export default function AuthPage({ readers, onRegisterWriter, onLoginWriter, onReaderUnlocked }) {
  const [mode, setMode] = useState('reader');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [readerName, setReaderName] = useState('');
  const [readerPasscode, setReaderPasscode] = useState('');
  const [confirmedPasscodes, setConfirmedPasscodes] = useState([]);
  const [error, setError] = useState('');

  const requiredCount = useMemo(
    () => getReaderPasscodeCount(readers, readerName),
    [readers, readerName],
  );
  const readerExists = readerName.trim() && requiredCount > 0;
  const allReaderPasscodesPassed = readerExists && confirmedPasscodes.length === requiredCount;

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleWriterSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim() || (mode === 'writer-register' && !name.trim())) {
      setError('Please complete all required fields.');
      return;
    }
    const message =
      mode === 'writer-register'
        ? await onRegisterWriter({ name: name.trim(), email: email.trim(), password: password.trim() })
        : await onLoginWriter({ email: email.trim(), password: password.trim() });
    setError(message);
  }

  async function confirmReaderPasscode(event) {
    event.preventDefault();
    if (!readerName.trim()) {
      setError('Enter the recipient name given by the letter creator.');
      return;
    }
    if (!readerExists) {
      setError('No recipient profile was found for this name.');
      return;
    }
    const cleanPasscode = readerPasscode.trim();
    if (!cleanPasscode) {
      setError('Enter your passcode.');
      return;
    }
    if (confirmedPasscodes.includes(cleanPasscode)) {
      setError('This passcode is already confirmed.');
      return;
    }
    const nextConfirmed = [...confirmedPasscodes, cleanPasscode];
    setConfirmedPasscodes(nextConfirmed);
    setReaderPasscode('');
    setError('');
    if (nextConfirmed.length === requiredCount) {
      const message = await onReaderUnlocked(readerName.trim(), nextConfirmed);
      if (message) {
        setConfirmedPasscodes(confirmedPasscodes);
        setError(message);
      }
    }
  }

  function resetReaderProgress(value) {
    setReaderName(value);
    setConfirmedPasscodes([]);
    setReaderPasscode('');
    setError('');
  }

  const tabs = [
    { value: 'reader', label: 'Recipient' },
    { value: 'writer-login', label: 'Sign in' },
    { value: 'writer-register', label: 'Register' },
  ];

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div
        className="letter-panel w-full max-w-5xl grid lg:grid-cols-[1fr_1.05fr] overflow-hidden shadow-[0_32px_80px_-20px_rgba(0,0,0,0.95)] page-enter"
        style={{ minHeight: 'min(720px, calc(100vh - 5rem))' }}
      >
        {/* ── Left: Ceremony panel ─────────────────────── */}
        <aside className="relative flex flex-col justify-between gap-10 p-8 sm:p-12 bg-[var(--ink-1)] border-b lg:border-b-0 lg:border-r border-[rgba(232,168,76,0.1)] overflow-hidden">
          {/* Background texture rings */}
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-[rgba(232,168,76,0.06)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-[rgba(232,168,76,0.04)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full border border-[rgba(232,168,76,0.04)]"
            aria-hidden
          />

          <div className="relative space-y-8">
            {/* Seal mark */}
            <div className="seal-mark seal-mark-xl seal-pulse"><Logo size={46} className="text-[var(--amber)]" /></div>

            <div className="space-y-3">
              <p className="eyebrow">Private letter vault</p>
              <h1 className="text-4xl sm:text-5xl font-serif leading-[1.15] tracking-[-0.02em] text-[var(--parchment)]">
                Multi-Passcode<br />Last Letter
              </h1>
            </div>

            <p className="text-sm leading-[1.85] text-[var(--parchment-70)] max-w-sm">
              Compose your final letter. Assign trusted recipients as keyholders — each must
              confirm with their passcode before the sealed sections are revealed.
            </p>

            {/* Features */}
            <ul className="space-y-3 text-xs text-[var(--parchment-40)]">
              {[
                'Sections remain sealed until all required keyholders confirm',
                'Assign distinct passcodes to each trusted recipient',
                'Beneficiaries access letters once keyholders unlock them',
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--amber)] opacity-70" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Demo credentials */}
          <div className="relative space-y-2">
            <p className="eyebrow mb-3 opacity-60">Demo credentials</p>
            <div className="rounded-lg border border-[rgba(232,168,76,0.1)] bg-[rgba(9,12,20,0.6)] p-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--parchment-70)]">Recipients</p>
              <div className="space-y-1">
                <p className="font-mono text-xs text-[var(--amber)] opacity-90">alice / alpha &nbsp;<span className="text-[var(--parchment-40)]">(keyholder)</span></p>
                <p className="font-mono text-xs text-[var(--amber)] opacity-90">bob / beta &nbsp;<span className="text-[var(--parchment-40)]">(keyholder)</span></p>
                <p className="font-mono text-xs text-[var(--amber)] opacity-90">sarah / gamma &nbsp;<span className="text-[var(--parchment-40)]">(beneficiary)</span></p>
              </div>
            </div>
            <div className="rounded-lg border border-[rgba(232,168,76,0.1)] bg-[rgba(9,12,20,0.6)] p-4 space-y-1.5">
              <p className="text-xs font-semibold text-[var(--parchment-70)]">Letter creator</p>
              <p className="font-mono text-xs text-[var(--amber)] opacity-90">testator@example.com / writer123</p>
            </div>
          </div>
        </aside>

        {/* ── Right: Form panel ─────────────────────────── */}
        <section className="flex items-center justify-center bg-[rgba(7,9,14,0.6)] p-6 sm:p-12">
          <div className="w-full max-w-[380px] space-y-7">
            {/* Tab switcher */}
            <div className="auth-tabs">
              {tabs.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeMode(value)}
                  className={`auth-tab${mode === value ? ' active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'reader' ? (
              <form onSubmit={confirmReaderPasscode} className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-2xl font-serif text-[var(--parchment)]">
                    Recipient access
                  </h2>
                  <p className="text-xs leading-[1.7] text-[var(--parchment-40)]">
                    Enter your name and confirm each passcode to access letter sections
                    assigned to you.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="eyebrow-dim">Recipient name</label>
                    <input
                      value={readerName}
                      onChange={(e) => resetReaderProgress(e.target.value)}
                      placeholder="e.g. alice"
                      className="vault-input px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="eyebrow-dim">Passcode</label>
                      {readerExists && (
                        <span className="text-[10px] font-mono text-[var(--amber)] opacity-75">
                          {confirmedPasscodes.length} / {requiredCount} confirmed
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={readerPasscode}
                      onChange={(e) => setReaderPasscode(e.target.value)}
                      placeholder="Enter your passcode"
                      className="vault-input px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                {confirmedPasscodes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {confirmedPasscodes.map((_, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-[var(--jade-border)] bg-[var(--jade-bg)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--jade)]"
                      >
                        Key {i + 1} confirmed
                      </span>
                    ))}
                  </div>
                )}

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <button
                  type="submit"
                  className="letter-btn-primary w-full px-4 py-3 text-sm"
                >
                  {allReaderPasscodesPassed ? 'Open letter sections →' : 'Confirm passcode'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleWriterSubmit} className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-2xl font-serif text-[var(--parchment)]">
                    {mode === 'writer-register' ? 'Create account' : 'Creator sign in'}
                  </h2>
                  <p className="text-xs leading-[1.7] text-[var(--parchment-40)]">
                    {mode === 'writer-register'
                      ? 'Set up your account to create and manage sealed letter sections.'
                      : 'Sign in to manage your recipients, passcodes, and letter sections.'}
                  </p>
                </div>

                <div className="space-y-4">
                  {mode === 'writer-register' && (
                    <div className="space-y-1.5">
                      <label className="eyebrow-dim">Your name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="vault-input px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="eyebrow-dim">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="testator@example.com"
                      className="vault-input px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="eyebrow-dim">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="vault-input px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <button
                  type="submit"
                  className="letter-btn-primary w-full px-4 py-3 text-sm"
                >
                  {mode === 'writer-register' ? 'Create account →' : 'Sign in →'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ErrorBanner({ children }) {
  return (
    <p className="rounded-lg border border-[var(--crimson-border)] bg-[var(--crimson-bg)] px-4 py-3 text-xs font-semibold text-[var(--crimson-bright)]">
      {children}
    </p>
  );
}
