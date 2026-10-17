import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ListChecks, Plus } from 'lucide-react';
import { TASK_PRIORITIES, addDays, todayStr, type Paginated, type Task } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { canWrite, useUser } from '@/lib/session';
import { Button, Card, Empty, Field, IconButton, Loadable, Screen, Segmented, Sheet } from '@/components/ui';
import { TaskRow } from './Today';

type View = 'open' | 'overdue' | 'today' | 'Completed';

export default function Tasks() {
  const user = useUser();
  const editable = canWrite(user);
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'open';
  const [adding, setAdding] = useState(false);
  const query = view === 'open' ? { status: 'open' } : view === 'Completed' ? { status: 'Completed' } : { due: view };
  const q = useQuery({ queryKey: ['tasks', view], queryFn: () => api.get<Paginated<Task>>('/tasks', { ...query, mine: '1', limit: 100 }) });

  return (
    <Screen title="My tasks" back="/more" actions={editable && <IconButton icon={Plus} label="Add task" onClick={() => setAdding(true)} />}>
      <Segmented
        value={view}
        onChange={(v) => setParams(v === 'open' ? {} : { view: v }, { replace: true })}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'today', label: 'Due today' },
          { value: 'Completed', label: 'Done' },
        ]}
      />
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <Card className="divide-y divide-stone-100">
              {d.data.map((t) => (
                <TaskRow key={t.id} t={t} canEdit={editable && t.status !== 'Completed'} />
              ))}
            </Card>
          ) : (
            <Empty icon={ListChecks} title={view === 'Completed' ? 'Nothing completed yet' : 'No tasks here'} action={editable && view !== 'Completed' && <Button icon={Plus} onClick={() => setAdding(true)}>Add a task</Button>} />
          )
        }
      </Loadable>
      {adding && <NewTaskSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}

function NewTaskSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<(typeof TASK_PRIORITIES)[number]>('Medium');
  const [due, setDue] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (title.trim().length < 3) return toast.error('Give the task a short title');
    setBusy(true);
    try {
      await api.post('/tasks', { title: title.trim(), priority, due_date: due || null });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      toast.success('Task added');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="New task">
      <Field label="Task">{(id) => <input id={id} className="field" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <Segmented value={priority} onChange={setPriority} options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))} />
      <Field label="Due">
        {(id) => (
          <div className="space-y-2">
            <input id={id} type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDue(todayStr())}>
                Today
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDue(addDays(todayStr(), 1))}>
                Tomorrow
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDue('')}>
                No date
              </Button>
            </div>
          </div>
        )}
      </Field>
      <Button block onClick={save} loading={busy}>
        Add task
      </Button>
    </Sheet>
  );
}
