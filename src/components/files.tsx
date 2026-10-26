import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileText, ImageOff, Loader2, ScanLine } from 'lucide-react';
import { DOCUMENT_SECTIONS, documentSection, fileSize, fmtDate, type DocumentItem } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { saveFile } from '@/lib/platform';

/** Image that needs the session's bearer token (documents are never public URLs). */
export function AuthImage({ docId, name, className }: { docId: number; name: string; className?: string }) {
  const q = useQuery({
    queryKey: ['blob', docId],
    queryFn: async () => (await api.download(`/documents/${docId}/download`, name, { inline: '1' })).blob,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const u = URL.createObjectURL(q.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [q.data]);
  if (url) return <img src={url} alt={name} className={className} />;
  return <div className={`grid place-items-center bg-stone-100 text-stone-400 ${className ?? ''}`}>{q.error ? <ImageOff className="size-5" /> : <Loader2 className="size-5 animate-spin" />}</div>;
}

/** Downloads a file through the API and saves / shares it. */
export function useDownload() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, path: string, fallbackName: string) => {
    setBusy(key);
    try {
      const { blob, fileName } = await api.download(path, fallbackName);
      await saveFile(blob, fileName);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function DocumentRow({ d }: { d: DocumentItem & { mine?: boolean } }) {
  const { busy, run } = useDownload();
  const key = `doc-${d.id}`;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{d.name}</p>
        <p className="text-[13px] text-stone-500">
          {d.doc_type} · {fileSize(d.size)} · {fmtDate(d.created_at)}
          {d.mine ? ' · uploaded by you' : ''}
        </p>
      </div>
      <button type="button" aria-label={`Download ${d.name}`} disabled={busy === key} onClick={() => void run(key, `/documents/${d.id}/download`, d.name)} className="grid size-10 place-items-center rounded-full text-brand-800 active:bg-brand-50">
        {busy === key ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
      </button>
    </div>
  );
}

/** Hidden file input opened by a visible button (works in the browser and the Android WebView). */
export function useFilePicker(accept: string, onPick: (f: File) => void, capture?: 'environment') {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture={capture}
      className="hidden"
      data-testid="file-input"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) onPick(f);
      }}
    />
  );
  return { open: () => ref.current?.click(), input };
}

/** A customer's documents grouped by section (KYC, booking, payments, land records, registry, other), with missing papers named. */
export function DocumentSections({ docs, onUpload }: { docs: (DocumentItem & { mine?: boolean })[]; onUpload?: (section: (typeof DOCUMENT_SECTIONS)[number], missing: string[]) => void }) {
  return (
    <div className="space-y-3">
      {DOCUMENT_SECTIONS.map((section) => {
        const mine = docs.filter((d) => documentSection(d.doc_type).key === section.key);
        const have = new Set(mine.map((d) => d.doc_type));
        const missing = section.required.filter((t) => !have.has(t));
        if (!onUpload && !mine.length && !missing.length) return null;
        return (
          <section key={section.key} aria-labelledby={`docs-${section.key}`} className="card overflow-hidden">
            <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
              <div className="min-w-0">
              <h2 id={`docs-${section.key}`} className="text-[14px] font-bold text-brand-900">
                {section.title} <span className="font-medium text-stone-400">· {section.hindi}</span>
              </h2>
              <p className="text-[12px] text-stone-500">
                {mine.length} {mine.length === 1 ? 'document' : 'documents'}
                {missing.length > 0 && <span className="text-amber-700"> · Missing: {missing.join(', ')}</span>}
              </p>
              </div>
              {onUpload && (
                <button
                  type="button"
                  aria-label={`Upload or scan to ${section.title}`}
                  onClick={() => onUpload(section, missing)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-brand-200 px-3 text-[12.5px] font-semibold text-brand-800 active:bg-brand-50"
                >
                  <ScanLine className="size-4" /> Add
                </button>
              )}
            </div>
            {mine.length > 0 && (
              <div className="divide-y divide-stone-100 border-t border-stone-100">
                {mine.map((d) => (
                  <DocumentRow key={d.id} d={d} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
