import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Building2, Download, Eye, EyeOff, Fingerprint, KeyRound, Server } from 'lucide-react';
import { APP_VERSION } from '@estateflow/shared';
import mark from '@/assets/starwiz-mark.png';
import logo from '@/assets/starwiz-logo-512.png';
import { api, defaultServerUrl, errorMessage, getServerUrl, setServerUrl, testServer } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Field, Sheet } from '@/components/ui';

function BrandFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="safe-top flex min-h-dvh flex-col bg-brand-950 text-white">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">{children}</div>
      <p className="safe-bottom pb-4 text-center text-[11px] text-white/40">EstateFlow {APP_VERSION}</p>
    </div>
  );
}

export function Booting() {
  return (
    <div className="grid min-h-dvh place-items-center bg-brand-950">
      <img src={mark} alt="" className="size-16 animate-pulse" />
    </div>
  );
}

export function UpdateRequired() {
  const { meta, recheckServer } = useSession();
  const [checking, setChecking] = useState(false);
  return (
    <BrandFrame>
      <img src={logo} alt="Starwiz" className="mx-auto mb-8 h-16 w-auto" />
      <div className="rounded-3xl bg-white p-6 text-ink">
        <Download className="mb-3 size-8 text-brand-800" />
        <h1 className="font-display text-[22px] font-semibold text-brand-950">Update required</h1>
        <p className="mt-2 text-[15px] text-stone-600">
          This version of EstateFlow ({APP_VERSION}) is too old for your company's server, which needs {meta?.minAppVersion ?? 'a newer version'} or later. Install the latest app from your administrator, then open it again.
        </p>
        <Button
          block
          className="mt-5"
          loading={checking}
          onClick={async () => {
            setChecking(true);
            const tooOld = await recheckServer();
            setChecking(false);
            if (tooOld) toast('This version still needs an update');
            else window.location.reload();
          }}
        >
          Check again
        </Button>
      </div>
    </BrandFrame>
  );
}

export function Locked() {
  const { unlock, logout } = useSession();
  return (
    <BrandFrame>
      <img src={mark} alt="" className="mx-auto mb-6 size-20" />
      <h1 className="text-center font-display text-[24px] font-semibold">EstateFlow is locked</h1>
      <p className="mt-2 text-center text-white/70">Use your fingerprint or face to continue.</p>
      <Button variant="gold" size="lg" icon={Fingerprint} block className="mt-8" onClick={() => void unlock().then((ok) => !ok && toast.error('Not recognised. Try again.'))}>
        Unlock
      </Button>
      <button type="button" className="mt-4 h-11 text-[14px] font-semibold text-white/70" onClick={() => void logout()}>
        Sign in with password instead
      </button>
    </BrandFrame>
  );
}

const DEMO_LOGINS = [
  { role: 'Admin', email: 'admin@demo.com', password: 'Admin@123' },
  { role: 'Manager', email: 'manager@demo.com', password: 'Manager@123' },
  { role: 'Sales', email: 'sales@demo.com', password: 'Sales@123' },
  { role: 'Accounts', email: 'accounts@demo.com', password: 'Accounts@123' },
  { role: 'Customer', email: 'customer@demo.com', password: 'Customer@123' },
];

export function Login() {
  const { login, expiredReason, recheckServer, meta } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password, remember);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrandFrame>
      <img src={logo} alt="Starwiz" className="mx-auto mb-3 h-20 w-auto" />
      <p className="mb-8 text-center text-[14px] text-white/60">Sign in to EstateFlow</p>
      <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-5 text-ink">
        {expiredReason && !error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{expiredReason}</p>}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        )}
        <Field label="Email">{(id) => <input id={id} type="email" inputMode="email" autoComplete="username" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password">
          {(id) => (
            <div className="relative">
              <input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" required className="field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-stone-500">
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        <label className="flex items-center gap-3 text-[14px] text-stone-700">
          <input type="checkbox" className="size-5 accent-brand-800" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in on this phone
        </label>
        <Button type="submit" size="lg" block loading={busy}>
          Sign in
        </Button>
        <button type="button" className="h-10 w-full text-[14px] font-semibold text-brand-800" onClick={() => setResetOpen(true)}>
          Forgot password?
        </button>
      </form>
      {meta?.mode === 'demo' && (
        <div className="mt-5">
          <p className="mb-2 text-center text-[12px] text-white/50">Demo server: tap a role to fill its login</p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_LOGINS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  setError(null);
                }}
                className="h-9 rounded-full border border-white/20 px-3.5 text-[13px] font-semibold text-white/85 active:bg-white/10"
              >
                {d.role}
              </button>
            ))}
          </div>
        </div>
      )}
      <Link to="/homes" className="mx-auto mt-6 inline-flex h-10 items-center gap-2 text-[14px] font-semibold text-white/85">
        <Building2 className="size-4" /> Browse our homes
      </Link>
      <button type="button" onClick={() => setServerOpen(true)} className="mx-auto mt-2 inline-flex h-10 items-center gap-2 text-[13px] text-white/60">
        <Server className="size-4" />
        {getServerUrl() || 'This server'}
      </button>
      {serverOpen && <ServerSheet onClose={() => setServerOpen(false)} onSaved={recheckServer} />}
      {resetOpen && <ResetSheet initialEmail={email} onClose={() => setResetOpen(false)} />}
    </BrandFrame>
  );
}

/** Lets the person point the app at their company's EstateFlow server. */
export function ServerSheet({ onClose, onSaved }: { onClose: () => void; onSaved?: () => unknown }) {
  const [url, setUrl] = useState(getServerUrl());
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof testServer>> | null>(null);
  const test = async () => {
    setTesting(true);
    setResult(await testServer(url));
    setTesting(false);
  };
  const save = async () => {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean && !/^https?:\/\/[^\s/]+/i.test(clean)) return toast.error('Enter a full address, like https://crm.yourcompany.in');
    setBusy(true);
    try {
      if (clean) {
        const res = await fetch(`${clean}/api/meta`, { cache: 'no-store' }).catch(() => null);
        if (!res?.ok) throw new Error('No EstateFlow server answered at that address.');
      }
      await setServerUrl(clean);
      await onSaved?.();
      toast.success('Server saved');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Server address">
      <Field label="EstateFlow server" hint={defaultServerUrl ? `Leave empty to use ${defaultServerUrl}` : 'Leave empty to use the address this app was built with.'}>
        {(id) => (
          <input
            id={id}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            className="field"
            placeholder="https://crm.yourcompany.in"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setResult(null);
            }}
          />
        )}
      </Field>
      {result && (
        <p role="status" className={`rounded-xl px-3 py-2 text-[14px] ${result.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>
          {result.ok ? `Connected in ${result.ms} ms${result.mode ? ` · ${result.mode} server` : ''}${result.version ? ` · v${result.version}` : ''}` : result.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" loading={testing} onClick={test}>
          Test connection
        </Button>
        <Button loading={busy} onClick={save}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}

/** Password reset: the administrator issues a one-time code from the dashboard. */
function ResetSheet({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Reset password">
      <Field label="Email">{(id) => <input id={id} type="email" inputMode="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      {step === 'request' ? (
        <>
          <p className="text-[14px] text-stone-600">We will let your administrator know. They will give you a one-time reset code.</p>
          <Button
            block
            loading={busy}
            onClick={() =>
              run(async () => {
                const r = await api.post<{ message: string }>('/auth/forgot-password', { email: email.trim() });
                toast.success(r.message);
                setStep('code');
              })
            }
          >
            Ask for a reset code
          </Button>
          <Button variant="ghost" block icon={KeyRound} onClick={() => setStep('code')}>
            I already have a code
          </Button>
        </>
      ) : (
        <>
          <Field label="Reset code">{(id) => <input id={id} inputMode="text" autoCapitalize="characters" className="field tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} />}</Field>
          <Field label="New password" hint="At least 8 characters with an uppercase letter and a number.">
            {(id) => <input id={id} type="password" autoComplete="new-password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} />}
          </Field>
          <Button
            block
            loading={busy}
            onClick={() =>
              run(async () => {
                await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), new_password: pw });
                toast.success('Password changed. Sign in with your new password.');
                onClose();
              })
            }
          >
            Set new password
          </Button>
        </>
      )}
    </Sheet>
  );
}
