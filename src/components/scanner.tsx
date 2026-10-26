import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Camera, FileUp, Plus, ScanLine, X } from 'lucide-react';
import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES, fmtDate, todayStr } from '@estateflow/shared';
import { errorMessage } from '@/lib/api';
import { useOnline } from '@/lib/network';
import { isNative } from '@/lib/platform';
import { Button, Field, Segmented, Sheet } from '@/components/ui';
import { useFilePicker } from '@/components/files';

const MAX_PAGES = 20;
/** Longest side of a scanned page in the PDF: sharp enough to read a stamp paper, small enough for 20 pages under the upload limit. */
const PAGE_PX = 1600;

/** One page from the phone camera (native). In a browser the sheet uses a camera file input instead. */
async function capturePage(): Promise<File | null> {
  const { Camera: Cam, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Cam.getPhoto({ quality: 85, width: 2000, resultType: CameraResultType.Uri, source: CameraSource.Camera, saveToGallery: false, correctOrientation: true });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    return new File([blob], `page-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
  } catch (e) {
    const msg = String((e as Error)?.message);
    if (/cancel/i.test(msg)) return null;
    if (/denied|permission/i.test(msg)) throw new Error('EstateFlow cannot use the camera. Allow it in Android Settings → Apps → EstateFlow → Permissions, then try again.');
    throw e;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A page could not be read. Take it again.'));
    img.src = url;
  });
}

/** Joins the scanned pages into one A4 PDF, each page scaled to fit with a small margin. */
export async function pagesToPdf(pages: File[], fileName: string): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const [pw, ph, margin] = [210, 297, 6];
  for (const [i, page] of pages.entries()) {
    const img = await loadImage(page);
    const scale = Math.min(1, PAGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);
    const fit = Math.min((pw - 2 * margin) / canvas.width, (ph - 2 * margin) / canvas.height);
    const [w, h] = [canvas.width * fit, canvas.height * fit];
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.75), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
  }
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
}

/**
 * Upload a document two ways: scan paper with the camera (pages become one PDF) or choose a file.
 * `send` posts the form to the right endpoint; it receives doc_type, name and file.
 */
export function DocumentUploadSheet({
  title,
  types,
  defaultType,
  send,
  onDone,
}: {
  title: string;
  types: readonly string[];
  defaultType?: string;
  send: (form: FormData, onProgress: (p: number) => void) => Promise<unknown>;
  onDone: () => void;
}) {
  const online = useOnline();
  const [mode, setMode] = useState<'scan' | 'file'>('scan');
  const [type, setType] = useState(defaultType ?? types[0]);
  const [pages, setPages] = useState<File[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [step, setStep] = useState('');
  const thumbs = useMemo(() => pages.map((p) => URL.createObjectURL(p)), [pages]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const addPage = (f: File) => setPages((ps) => (ps.length >= MAX_PAGES ? (toast.error(`Up to ${MAX_PAGES} pages per document`), ps) : [...ps, f]));
  const cameraInput = useFilePicker('image/*', addPage, 'environment');
  const filePicker = useFilePicker(UPLOAD_ACCEPT, (f) => {
    if (f.size > UPLOAD_MAX_BYTES) return toast.error(`That file is larger than ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`);
    setFile(f);
  });

  const scan = async () => {
    if (!isNative) return cameraInput.open();
    try {
      const page = await capturePage();
      if (page) addPage(page);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const upload = async () => {
    if (!online) return toast.error('Uploading needs a connection');
    let out = file;
    try {
      if (mode === 'scan') {
        if (!pages.length) return toast.error('Scan at least one page');
        setStep('Making PDF…');
        setProgress(0);
        out = await pagesToPdf(pages, `${type} (scan ${fmtDate(todayStr())}).pdf`.replace(/[\\/]/g, '-'));
        if (out.size > UPLOAD_MAX_BYTES) throw new Error('The scan is too large. Remove a few pages and upload them as a second document.');
      }
      if (!out) return toast.error('Choose a file first');
      setStep('Uploading');
      setProgress(0);
      const form = new FormData();
      form.append('doc_type', type);
      form.append('name', (mode === 'scan' ? out.name.replace(/\.pdf$/, '') : `${type} - ${out.name}`).slice(0, 160));
      form.append('file', out);
      await send(form, setProgress);
      toast.success(mode === 'scan' ? `Scanned ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} and saved as PDF` : 'Document uploaded');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
      setStep('');
    }
  };

  return (
    <Sheet open onClose={onDone} title={title}>
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as 'scan' | 'file')}
        options={[
          { value: 'scan', label: 'Scan with camera' },
          { value: 'file', label: 'Choose a file' },
        ]}
      />
      <Field label="Document type">
        {(id) => (
          <select id={id} className="field" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
      </Field>
      {cameraInput.input}
      {filePicker.input}
      {mode === 'scan' ? (
        <div>
          {pages.length > 0 && (
            <ul className="mb-3 grid grid-cols-3 gap-2" aria-label="Scanned pages">
              {thumbs.map((src, i) => (
                <li key={src} className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                  <img src={src} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Remove page ${i + 1}`}
                    onClick={() => setPages((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white active:bg-black/80"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => void scan()} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-6 text-center active:bg-stone-50">
            {pages.length ? <Plus className="size-6 text-brand-700" /> : <Camera className="size-6 text-brand-700" />}
            <span className="font-semibold">{pages.length ? 'Scan next page' : 'Scan first page'}</span>
            <span className="text-[12px] text-stone-500">Lay the paper flat in good light. All pages are saved as one PDF.</span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={filePicker.open} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-6 text-center active:bg-stone-50">
          <FileUp className="size-6 text-brand-700" />
          <span className="font-semibold">{file ? file.name : 'Choose a photo or PDF'}</span>
          <span className="text-[12px] text-stone-500">PDF, image, Word or Excel, up to {UPLOAD_MAX_BYTES / 1024 / 1024} MB</span>
        </button>
      )}
      <Button block size="lg" icon={mode === 'scan' ? ScanLine : FileUp} loading={progress !== null} onClick={() => void upload()}>
        {progress !== null ? (step === 'Uploading' ? `Uploading ${Math.round(progress * 100)}%` : step) : mode === 'scan' ? `Save ${pages.length || ''} ${pages.length === 1 ? 'page' : 'pages'} as PDF`.replace('  ', ' ') : 'Upload'}
      </Button>
    </Sheet>
  );
}
