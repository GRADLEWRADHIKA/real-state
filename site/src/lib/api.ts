/** EstateFlow public API client for the website. No other network services are used. */
export interface SiteConfig {
  /** API origin without /api; empty means same origin. A function so the app can change servers at runtime. */
  apiUrl: () => string;
  /** Where customers get the EstateFlow app (dashboard only; empty hides the link). */
  appDownloadUrl?: string;
}

const config: SiteConfig = { apiUrl: () => '' };

/** Called once by the dashboard and the app before rendering. */
export function configureSite(c: Partial<SiteConfig>) {
  Object.assign(config, c);
}

export const site = {
  get apiUrl() {
    return config.apiUrl().replace(/\/+$/, '');
  },
  get appDownloadUrl() {
    return config.appDownloadUrl || '';
  },
};

export type Size = 'thumb' | 'medium' | 'large';
export interface Img {
  id: number;
  alt_text: string;
  caption?: string | null;
  kind: string;
  is_cover: boolean;
  is_ai_generated: boolean;
  width?: number | null;
  height?: number | null;
  urls: Record<Size, string>;
}
export interface Property {
  id: number;
  slug: string;
  name: string;
  project: string;
  type: string;
  location: string;
  city: string;
  unit_number: string;
  tower?: string | null;
  floor?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqft: number;
  price: number;
  status: string;
  facing?: string | null;
  furnishing?: string | null;
  parking?: number | null;
  possession?: string | null;
  construction_stage?: string | null;
  rera_number?: string | null;
  description?: string | null;
  amenities: string[];
  cover: Img | null;
  images: Img[];
}
export interface Company {
  name: string;
  legal_name?: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  rera?: string;
  whatsapp?: string;
  testimonials: { name: string; quote: string; place?: string }[];
}
export interface Page<T> {
  data: T[];
  meta: { page: number; pages: number; total: number; hasMore: boolean; facets?: { type: string; n: number; min_price: number; max_price: number }[] };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '') as [string, string][]).toString() : '';
  let res: Response;
  try {
    res = await fetch(`${site.apiUrl}/api/public${path}${qs ? `?${qs}` : ''}`);
  } catch {
    throw new ApiError('We could not reach our listings right now. Please try again shortly.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || body.message || 'Something went wrong', res.status);
  return body as T;
}

export async function post<T>(path: string, data: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${site.apiUrl}/api/public${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch {
    throw new ApiError('No connection. Please check your internet and try again, or call us.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || body.message || 'Your message could not be sent', res.status);
  return body as T;
}

export const media = (img: Img, size: Size) => `${site.apiUrl}${img.urls[size]}`;
export const srcSet = (img: Img) => `${media(img, 'thumb')} 400w, ${media(img, 'medium')} 900w, ${media(img, 'large')} 1600w`;
