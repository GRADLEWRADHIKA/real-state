import { Link } from 'react-router';
import { useSeo } from '../lib/seo';

export default function NotFound({ title = 'Page not found', text = 'The page you were looking for has moved or no longer exists.' }: { title?: string; text?: string }) {
  useSeo({ title: `${title} · Starwiz Realty`, description: text });
  return (
    <div className="site-container py-28 text-center">
      <p className="site-eyebrow">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-forest">{title}</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">{text}</p>
      <Link to="/homes" className="site-btn site-btn-primary mt-8">
        Browse properties
      </Link>
    </div>
  );
}
