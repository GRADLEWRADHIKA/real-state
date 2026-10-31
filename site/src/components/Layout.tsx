import { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Heart, Menu, MessageCircle, Phone, Smartphone, X } from 'lucide-react';
import clsx from 'clsx';
import logo from '../assets/starwiz-logo-512.png';
import mark from '../assets/starwiz-mark.png';
import { site } from '../lib/api';
import { telHref, waHref } from '../lib/format';
import { useCompany } from '../lib/hooks';
import { useShortlist } from '../lib/shortlist';

/** The sign-in (or, when signed in, back-to-work) link the host shows in the header and footer. */
export interface AccountLink {
  to: string;
  label: string;
}
const AccountCtx = createContext<AccountLink>({ to: '/login', label: 'Sign in' });

const NAV = [
  { to: '/homes', label: 'Properties' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

/** Header link to the visitor's on-device shortlist, with the number saved. */
function ShortlistLink({ compact }: { compact?: boolean }) {
  const { slugs } = useShortlist();
  const label = `Shortlist (${slugs.length})`;
  // Shown once something is saved, so the header stays as it was for visitors who never use it.
  if (!slugs.length) return null;
  return compact ? (
    <NavLink to="/homes/shortlist" aria-label={label} className="ml-auto flex items-center gap-1.5 rounded-lg p-2 text-[15px] font-semibold md:hidden">
      <Heart size={19} aria-hidden fill="currentColor" className="text-brass-light" /> {slugs.length}
    </NavLink>
  ) : (
    <NavLink to="/homes/shortlist" className={({ isActive }) => clsx('inline-flex items-center gap-1.5 transition hover:text-brass-light', isActive && 'text-brass-light')}>
      <Heart size={16} aria-hidden fill="currentColor" className="text-brass-light" />
      {label}
    </NavLink>
  );
}

function Header() {
  const c = useCompany();
  const account = useContext(AccountCtx);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-forest/95 text-white backdrop-blur">
      <div className="site-container flex h-16 items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label={`${c.name} home`}>
          <img src={mark} alt="" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight">Starwiz Realty</span>
        </Link>
        <nav aria-label="Website" className="ml-auto hidden items-center gap-7 text-[15px] font-semibold md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx('transition hover:text-brass-light', isActive && 'text-brass-light')}>
              {n.label}
            </NavLink>
          ))}
          <ShortlistLink />
          <Link to={account.to} className="text-white/70 hover:text-white">
            {account.label}
          </Link>
          {c.phone && (
            <a href={telHref(c.phone)} className="site-btn site-btn-brass !py-2">
              <Phone size={16} aria-hidden /> {c.phone}
            </a>
          )}
        </nav>
        <ShortlistLink compact />
        <button type="button" className="ml-auto rounded-lg p-2 md:hidden [a+&]:-ml-4" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Website" className="site-container flex flex-col gap-1 pb-4 text-lg font-semibold md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="rounded-lg px-2 py-2.5 hover:bg-white/10">
              {n.label}
            </NavLink>
          ))}
          <Link to={account.to} className="rounded-lg px-2 py-2.5 text-white/70 hover:bg-white/10">
            {account.label}
          </Link>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const c = useCompany();
  const account = useContext(AccountCtx);
  return (
    <footer className="bg-forest pb-24 text-white/80 md:pb-0">
      <div className="site-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <img src={logo} alt={c.name} width={160} height={160} loading="lazy" className="h-24 w-24 rounded-2xl bg-white/5 object-contain p-2" />
          <p className="mt-4 font-display text-xl text-white">{c.tagline}</p>
          {c.address && <address className="mt-3 max-w-sm text-sm not-italic leading-relaxed">{c.address}</address>}
        </div>
        <div>
          <h2 className="site-eyebrow">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to={account.to} className="hover:text-white">
                {account.label}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="site-eyebrow">Talk to us</h2>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            {c.phone && (
              <li>
                <a href={telHref(c.phone)} className="hover:text-white">
                  {c.phone}
                </a>
              </li>
            )}
            {c.email && (
              <li>
                <a href={`mailto:${c.email}`} className="hover:text-white">
                  {c.email}
                </a>
              </li>
            )}
            {site.appDownloadUrl && (
              <li>
                <a href={site.appDownloadUrl} className="inline-flex items-center gap-2 hover:text-white">
                  <Smartphone size={16} aria-hidden /> Customer app download
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container space-y-2 py-6 text-xs leading-relaxed text-white/55">
          {c.rera && <p>RERA registration: {c.rera}</p>}
          <p>Images on this website are artist's impressions for illustration only and do not form part of any offer or contract. Specifications, prices and availability are subject to change; please confirm details with our team and the registered documents before booking.</p>
          <p>
            © {new Date().getFullYear()} {c.legal_name || c.name}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Call and WhatsApp shortcuts, pinned to the bottom on phones. */
function ContactBar() {
  const c = useCompany();
  if (!c.phone) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-black/10 bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <a href={telHref(c.phone)} className="site-btn site-btn-primary">
        <Phone size={18} aria-hidden /> Call
      </a>
      <a href={waHref(c.whatsapp || c.phone, `Hello ${c.name}, I would like to know more about your properties.`)} target="_blank" rel="noopener" className="site-btn bg-[#1f7a4d] text-white">
        <MessageCircle size={18} aria-hidden /> WhatsApp
      </a>
    </div>
  );
}

export function Layout({ account }: { account: AccountLink }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // The host app's own title comes back when the visitor leaves the website pages.
  const [hostTitle] = useState(() => document.title);
  useEffect(
    () => () => {
      document.title = hostTitle;
    },
    [hostTitle],
  );
  return (
    <AccountCtx.Provider value={account}>
      <div className="min-h-dvh bg-paper font-sans text-ink antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <ContactBar />
      </div>
    </AccountCtx.Provider>
  );
}
