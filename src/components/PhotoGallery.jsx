import { useEffect, useState } from 'react';

export default function PhotoGallery({ photos }) {
  const [lightbox, setLightbox] = useState(null); // index of open photo

  // Keyboard navigation
  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e) {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setLightbox((i) => (i - 1 + photos.length) % photos.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, photos.length]);

  if (!photos.length) return null;

  return (
    <>
      {/* Gallery grid */}
      <div className={`grid gap-2 ${
        photos.length === 1 ? 'grid-cols-1' :
        photos.length === 2 ? 'grid-cols-2' :
        photos.length === 3 ? 'grid-cols-3' :
        'grid-cols-2 sm:grid-cols-3'
      }`}>
        {photos.map((photo, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setLightbox(idx)}
            className="relative group overflow-hidden rounded-lg bg-[var(--ink-2)] aspect-square focus:outline-none focus:ring-2 focus:ring-[var(--amber)]"
          >
            <img
              src={photo.data}
              alt={photo.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity" />
            {/* Show +N badge on last visible if more than 6 */}
            {idx === 5 && photos.length > 6 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-xl font-bold text-white">+{photos.length - 6}</span>
              </div>
            )}
          </button>
        )).slice(0, 6)}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          {/* Prev */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i - 1 + photos.length) % photos.length); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/80 transition-all"
            >
              ‹
            </button>
          )}

          {/* Image */}
          <div className="relative max-w-4xl max-h-[90vh] w-full px-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightbox].data}
              alt={photos[lightbox].name}
              className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg shadow-2xl"
            />
            <p className="text-center text-xs text-white/50 mt-3">{photos[lightbox].name}</p>
            <p className="text-center text-[10px] text-white/30 mt-1">{lightbox + 1} / {photos.length} · press Esc to close</p>
          </div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i + 1) % photos.length); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/80 transition-all"
            >
              ›
            </button>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-all text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
