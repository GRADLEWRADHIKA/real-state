import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { CalendarCheck2, Download, HandCoins, Plus, Receipt, Target, Trash2, Users, Wallet } from 'lucide-react';
import {
  ATTENDANCE_STATUSES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  fmtDate,
  fmtTime,
  inr,
  inrShort,
  todayStr,
  type AttendanceRecord,
  type AttendanceStatus,
  type Broker,
  type BrokerCommission,
  type Expense,
  type ExpenseCategory,
  type Installment,
  type Paginated,
  type ReceiptData,
  type SalaryRow,
  type TargetRow,
  type Transaction,
  type User,
} from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { isOnline } from '@/lib/network';
import { useUser } from '@/lib/session';
import { receiptText } from '@/lib/messages';
import { useDownload } from '@/components/files';
import { WhatsAppLink } from '@/components/contact';
import { Badge, Button, Card, Empty, Field, IconButton, Loadable, Screen, Segmented, Sheet, StatusBadge } from '@/components/ui';
import { TransactionList } from './Customers';

// ─── Who sees what (the server enforces the same rules) ───────────────────

export const canFinance = (u: User) => u.role === 'admin' || u.role === 'accounts';
export const canBrokers = (u: User) => canFinance(u) || u.role === 'manager';
export const canStaff = (u: User) => canFinance(u) || u.role === 'manager';
export const canAttendance = canStaff;
export const canTargets = (u: User) => u.role === 'admin' || u.role === 'manager';

/** Writes on these screens go straight to the server. */
function needsConnection() {
  if (isOnline()) return false;
  toast.error('This needs a connection. Try again when you are online.');
  return true;
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'green' }) {
  return (
    <div className="card px-3 py-3">
      <p className="label-xs">{label}</p>
      <p className={clsx('num mt-1 font-display text-[18px] font-semibold', tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-brand-800' : 'text-ink')}>{inrShort(value)}</p>
    </div>
  );
}

function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Method">
      {(id) => (
        <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={label}>{(id) => <input id={id} type="date" className="field" value={value} onChange={(e) => onChange(e.target.value)} />}</Field>;
}

function TextField({ label, value, onChange, hint, numeric }: { label: string; value: string; onChange: (v: string) => void; hint?: string; numeric?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <input id={id} className="field" inputMode={numeric ? 'numeric' : undefined} value={value} onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d]/g, '') : e.target.value)} />}
    </Field>
  );
}

/** Runs a write with the busy flag, offline check and error toast. */
function useWrite() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    if (needsConnection()) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const Progress = ({ pct }: { pct: number }) => (
  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
    <div className={clsx('h-full rounded-full', pct >= 100 ? 'bg-brand-700' : 'bg-gold-400')} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
);

// ─── Finance ───────────────────────────────────────────────────────────────

interface FinanceSummary {
  collected: number;
  outstanding: number;
  overdue: number;
  overdue_count: number;
  upcoming_30: number;
  this_month: number;
}

type FinanceTab = 'due' | 'overdue' | 'today';

export function Finance() {
  const [tab, setTab] = useState<FinanceTab>('due');
  const [search, setSearch] = useState('');
  const [paying, setPaying] = useState<Installment | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const summary = useQuery({ queryKey: ['finance', 'summary'], queryFn: () => api.get<FinanceSummary>('/finance/summary') });
  const inst = useQuery({
    queryKey: ['installments', tab, search],
    enabled: tab !== 'today',
    queryFn: () => api.get<Paginated<Installment, { balance: number }>>('/installments', { range: tab, q: search.trim(), limit: 50 }),
  });
  const today = todayStr();
  const txns = useQuery({
    queryKey: ['transactions', 'today', today],
    enabled: tab === 'today',
    queryFn: () => api.get<Paginated<Transaction, { totals: { completed: number } }>>('/transactions', { from: today, to: today, limit: 100 }),
  });

  return (
    <Screen title="Finance" subtitle="Collections and receipts" back="/more">
      {summary.data && (
        <div className="grid grid-cols-3 gap-2">
          <Tile label="This month" value={summary.data.this_month} tone="green" />
          <Tile label="Next 30 days" value={summary.data.upcoming_30} />
          <Tile label="Overdue" value={summary.data.overdue} tone="red" />
        </div>
      )}
      <Segmented<FinanceTab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'due', label: 'Due' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'today', label: "Today's payments" },
        ]}
      />
      {tab !== 'today' ? (
        <>
          <input type="search" aria-label="Search installments" placeholder="Customer, code, unit or phone" className="field" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Loadable q={inst}>
            {(d) =>
              d.data.length ? (
                <>
                  <p className="px-1 text-[13px] text-stone-500">
                    {d.meta.total} installment{d.meta.total === 1 ? '' : 's'} · <span className="num font-semibold">{inr(d.meta.balance)}</span> to collect
                  </p>
                  <Card className="divide-y divide-stone-100">
                    {d.data.map((i) => (
                      <div key={i.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{i.customer_name}</p>
                            <p className="truncate text-[13px] text-stone-500">
                              {i.label} · due {fmtDate(i.due_date)}
                              {i.property_unit ? ` · ${[i.property_project, i.property_unit].filter(Boolean).join(' ')}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="num font-semibold">{inr(i.balance)}</p>
                            <StatusBadge status={i.status} />
                          </div>
                        </div>
                        {i.balance > 0 && (
                          <Button size="sm" variant="secondary" icon={HandCoins} className="mt-2" aria-label={`Record payment for ${i.customer_name}, ${i.label}`} onClick={() => setPaying(i)}>
                            Record payment
                          </Button>
                        )}
                      </div>
                    ))}
                  </Card>
                </>
              ) : (
                <Empty icon={Wallet} title={tab === 'overdue' ? 'Nothing overdue' : 'Nothing due'} body="Installments due in the next 30 days show up here." />
              )
            }
          </Loadable>
        </>
      ) : (
        <Loadable q={txns}>
          {(d) =>
            d.data.length ? (
              <>
                <p className="px-1 text-[13px] text-stone-500">
                  {d.meta.total} payment{d.meta.total === 1 ? '' : 's'} · <span className="num font-semibold">{inr(d.meta.totals.completed)}</span> received today
                </p>
                <TransactionList
                  items={d.data}
                  action={(t) => (
                    <p className="text-[13px] font-medium text-ink">
                      {t.customer_name}
                      {t.customer_phone && t.status === 'Completed' && <WhatsAppLink phone={t.customer_phone} label="Send receipt" className="ml-2" text={receiptText(t.customer_name ?? '', t)} />}
                    </p>
                  )}
                />
              </>
            ) : (
              <Empty icon={Receipt} title="No payments today" body="Payments recorded today show up here." />
            )
          }
        </Loadable>
      )}
      {paying && (
        <PaymentSheet
          inst={paying}
          onClose={() => setPaying(null)}
          onDone={(r) => {
            setPaying(null);
            setReceipt(r);
          }}
        />
      )}
      {receipt && <ReceiptSheet r={receipt} onClose={() => setReceipt(null)} />}
    </Screen>
  );
}

function PaymentSheet({ inst, onClose, onDone }: { inst: Installment; onClose: () => void; onDone: (r: ReceiptData) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(inst.balance));
  const [method, setMethod] = useState<string>('UPI');
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const { busy, run } = useWrite();
  const save = () =>
    run(async () => {
      if (!(Number(amount) > 0)) throw new Error('Enter the amount received');
      const r = await api.post<ReceiptData>(`/installments/${inst.id}/payment`, { amount: Number(amount), method, payment_date: date, reference: reference.trim() || undefined, notes: notes.trim() || undefined });
      for (const key of ['installments', 'finance', 'transactions', 'customers']) void qc.invalidateQueries({ queryKey: [key] });
      toast.success('Payment recorded');
      onDone(r);
    });
  return (
    <Sheet open onClose={onClose} title={`Record payment · ${inst.customer_name}`}>
      <p className="text-[14px] text-stone-600">
        {inst.label} · <span className="num font-semibold">{inr(inst.balance)}</span> due {fmtDate(inst.due_date)}
      </p>
      <TextField label="Amount (₹)" value={amount} onChange={setAmount} numeric />
      <MethodSelect value={method} onChange={setMethod} />
      <DateField label="Payment date" value={date} onChange={setDate} />
      <TextField label="Reference" value={reference} onChange={setReference} hint="Optional. UTR, cheque number…" />
      <TextField label="Notes" value={notes} onChange={setNotes} hint="Optional" />
      <Button block size="lg" onClick={() => void save()} loading={busy}>
        Save payment
      </Button>
    </Sheet>
  );
}

function ReceiptSheet({ r, onClose }: { r: ReceiptData; onClose: () => void }) {
  const { busy, run } = useDownload();
  const no = r.receipt_number ?? r.code;
  return (
    <Sheet open onClose={onClose} title="Payment recorded">
      <div className="rounded-2xl bg-brand-50 p-4 text-center">
        <p className="num font-display text-[28px] font-semibold text-brand-900">{inr(r.amount)}</p>
        <p className="text-[14px] text-stone-600">
          from {r.customer.name} · {r.method} · {fmtDate(r.payment_date)}
        </p>
        <p className="mt-1 text-[13px] text-stone-500">Receipt {no}</p>
        <p className="mt-1 text-[13px] text-stone-500">
          Balance after this payment <span className="num font-semibold">{inr(r.outstanding_after)}</span>
        </p>
      </div>
      {r.status !== 'Failed' && (
        <Button block icon={Download} loading={busy === 'receipt'} onClick={() => void run('receipt', `/transactions/${r.id}/receipt.pdf`, `Receipt-${no.replace(/\//g, '-')}.pdf`)}>
          Download PDF
        </Button>
      )}
      <WhatsAppLink phone={r.customer.phone} label="Send receipt" className="h-11 w-full justify-center text-[15px]" text={receiptText(r.customer.name, r, r.company?.name)} />
      <Button block variant="ghost" onClick={onClose}>
        Done
      </Button>
    </Sheet>
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────

type Period = 'month' | 'today' | 'all';
type ExpenseMeta = {
  byCategory: { category: string; count: number; amount: number }[];
  totals: { total: number; today: number; month: number };
};

export function Expenses() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
  const [category, setCategory] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const today = todayStr();
  const from = period === 'today' ? today : period === 'month' ? `${today.slice(0, 7)}-01` : undefined;
  const q = useQuery({
    queryKey: ['expenses', period, category],
    queryFn: () => api.get<Paginated<Expense, ExpenseMeta>>('/expenses', { category, from, to: period === 'all' ? undefined : today, limit: 100 }),
  });
  const del = useWrite();
  const remove = (e: Expense) =>
    del.run(async () => {
      await api.delete(`/expenses/${e.id}`);
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
      setRemoving(null);
    });

  return (
    <Screen title="Expenses" back="/more" actions={<IconButton icon={Plus} label="Add expense" onClick={() => setAdding(true)} />}>
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'month', label: 'This month' },
          { value: 'today', label: 'Today' },
          { value: 'all', label: 'All' },
        ]}
      />
      <select aria-label="Category" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All categories</option>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <Loadable q={q}>
        {(d) => (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Today" value={d.meta.totals.today} />
              <Tile label="This month" value={d.meta.totals.month} />
              <Tile label="Shown" value={d.meta.totals.total} />
            </div>
            {d.data.length ? (
              <Card className="divide-y divide-stone-100">
                {d.data.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{e.description}</p>
                      <p className="truncate text-[13px] text-stone-500">
                        {fmtDate(e.expense_date)} · {e.category} · {e.method}
                        {e.paid_to ? ` · ${e.paid_to}` : ''}
                      </p>
                    </div>
                    <p className="num font-semibold">{inr(e.amount)}</p>
                    <IconButton icon={Trash2} label={`Delete ${e.description}`} className="text-red-600" onClick={() => setRemoving(e)} />
                  </div>
                ))}
              </Card>
            ) : (
              <Empty icon={Wallet} title="No expenses" body="Expenses you add show up here." action={<Button icon={Plus} onClick={() => setAdding(true)}>Add expense</Button>} />
            )}
          </>
        )}
      </Loadable>
      {adding && <ExpenseSheet onClose={() => setAdding(false)} />}
      {removing && (
        <Sheet open onClose={() => setRemoving(null)} title="Delete expense?">
          <p className="text-[14px] text-stone-600">
            {removing.description} · <span className="num font-semibold">{inr(removing.amount)}</span> on {fmtDate(removing.expense_date)}. This cannot be undone.
          </p>
          <Button block variant="danger" loading={del.busy} onClick={() => void remove(removing)}>
            Delete
          </Button>
        </Sheet>
      )}
    </Screen>
  );
}

function ExpenseSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState<ExpenseCategory>('Office');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('Cash');
  const [paidTo, setPaidTo] = useState('');
  const [reference, setReference] = useState('');
  const { busy, run } = useWrite();
  const save = () =>
    run(async () => {
      if (description.trim().length < 2) throw new Error('Describe the expense');
      if (!(Number(amount) > 0)) throw new Error('Enter the amount');
      await api.post('/expenses', { expense_date: date, category, description: description.trim(), amount: Number(amount), method, paid_to: paidTo.trim() || undefined, reference: reference.trim() || undefined });
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense added');
      onClose();
    });
  return (
    <Sheet open onClose={onClose} title="Add expense">
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Category">
        {(id) => (
          <select id={id} className="field" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </Field>
      <TextField label="Description" value={description} onChange={setDescription} />
      <TextField label="Amount (₹)" value={amount} onChange={setAmount} numeric />
      <MethodSelect value={method} onChange={setMethod} />
      <TextField label="Paid to" value={paidTo} onChange={setPaidTo} hint="Optional" />
      <TextField label="Reference" value={reference} onChange={setReference} hint="Optional" />
      <Button block size="lg" onClick={() => void save()} loading={busy}>
        Save expense
      </Button>
    </Sheet>
  );
}

// ─── Brokers and commissions ───────────────────────────────────────────────

type BrokerTab = 'Due' | 'Paid' | 'brokers';

export function Brokers() {
  const user = useUser();
  const money = canFinance(user);
  const [tab, setTab] = useState<BrokerTab>(money ? 'Due' : 'brokers');
  const [paying, setPaying] = useState<BrokerCommission | null>(null);
  const brokers = useQuery({ queryKey: ['brokers'], enabled: tab === 'brokers', queryFn: () => api.get<Paginated<Broker>>('/brokers', { limit: 100 }) });
  const comms = useQuery({
    queryKey: ['commissions', tab],
    enabled: money && tab !== 'brokers',
    queryFn: () => api.get<Paginated<BrokerCommission, { totals: { due: number; paid: number } }>>('/brokers/commissions', { status: tab, limit: 100 }),
  });
  return (
    <Screen title={money ? 'Broker commissions' : 'Brokers'} back="/more">
      {money && (
        <Segmented<BrokerTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Due', label: 'Due' },
            { value: 'Paid', label: 'Paid' },
            { value: 'brokers', label: 'Brokers' },
          ]}
        />
      )}
      {tab === 'brokers' ? (
        <Loadable q={brokers}>
          {(d) =>
            d.data.length ? (
              <Card className="divide-y divide-stone-100">
                {d.data.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{b.name}</p>
                      <p className="truncate text-[13px] text-stone-500">
                        {[b.firm, `${b.commission_pct}%`, `${b.customers_count ?? 0} customers`].filter(Boolean).join(' · ')}
                      </p>
                      {money && !!b.commission_due && <p className="num text-[12px] text-amber-700">{inr(b.commission_due)} due</p>}
                    </div>
                    {b.status !== 'Active' && <Badge>{b.status}</Badge>}
                    {b.phone && <WhatsAppLink phone={b.phone} label="WhatsApp" text={`Namaste ${b.name}`} />}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty icon={Users} title="No brokers yet" />
            )
          }
        </Loadable>
      ) : (
        <Loadable q={comms}>
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Due" value={d.meta.totals.due} tone="red" />
                <Tile label="Paid" value={d.meta.totals.paid} tone="green" />
              </div>
              {d.data.length ? (
                <Card className="divide-y divide-stone-100">
                  {d.data.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.broker_name}</p>
                        <p className="truncate text-[13px] text-stone-500">
                          {c.customer_name} · {c.pct}% of {inr(c.payment_amount)}
                          {c.receipt_number ? ` · ${c.receipt_number}` : ''}
                        </p>
                        {c.status === 'Paid' && c.paid_on && (
                          <p className="text-[12px] text-stone-400">
                            Paid {fmtDate(c.paid_on)} · {c.paid_method}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="num font-semibold">{inr(c.amount)}</p>
                        {c.status === 'Due' ? (
                          <Button size="sm" variant="secondary" aria-label={`Mark paid to ${c.broker_name}`} onClick={() => setPaying(c)}>
                            Mark paid
                          </Button>
                        ) : (
                          <StatusBadge status="Paid" />
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              ) : (
                <Empty icon={HandCoins} title={tab === 'Due' ? 'No commission due' : 'No commission paid yet'} />
              )}
            </>
          )}
        </Loadable>
      )}
      {paying && <CommissionSheet c={paying} onClose={() => setPaying(null)} />}
    </Screen>
  );
}

function CommissionSheet({ c, onClose }: { c: BrokerCommission; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState<string>('Bank Transfer');
  const { busy, run } = useWrite();
  const save = () =>
    run(async () => {
      await api.post(`/brokers/commissions/${c.id}/pay`, { paid_on: date, method });
      void qc.invalidateQueries({ queryKey: ['commissions'] });
      void qc.invalidateQueries({ queryKey: ['brokers'] });
      toast.success('Commission marked paid');
      onClose();
    });
  return (
    <Sheet open onClose={onClose} title={`Pay ${c.broker_name}`}>
      <p className="text-[14px] text-stone-600">
        <span className="num font-semibold">{inr(c.amount)}</span> commission on {c.customer_name}
      </p>
      <DateField label="Paid on" value={date} onChange={setDate} />
      <MethodSelect value={method} onChange={setMethod} />
      <Button block size="lg" onClick={() => void save()} loading={busy}>
        Mark paid
      </Button>
    </Sheet>
  );
}

// ─── Staff: attendance, salary, targets ────────────────────────────────────

type StaffTab = 'attendance' | 'salary' | 'targets';

export function Staff() {
  const user = useUser();
  const tabs: { value: StaffTab; label: ReactNode }[] = [
    ...(canAttendance(user) ? [{ value: 'attendance' as const, label: 'Attendance' }] : []),
    ...(canFinance(user) ? [{ value: 'salary' as const, label: 'Salary' }] : []),
    ...(canTargets(user) ? [{ value: 'targets' as const, label: 'Targets' }] : []),
  ];
  const [tab, setTab] = useState<StaffTab>(tabs[0]?.value ?? 'attendance');
  return (
    <Screen title="Staff" back="/more">
      {tabs.length > 1 && <Segmented value={tab} onChange={setTab} options={tabs} />}
      {tab === 'attendance' && <Attendance />}
      {tab === 'salary' && <Salary />}
      {tab === 'targets' && <Targets />}
    </Screen>
  );
}

function Attendance() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const q = useQuery({ queryKey: ['attendance', 'day', date], queryFn: () => api.get<{ data: AttendanceRecord[] }>('/staff/attendance', { date }) });
  const [saving, setSaving] = useState<number | null>(null);
  const mark = async (r: AttendanceRecord, status: AttendanceStatus) => {
    if (needsConnection()) return;
    setSaving(r.user_id);
    try {
      await api.post('/staff/attendance', { user_id: r.user_id, date, status });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`${r.name}: ${status}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };
  return (
    <>
      <input type="date" aria-label="Attendance date" className="field" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <>
              <p className="px-1 text-[13px] text-stone-500">
                {d.data.filter((r) => r.status === 'Present' || r.status === 'Half day').length} of {d.data.length} present
              </p>
              <Card className="divide-y divide-stone-100">
                {d.data.map((r) => (
                  <div key={r.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="truncate text-[13px] text-stone-500">
                        {r.title ?? ''}
                        {r.check_in_at ? ` · in ${fmtTime(r.check_in_at)}` : ''}
                        {r.check_out_at ? ` · out ${fmtTime(r.check_out_at)}` : ''}
                      </p>
                    </div>
                    <select
                      aria-label={`Attendance for ${r.name}`}
                      className={clsx('field w-32! shrink-0', !r.status && 'text-stone-400')}
                      disabled={saving === r.user_id}
                      value={r.status ?? ''}
                      onChange={(e) => e.target.value && void mark(r, e.target.value as AttendanceStatus)}
                    >
                      <option value="">Not marked</option>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </Card>
            </>
          ) : (
            <Empty icon={CalendarCheck2} title="No staff" />
          )
        }
      </Loadable>
    </>
  );
}

const thisMonth = () => todayStr().slice(0, 7);

function Salary() {
  const [month, setMonth] = useState(thisMonth());
  const [paying, setPaying] = useState<SalaryRow | null>(null);
  const q = useQuery({
    queryKey: ['salaries', month],
    queryFn: () => api.get<{ data: SalaryRow[]; meta: { month: string; totals: { salary: number; paid: number; balance: number } } }>('/staff/salaries', { month }),
  });
  return (
    <>
      <input type="month" aria-label="Salary month" className="field" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      <Loadable q={q}>
        {(d) => (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Salary" value={d.meta.totals.salary} />
              <Tile label="Paid" value={d.meta.totals.paid} tone="green" />
              <Tile label="Balance" value={d.meta.totals.balance} tone={d.meta.totals.balance ? 'red' : undefined} />
            </div>
            <Card className="divide-y divide-stone-100">
              {d.data.map((r) => (
                <div key={r.user_id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="text-[13px] text-stone-500">
                        <span className="num">{inr(r.paid)}</span> of <span className="num">{inr(r.monthly_salary)}</span> paid
                      </p>
                    </div>
                    {r.balance > 0 ? (
                      <Button size="sm" variant="secondary" aria-label={`Pay ${r.name}`} onClick={() => setPaying(r)}>
                        Pay
                      </Button>
                    ) : (
                      r.monthly_salary > 0 && <StatusBadge status="Paid" />
                    )}
                  </div>
                  {r.monthly_salary > 0 && <Progress pct={(r.paid / r.monthly_salary) * 100} />}
                </div>
              ))}
            </Card>
          </>
        )}
      </Loadable>
      {paying && <SalarySheet row={paying} month={month} onClose={() => setPaying(null)} />}
    </>
  );
}

function SalarySheet({ row, month, onClose }: { row: SalaryRow; month: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(row.balance));
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState<string>('Bank Transfer');
  const [notes, setNotes] = useState('');
  const { busy, run } = useWrite();
  const save = () =>
    run(async () => {
      if (!(Number(amount) > 0)) throw new Error('Enter the amount');
      await api.post('/staff/salary-payments', { user_id: row.user_id, month, amount: Number(amount), paid_on: date, method, notes: notes.trim() || undefined });
      void qc.invalidateQueries({ queryKey: ['salaries'] });
      toast.success('Salary payment saved');
      onClose();
    });
  return (
    <Sheet open onClose={onClose} title={`Pay ${row.name}`}>
      <p className="text-[14px] text-stone-600">
        {month} · <span className="num font-semibold">{inr(row.balance)}</span> left of {inr(row.monthly_salary)}
      </p>
      <TextField label="Amount (₹)" value={amount} onChange={setAmount} numeric />
      <DateField label="Paid on" value={date} onChange={setDate} />
      <MethodSelect value={method} onChange={setMethod} />
      <TextField label="Notes" value={notes} onChange={setNotes} hint="Optional" />
      <Button block size="lg" onClick={() => void save()} loading={busy}>
        Save payment
      </Button>
    </Sheet>
  );
}

function Targets() {
  const [month, setMonth] = useState(thisMonth());
  const q = useQuery({ queryKey: ['targets', month], queryFn: () => api.get<{ data: TargetRow[] }>('/staff/targets', { month }) });
  return (
    <>
      <input type="month" aria-label="Target month" className="field" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <Card className="divide-y divide-stone-100">
              {d.data.map((t) => {
                const pct = t.monthly_target ? (t.achieved / t.monthly_target) * 100 : 0;
                return (
                  <div key={t.user_id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="num text-[13px] font-semibold">{t.monthly_target ? `${Math.round(pct)}%` : 'No target'}</p>
                    </div>
                    <p className="text-[13px] text-stone-500">
                      <span className="num">{inrShort(t.achieved)}</span> of <span className="num">{inrShort(t.monthly_target)}</span> · {t.bookings} booking{t.bookings === 1 ? '' : 's'} · <span className="num">{inrShort(t.collected)}</span> collected
                    </p>
                    {t.monthly_target > 0 && <Progress pct={pct} />}
                  </div>
                );
              })}
            </Card>
          ) : (
            <Empty icon={Target} title="No targets set" body="Targets are set on the dashboard." />
          )
        }
      </Loadable>
    </>
  );
}
