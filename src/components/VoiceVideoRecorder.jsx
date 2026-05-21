import { useEffect, useRef, useState } from 'react';

const MAX_SIZE_MB = 25;

function getBestMimeType(mode) {
  const candidates =
    mode === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceVideoRecorder({ onAdd }) {
  const [mode, setMode] = useState('audio'); // 'audio' | 'video'
  const [stage, setStage] = useState('idle'); // 'idle' | 'preview' | 'recording' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobData, setBlobData] = useState(null); // { blob, type, name, size }

  const mediaRef = useRef(null);    // MediaRecorder instance
  const streamRef = useRef(null);   // MediaStream
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const liveVideoRef = useRef(null); // video element for live preview while recording

  // Clean up stream on unmount
  useEffect(() => {
    return () => stopStream();
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearInterval(timerRef.current);
  }

  async function startPreview() {
    setStage('preview');
    setErrorMsg('');
    try {
      const constraints =
        mode === 'audio'
          ? { audio: true }
          : { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (mode === 'video' && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
    } catch {
      setStage('error');
      setErrorMsg('Could not access microphone/camera. Please allow permission and try again.');
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    const mimeType = getBestMimeType(mode);
    chunksRef.current = [];
    setElapsed(0);

    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {});
    mediaRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      clearInterval(timerRef.current);
      const actualType = recorder.mimeType || (mode === 'audio' ? 'audio/webm' : 'video/webm');
      const ext = actualType.includes('mp4') ? 'mp4' : actualType.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunksRef.current, { type: actualType });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setBlobData({
        blob,
        type: actualType,
        name: mode === 'audio' ? `Voice message.${ext}` : `Video message.${ext}`,
        size: blob.size,
      });
      stopStream();
      setStage('done');
    };

    recorder.start(250);
    setStage('recording');

    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }

  function stopRecording() {
    mediaRef.current?.stop();
  }

  function reRecord() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setBlobData(null);
    setElapsed(0);
    setStage('idle');
    stopStream();
  }

  async function useRecording() {
    if (!blobData) return;
    const sizeMB = blobData.size / 1024 / 1024;
    if (sizeMB > MAX_SIZE_MB) {
      setErrorMsg(`Recording is ${sizeMB.toFixed(1)} MB — exceeds the ${MAX_SIZE_MB} MB limit. Please re-record a shorter clip.`);
      return;
    }
    // Convert blob to base64 data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      onAdd({
        name: blobData.name,
        type: blobData.type,
        size: blobData.size,
        data: e.target.result,
      });
      reRecord();
    };
    reader.readAsDataURL(blobData.blob);
  }

  return (
    <div className="rounded-xl border border-[rgba(232,168,76,0.12)] bg-[var(--ink-2)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(232,168,76,0.08)]">
        <p className="text-xs font-semibold text-[var(--parchment-70)] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
          Record a message
        </p>
        {/* Mode toggle — only available in idle/error state */}
        {(stage === 'idle' || stage === 'error') && (
          <div className="flex rounded-lg overflow-hidden border border-[rgba(232,168,76,0.15)]">
            {[{ v: 'audio', icon: '🎙', label: 'Audio' }, { v: 'video', icon: '🎬', label: 'Video' }].map(({ v, icon, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => { setMode(v); setStage('idle'); setErrorMsg(''); }}
                className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all ${
                  mode === v
                    ? 'bg-[rgba(232,168,76,0.15)] text-[var(--amber)]'
                    : 'text-[var(--parchment-40)] hover:text-[var(--parchment-70)]'
                }`}
              >
                <span>{icon}</span> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Live video preview while in preview/recording stage */}
        {mode === 'video' && (stage === 'preview' || stage === 'recording') && (
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-lg bg-black aspect-video object-cover"
          />
        )}

        {/* Playback after recording done */}
        {stage === 'done' && blobUrl && (
          mode === 'audio' ? (
            <audio controls src={blobUrl} className="w-full" style={{ accentColor: 'var(--amber)' }} />
          ) : (
            <video controls src={blobUrl} className="w-full rounded-lg aspect-video object-cover bg-black" />
          )
        )}

        {/* Status / timer */}
        <div className="flex items-center justify-center gap-3">
          {stage === 'idle' && (
            <p className="text-xs text-[var(--parchment-40)] text-center">
              {mode === 'audio' ? 'Record a voice message for this section.' : 'Record a video message for this section.'}
            </p>
          )}
          {stage === 'preview' && mode === 'audio' && (
            <p className="text-xs text-[var(--amber)] animate-pulse">Microphone ready — press record</p>
          )}
          {stage === 'recording' && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-[var(--parchment)]">{formatTime(elapsed)}</span>
              <span className="text-xs text-[var(--parchment-40)]">recording…</span>
            </div>
          )}
          {stage === 'done' && blobData && (
            <p className="text-xs text-[var(--parchment-40)]">
              {(blobData.size / 1024).toFixed(0)} KB · {formatTime(elapsed)}
            </p>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="text-xs text-[var(--crimson-bright)] bg-[var(--crimson-bg)] border border-[var(--crimson-border)] rounded-lg px-3 py-2 text-center">
            {errorMsg}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-2 flex-wrap">
          {stage === 'idle' && (
            <button
              type="button"
              onClick={startPreview}
              className="letter-btn-primary px-5 py-2 text-sm flex items-center gap-2"
            >
              <span>{mode === 'audio' ? '🎙' : '🎬'}</span> Start recording
            </button>
          )}

          {stage === 'preview' && (
            <>
              <button type="button" onClick={startRecording} className="letter-btn-primary px-5 py-2 text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-current" /> Record
              </button>
              <button type="button" onClick={reRecord} className="btn-flat px-4 py-2 text-sm">Cancel</button>
            </>
          )}

          {stage === 'recording' && (
            <button
              type="button"
              onClick={stopRecording}
              className="px-5 py-2 text-sm font-bold rounded-lg border border-[var(--crimson-border)] bg-[var(--crimson-bg)] text-[var(--crimson-bright)] hover:opacity-80 transition-opacity flex items-center gap-2"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-current" /> Stop
            </button>
          )}

          {stage === 'done' && (
            <>
              <button type="button" onClick={useRecording} className="letter-btn-primary px-5 py-2 text-sm">
                ✓ Use this recording
              </button>
              <button type="button" onClick={reRecord} className="btn-flat px-4 py-2 text-sm">Re-record</button>
            </>
          )}

          {stage === 'error' && (
            <button type="button" onClick={() => { setStage('idle'); setErrorMsg(''); }} className="btn-flat px-4 py-2 text-sm">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
