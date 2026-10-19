import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import clsx from 'clsx';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Property, PropertyImage } from '@estateflow/shared';
import { sitePropertyPath } from '@estateflow/site';
import { getServerUrl } from '@/lib/api';
import { isNative } from '@/lib/platform';
import { PropertyArt } from './PropertyArt';

export const mediaUrl = (path: string) => `${getServerUrl()}${path}`;

export function AiBadge({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white', className)}>
      <Sparkles className="size-3" /> Artist's impression
    </span>
  );
}

/** Thumbnail first (small, quick on mobile data), then the medium size once it has loaded. */
export function ProgressiveImage({ img, fallback, className, eager }: { img?: PropertyImage | null; fallback: Pick<Property, 'id' | 'type' | 'project'>; className?: string; eager?: boolean }) {
  const [src, setSrc] = useState(img ? mediaUrl(img.urls.thumb) : '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!img) return;
    setFailed(false);
    setSrc(mediaUrl(img.urls.thumb));
    const better = new Image();
    better.src = mediaUrl(img.urls.medium);
    better.onload = () => setSrc(better.src);
    return () => {
      better.onload = null;
    };
  }, [img]);
  if (!img || failed) return <PropertyArt type={fallback.type} project={fallback.project} seed={fallback.id} className={className} />;
  return <img src={src} alt={img.alt_text} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} className={clsx('bg-stone-100 object-cover', className)} />;
}

/** Full-width swipeable gallery (scroll snap) with a full-screen pinch-to-zoom viewer. */
export function SwipeGallery({ property, images, className }: { property: Pick<Property, 'id' | 'type' | 'project'>; images: PropertyImage[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  if (!images.length) return <PropertyArt type={property.type} project={property.project} seed={property.id} className={clsx('h-56 w-full', className)} />;
  return (
    <div className={clsx('relative', className)}>
      <div ref={strip} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]" onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} aria-label="Property photos">
        {images.map((img, i) => (
          <button key={img.id} type="button" className="relative h-60 w-full shrink-0 snap-center" onClick={() => setViewer(i)} aria-label={`Open image ${i + 1} of ${images.length}`}>
            <ProgressiveImage img={img} fallback={property} className="size-full" eager={i === 0} />
            {img.is_ai_generated && <AiBadge className="absolute bottom-3 left-3" />}
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {images.map((img, i) => (
            <span key={img.id} className={clsx('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60')} />
          ))}
        </div>
      )}
      {viewer !== null && <Viewer images={images} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** Full-screen viewer: swipe between images, pinch or double-tap to zoom, drag to pan when zoomed. */
function Viewer({ images, start, onClose }: { images: PropertyImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; px: number; py: number } | null>(null);
  const lastTap = useRef(0);
  const img = images[i];
  useEffect(() => setT({ scale: 1, x: 0, y: 0 }), [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // The Android back button closes the viewer first (see initNative in lib/platform).
    window.addEventListener('ef:close-sheet', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ef:close-sheet', onClose);
    };
  }, [onClose]);
  const pts = () => [...pointers.current.values()];
  const down = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pts();
    const dist = p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
    gesture.current = { dist, scale: t.scale, x: t.x, y: t.y, px: e.clientX, py: e.clientY };
    if (p.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 280) setT((c) => (c.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
      lastTap.current = now;
    }
  };
  const move = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pts();
    const g = gesture.current;
    if (p.length === 2 && g.dist) {
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      setT((c) => ({ ...c, scale: Math.min(5, Math.max(1, (g.scale * d) / g.dist)) }));
    } else if (p.length === 1 && t.scale > 1) {
      setT((c) => ({ ...c, x: g.x + e.clientX - g.px, y: g.y + e.clientY - g.py }));
    }
  };
  const up = (e: RPointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    // A quick horizontal swipe at normal zoom changes image.
    if (g && pointers.current.size === 0 && t.scale === 1 && Math.abs(e.clientX - g.px) > 60) setI((x) => Math.min(images.length - 1, Math.max(0, x + (e.clientX < g.px ? 1 : -1))));
    if (pointers.current.size === 0) gesture.current = null;
    if (t.scale < 1.05) setT({ scale: 1, x: 0, y: 0 });
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" data-sheet-open className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-3 py-2 text-white">
        <span className="text-[13px]">
          {i + 1} / {images.length}
        </span>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-11 place-items-center rounded-full active:bg-white/10">
          <X />
        </button>
      </div>
      <div className="relative flex-1 touch-none overflow-hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img
          src={mediaUrl(img.urls.large)}
          alt={img.alt_text}
          draggable={false}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain select-none"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transition: gesture.current ? 'none' : 'transform 0.2s' }}
        />
      </div>
      <div className="px-4 py-3 text-[12.5px] text-white/80">
        {img.is_ai_generated && <AiBadge className="mr-2" />}
        {img.caption ?? img.alt_text}
      </div>
    </div>
  );
}

/** Public website link for a published property: the website is part of the dashboard (websiteUrl in env.js). */
export function websiteLink(p: Pick<Property, 'slug' | 'is_published'>) {
  const base = (window.ESTATEFLOW_CONFIG?.websiteUrl ?? '').replace(/\/+$/, '');
  return p.is_published && p.slug && base ? `${base}${sitePropertyPath(p.slug)}` : null;
}

/** System share sheet on the phone, Web Share in browsers, clipboard as the last resort. */
export async function shareProperty(p: Pick<Property, 'name' | 'project' | 'unit_number' | 'slug' | 'is_published' | 'price'>) {
  const url = websiteLink(p);
  const text = `${p.name}, ${p.project} ${p.unit_number}`;
  try {
    if (isNative) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: p.name, text, url: url ?? undefined, dialogTitle: 'Share property' });
    } else if (navigator.share) {
      await navigator.share({ title: p.name, text, url: url ?? undefined });
    } else {
      await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
      toast.success('Copied to the clipboard');
    }
  } catch (err) {
    if (err instanceof Error && /cancel|abort/i.test(err.message + err.name)) return;
    toast.error('Sharing is not available on this device');
  }
}
