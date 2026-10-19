import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { media, srcSet, type Img } from '../lib/api';
import { ImpressionTag, Picture } from './ui';

function Lightbox({ images, index, onIndex, onClose }: { images: Img[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => onIndex((index + d + images.length) % images.length), [index, images.length, onIndex]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);
  const img = images[index];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Image ${index + 1} of ${images.length}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <div className="flex items-center justify-between p-4 text-sm">
        <span>
          {index + 1} / {images.length}
        </span>
        <button ref={closeRef} type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close gallery">
          <X />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-16">
        <img key={img.id} src={media(img, 'large')} srcSet={srcSet(img)} sizes="100vw" alt={img.alt_text} className="max-h-full max-w-full object-contain" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-2 rounded-full bg-white/10 p-3 hover:bg-white/20 md:left-4" aria-label="Previous image">
              <ChevronLeft />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-2 rounded-full bg-white/10 p-3 hover:bg-white/20 md:right-4" aria-label="Next image">
              <ChevronRight />
            </button>
          </>
        )}
      </div>
      <p className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-white/75">
        {img.caption || img.alt_text}
        {img.is_ai_generated && " · Artist's impression"}
      </p>
    </div>
  );
}

/** Cover plus thumbnails; any image opens a keyboard- and swipe-friendly lightbox. */
export function Gallery({ images, name }: { images: Img[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return <Picture img={null} sizes="100vw" ratio="16 / 9" className="rounded-2xl" />;
  const [first, ...rest] = images;
  return (
    <div>
      <div className="grid gap-2 md:grid-cols-[2fr_1fr] md:gap-3">
        <button type="button" onClick={() => setOpen(0)} className="group relative block overflow-hidden rounded-2xl text-left" aria-label={`Open gallery: ${first.alt_text}`}>
          <Picture img={first} sizes="(min-width: 768px) 66vw, 100vw" ratio="16 / 10" eager />
          {first.is_ai_generated && <ImpressionTag className="absolute bottom-3 left-3" />}
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-forest">
            <Expand size={15} aria-hidden /> {images.length} {images.length === 1 ? 'image' : 'images'}
          </span>
        </button>
        {rest.length > 0 && (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-1 md:grid-rows-2 md:gap-3">
            {rest.slice(0, 4).map((img, i) => (
              <button key={img.id} type="button" onClick={() => setOpen(i + 1)} className={`relative overflow-hidden rounded-xl ${i > 1 ? 'md:hidden' : ''}`} aria-label={`Open image ${i + 2} of ${images.length}: ${img.alt_text}`}>
                <Picture img={img} sizes="(min-width: 768px) 33vw, 25vw" ratio="16 / 10" className="md:!aspect-auto md:h-full" />
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="sr-only">Gallery for {name}</span>
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
