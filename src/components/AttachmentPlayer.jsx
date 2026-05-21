export default function AttachmentPlayer({ file, onDownload }) {
  const isAudio = file.type?.startsWith('audio/');
  const isVideo = file.type?.startsWith('video/');

  if (isAudio) {
    return (
      <div className="rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🎙</span>
          <p className="text-xs font-medium text-[var(--parchment-70)] truncate flex-1">{file.name}</p>
          <span className="text-[10px] text-[var(--parchment-40)]">{(file.size / 1024).toFixed(0)} KB</span>
        </div>
        <audio
          controls
          src={file.data}
          className="w-full"
          style={{ accentColor: 'var(--amber)', height: '36px' }}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] overflow-hidden">
        <video
          controls
          src={file.data}
          className="w-full bg-black"
          style={{ maxHeight: '320px' }}
        />
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[rgba(232,168,76,0.08)]">
          <span className="text-sm">🎬</span>
          <p className="text-xs font-medium text-[var(--parchment-70)] truncate flex-1">{file.name}</p>
          <span className="text-[10px] text-[var(--parchment-40)]">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      </div>
    );
  }

  // Regular file — download button
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(232,168,76,0.1)] bg-[var(--ink-2)] p-3.5 text-xs">
      <span className="text-[var(--parchment-70)] font-medium truncate">
        📎 {file.name}&nbsp;
        <span className="text-[var(--parchment-40)]">({(file.size / 1024).toFixed(1)} KB)</span>
      </span>
      <button type="button" onClick={() => onDownload(file)} className="btn-amber flex-shrink-0">
        Download
      </button>
    </div>
  );
}
