'use client';

import { useEffect, useState } from 'react';
import Logo from './components/Logo.jsx';
import AuthPage from './components/AuthPage.jsx';
import BlogDashboard from './components/BlogDashboard.jsx';
import CreateReaderForm from './components/CreateReaderForm.jsx';
import CreatePostForm from './components/CreatePostForm.jsx';
import ReaderPortal from './components/ReaderPortal.jsx';
import AccountSettings from './components/AccountSettings.jsx';
import ToastContainer, { useToast } from './components/Toast.jsx';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

function saveSession(session) {
  return session;
}

function clearSession() {
  return null;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

export default function App() {
  const [currentWriter, setCurrentWriter] = useState(null);
  const [readerSession, setReaderSession] = useState(null);
  const [posts, setPosts] = useState([]);
  const [readers, setReaders] = useState([]);
  const [confirmedReaders, setConfirmedReaders] = useState([]);
  const [trustedReaders, setTrustedReaders] = useState([]);
  const [unlockThreshold, setUnlockThreshold] = useState(0);
  const [storedUnlockThreshold, setStoredUnlockThreshold] = useState(null);
  const [dms, setDms] = useState(null);
  const [dmzUnlocked, setDmzUnlocked] = useState(false);
  const [page, setPage] = useState('auth');
  const [editingPost, setEditingPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appError, setAppError] = useState('');
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const writerPosts = posts.filter((post) => post.writerId === currentWriter?.id);
  const writerReaders = readers.filter((reader) => reader.writerId === currentWriter?.id);
  const readerPosts = posts.filter((post) =>
    post.readerNames.some(
      (readerName) => readerName.toLowerCase() === readerSession?.readerName.toLowerCase(),
    ),
  );

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/session`);
      if (!res.ok) { setIsLoading(false); return; }
      const session = await res.json();

      if (session.type === 'writer') {
        setCurrentWriter(session.writer);
        setReaderSession(null);
        await loadWriterData(session.writer.id);
        setPage('writer-dashboard');
        setAppError('');
        return;
      }

      if (session.type === 'recipient' && session.readerName) {
        setPosts(session.posts);
        setConfirmedReaders(session.confirmedReaders);
        setTrustedReaders(session.trustedReaders || []);
        setUnlockThreshold(session.unlockThreshold || 0);
        setDmzUnlocked(session.dmzUnlocked || false);
        setReaderSession({ readerName: session.readerName });
        setCurrentWriter(null);
        setPage('reader-portal');
        setAppError('');
        return;
      }

      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPublicRecipients() {
    // No longer exposes public recipient list — recipients enter name + passcode directly
    setIsLoading(false);
  }

  async function loadWriterData(writerId) {
    const data = await apiRequest(`/writers/${writerId}/data`);
    setReaders(data.readers);
    setPosts(data.posts);
    setConfirmedReaders(data.confirmedReaders || []);
    setTrustedReaders(data.trustedReaders || []);
    setUnlockThreshold(data.unlockThreshold || 0);
    setStoredUnlockThreshold(data.storedUnlockThreshold ?? null);
    setDms(data.dms || null);
    setDmzUnlocked(data.dms?.dmzUnlockedAt != null);
  }

  async function resetConfirmations() {
    try {
      setIsLoading(true);
      await apiRequest('/writers/reset-confirmations', {
        method: 'POST',
        body: JSON.stringify({ writerId: currentWriter.id }),
      });
      if (currentWriter) {
        await loadWriterData(currentWriter.id);
      }
    } catch (error) {
      setAppError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function registerWriter(writerData) {
    try {
      const result = await apiRequest('/writers/register', {
        method: 'POST',
        body: JSON.stringify(writerData),
      });
      // Registration now returns { pending: true, email } — email verification required
      if (result.pending) {
        return { pending: true, email: result.email };
      }
      // Fallback if server ever returns writer directly
      setCurrentWriter(result);
      setReaderSession(null);
      await loadWriterData(result.id);
      setPage('writer-dashboard');
      saveSession({ type: 'writer', writer: result, page: 'writer-dashboard' });
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function loginWriter(credentials) {
    try {
      const foundWriter = await apiRequest('/writers/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      setCurrentWriter(foundWriter);
      setReaderSession(null);
      await loadWriterData(foundWriter.id);
      setPage('writer-dashboard');
      saveSession({ type: 'writer', writer: foundWriter, page: 'writer-dashboard' });
      return '';
    } catch (error) {
      // Surface unverified flag so AuthPage can show resend UI
      if (error.message?.includes('verify your email')) {
        return { unverified: true, message: error.message };
      }
      return error.message;
    }
  }

  async function startReaderSession(readerName, passcodes) {
    try {
      const data = await apiRequest('/recipients/confirm', {
        method: 'POST',
        body: JSON.stringify({ readerName, passcodes }),
      });
      setPosts(data.posts);
      setConfirmedReaders(data.confirmedReaders);
      setTrustedReaders(data.trustedReaders || []);
      setUnlockThreshold(data.unlockThreshold || 0);
      setDmzUnlocked(data.dmzUnlocked || false);
      setReaderSession({ readerName });
      setCurrentWriter(null);
      setPage('reader-portal');
      saveSession({ type: 'recipient', readerName });
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function logout() {
    try {
      await apiRequest('/writers/logout', { method: 'POST' });
    } catch {
      // Local logout should still complete if the server session has already expired.
    }
    setCurrentWriter(null);
    setReaderSession(null);
    setPosts([]);
    setConfirmedReaders([]);
    setPage('auth');
    clearSession();
    await loadPublicRecipients();
  }

  async function saveReader(readerData) {
    try {
      const data = await apiRequest(`/writers/${currentWriter.id}/recipients`, {
        method: 'POST',
        body: JSON.stringify(readerData),
      });
      setReaders(data.readers);
      setPosts(data.posts);
      setPage('writer-dashboard');
      showToast(`Recipient "${readerData.readerName}" added successfully.`);
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function savePost(postData) {
    try {
      const data = await apiRequest(`/writers/${currentWriter.id}/sections`, {
        method: 'POST',
        body: JSON.stringify(postData),
      });
      setReaders(data.readers);
      setPosts(data.posts);
      const isEdit = Boolean(postData.id);
      showToast(isEdit ? `Section "${postData.title}" updated.` : `Section "${postData.title}" created.`);
      setEditingPost(null);
      setPage('writer-dashboard');
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function deletePost(postId) {
    try {
      const data = await apiRequest(`/writers/${currentWriter.id}/sections/${postId}`, {
        method: 'DELETE',
      });
      setReaders(data.readers);
      setPosts(data.posts);
      showToast('Section deleted.');
    } catch (error) {
      setAppError(error.message);
    }
  }

  async function saveDmsConfig(config) {
    try {
      const data = await apiRequest(`/writers/${currentWriter.id}/dms`, {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      setDms(data.dms || null);
      setDmzUnlocked(data.dms?.dmzUnlockedAt != null);
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function saveUnlockThreshold(value) {
    try {
      const data = await apiRequest(`/writers/${currentWriter.id}/threshold`, {
        method: 'PATCH',
        body: JSON.stringify({ unlockThreshold: value }),
      });
      setReaders(data.readers);
      setPosts(data.posts);
      setConfirmedReaders(data.confirmedReaders || []);
      setTrustedReaders(data.trustedReaders || []);
      setUnlockThreshold(data.unlockThreshold || 0);
      setStoredUnlockThreshold(data.storedUnlockThreshold ?? null);
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function updateAccount({ name, email, currentPassword, newPassword }) {
    try {
      const result = await apiRequest(`/writers/${currentWriter.id}/account`, {
        method: 'PATCH',
        body: JSON.stringify({ name, email, currentPassword, newPassword }),
      });
      if (result.emailChanged) {
        // Email changed — must re-verify, so log out
        await logout();
        return null; // signal to show re-verification message
      }
      // Update local writer name
      setCurrentWriter(w => ({ ...w, name: result.name }));
      saveSession({ type: 'writer', writer: { ...currentWriter, name: result.name }, page: 'writer-dashboard' });
      setPage('writer-dashboard');
      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function deleteReader(readerId) {
    try {
      const data = await apiRequest(`/writers/${currentWriter.id}/recipients/${readerId}`, {
        method: 'DELETE',
      });
      setReaders(data.readers);
      setPosts(data.posts);
      showToast('Recipient removed.');
    } catch (error) {
      setAppError(error.message);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="seal-mark seal-mark-xl seal-pulse mx-auto"><Logo size={38} className="text-[var(--amber)]" /></div>
          <div>
            <p className="eyebrow text-xs mb-2">Letter Vault</p>
            <div className="flex items-center justify-center gap-1.5">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (page === 'auth' || (!currentWriter && !readerSession)) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {appError && (
          <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-lg border border-[var(--color-garnet-border)] bg-[var(--color-garnet-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-garnet)]">
            {appError}
          </div>
        )}
        <AuthPage
          onRegisterWriter={registerWriter}
          onLoginWriter={loginWriter}
          onReaderUnlocked={startReaderSession}
        />
      </>
    );
  }

  if (readerSession) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ReaderPortal
        readerName={readerSession.readerName}
        posts={readerPosts}
        confirmedReaders={confirmedReaders}
        trustedReaders={trustedReaders}
        unlockThreshold={unlockThreshold}
        dmzUnlocked={dmzUnlocked}
        onLogout={logout}
      />
      </>
    );
  }

  return (
    <>
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    <div className="min-h-screen">
      <header className="border-b border-[rgba(232,168,76,0.08)] bg-[var(--ink-0)] sticky top-0 z-10 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="seal-mark"><Logo size={22} className="text-[var(--amber)]" /></div>
            <div>
              <p className="eyebrow text-[0.58rem]">Letter vault</p>
              <p className="text-sm font-serif text-[var(--parchment)]">
                {currentWriter.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage('writer-dashboard')} className="btn-flat">Dashboard</button>
            <button onClick={() => setPage('account-settings')} className="btn-flat">Account</button>
            <button onClick={logout} className="btn-flat-danger">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        {page === 'writer-dashboard' && (
          <BlogDashboard
            writer={currentWriter}
            posts={writerPosts}
            readers={writerReaders}
            confirmedReaders={confirmedReaders}
            trustedReaders={trustedReaders}
            unlockThreshold={unlockThreshold}
            storedUnlockThreshold={storedUnlockThreshold}
            onSaveUnlockThreshold={saveUnlockThreshold}
            dms={dms}
            dmzUnlocked={dmzUnlocked}
            onSaveDmsConfig={saveDmsConfig}
            onCreateReader={() => setPage('create-reader')}
            onCreatePost={() => {
              setEditingPost(null);
              setPage('create-post');
            }}
            onEditPost={(post) => {
              setEditingPost(post);
              setPage('create-post');
            }}
            onDeletePost={deletePost}
            onDeleteReader={deleteReader}
            onResetConfirmations={resetConfirmations}
          />
        )}

        {page === 'create-reader' && (
          <CreateReaderForm onSave={saveReader} onCancel={() => setPage('writer-dashboard')} />
        )}

        {page === 'create-post' && (
          <CreatePostForm
            readers={writerReaders}
            post={editingPost}
            onSave={savePost}
            onCancel={() => {
              setEditingPost(null);
              setPage('writer-dashboard');
            }}
          />
        )}

        {page === 'account-settings' && (
          <AccountSettings
            writer={currentWriter}
            onSave={updateAccount}
            onCancel={() => setPage('writer-dashboard')}
          />
        )}
      </main>
    </div>
    </>
  );
}
