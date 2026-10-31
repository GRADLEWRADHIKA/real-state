import { Route } from 'react-router';
import { Layout, type AccountLink } from './components/Layout';
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Shortlist from './pages/Shortlist';
import Compare from './pages/Compare';
import About from './pages/About';
import Contact from './pages/Contact';

/** Website paths. They sit beside the host's own routes, so none of them may clash with a CRM screen. */
export const SITE_PATHS = { home: '/', homes: '/homes', shortlist: '/homes/shortlist', compare: '/homes/compare', about: '/about', contact: '/contact' } as const;
export const sitePropertyPath = (slug: string) => `${SITE_PATHS.homes}/${encodeURIComponent(slug)}`;

/**
 * The public website as routes for the dashboard and the app. Call it inside the host's <Routes>
 * (as a function, not a component). `withHome` mounts the home page at "/", which the hosts do only
 * for visitors who are not signed in; the listing, property, about and contact pages are always open.
 */
export function siteRoutes({ account, withHome }: { account: AccountLink; withHome: boolean }) {
  return (
    <Route element={<Layout account={account} />}>
      {withHome && <Route index element={<Home />} />}
      <Route path="homes" element={<Properties />} />
      {/* Before homes/:slug so these two are not read as property slugs. */}
      <Route path="homes/shortlist" element={<Shortlist />} />
      <Route path="homes/compare" element={<Compare />} />
      <Route path="homes/:slug" element={<PropertyDetail />} />
      <Route path="about" element={<About />} />
      <Route path="contact" element={<Contact />} />
    </Route>
  );
}
