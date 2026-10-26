import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderLock, ScanLine } from 'lucide-react';
import { PRIVATE_FOLDERS, type DocumentItem, type PrivateFolder, type User } from '@estateflow/shared';
import { api } from '@/lib/api';
import { BellButton } from '@/components/shell';
import { Button, Card, Empty, Loadable, Screen, Segmented } from '@/components/ui';
import { DocumentRow } from '@/components/files';
import { DocumentUploadSheet } from '@/components/scanner';

/** Office and personal papers are for the owner (administrators) and accounts only. */
export const canPrivateDocs = (u: User) => u.role === 'admin' || u.role === 'accounts';

/**
 * The owner's and accountant's own documents, kept apart from customer files: Office (shared by
 * administrators and accounts: sales reports, logs, lead papers, bills) and Personal (only the uploader).
 * Papers are uploaded as files or scanned with the camera into one PDF.
 */
export function PrivateDocuments() {
  const qc = useQueryClient();
  const [folderKey, setFolderKey] = useState<PrivateFolder>('office');
  const [adding, setAdding] = useState(false);
  const folder = PRIVATE_FOLDERS.find((f) => f.key === folderKey)!;
  const q = useQuery({
    queryKey: ['vault', folderKey],
    queryFn: () => api.get<{ data: DocumentItem[]; meta: { counts: Partial<Record<PrivateFolder, number>> } }>('/vault', { folder: folderKey }),
  });

  return (
    <Screen title="My documents" subtitle="Office and personal papers" back="/more" actions={<BellButton />}>
      <Segmented
        value={folderKey}
        onChange={(v) => setFolderKey(v as PrivateFolder)}
        options={PRIVATE_FOLDERS.map((f) => ({ value: f.key, label: `${f.title} · ${f.hindi}` }))}
      />
      <p className="flex items-center gap-1.5 text-[12.5px] text-stone-500">
        <FolderLock className="size-4" /> {folder.note}. Never shown to customers or sales staff.
      </p>
      <Button block icon={ScanLine} onClick={() => setAdding(true)}>
        Upload or scan to {folder.title}
      </Button>
      <Loadable q={q}>
        {(r) =>
          r.data.length ? (
            <Card className="divide-y divide-stone-100">
              {r.data.map((d) => (
                <DocumentRow key={d.id} d={d} />
              ))}
            </Card>
          ) : (
            <Empty icon={FolderLock} title={`No ${folder.title.toLowerCase()} documents yet`} body={`Scan or upload ${folder.types.slice(0, 3).join(', ').toLowerCase()} and more.`} />
          )
        }
      </Loadable>
      {adding && (
        <DocumentUploadSheet
          title={`Add to ${folder.title}`}
          types={folder.types}
          send={(form, onProgress) => {
            form.append('folder', folderKey);
            return api.upload('/vault', form, { onProgress });
          }}
          onDone={() => {
            setAdding(false);
            void qc.invalidateQueries({ queryKey: ['vault'] });
          }}
        />
      )}
    </Screen>
  );
}
