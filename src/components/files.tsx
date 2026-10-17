import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileText, ImageOff, Loader2 } from 'lucide-react';
import { fileSize, fmtDate, type DocumentItem } from '@estateflow/shared';
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
