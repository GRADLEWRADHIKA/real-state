import { useEffect } from 'react';

function meta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Per-page title, description, Open Graph tags and JSON-LD (no third-party scripts). */
export function useSeo(o: { title: string; description: string; image?: string; jsonLd?: object | object[] }) {
  const ld = JSON.stringify(o.jsonLd ?? null);
  useEffect(() => {
    document.title = o.title;
    meta('name', 'description', o.description);
    meta('property', 'og:title', o.title);
    meta('property', 'og:description', o.description);
    meta('property', 'og:url', location.href);
    if (o.image) meta('property', 'og:image', o.image);
    let script = document.getElementById('ld-json');
    if (ld !== 'null') {
      if (!script) {
        script = document.createElement('script');
        script.id = 'ld-json';
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = ld;
    } else script?.remove();
  }, [o.title, o.description, o.image, ld]);
}
