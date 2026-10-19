export function inrShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 ? 2 : 0).replace(/\.?0+$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0).replace(/\.0$/, '')} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}
export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const telHref = (phone?: string) => `tel:${(phone ?? '').replace(/[^\d+]/g, '')}`;
export function waHref(phone: string | undefined, text: string) {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  if (d.startsWith('0')) d = `91${d.slice(1)}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
export const BUDGETS = [
  { label: 'Any budget', min: undefined, max: undefined },
  { label: 'Under ₹30 L', min: undefined, max: 3_000_000 },
  { label: '₹30 L – ₹60 L', min: 3_000_000, max: 6_000_000 },
  { label: '₹60 L – ₹1 Cr', min: 6_000_000, max: 10_000_000 },
  { label: 'Above ₹1 Cr', min: 10_000_000, max: undefined },
] as const;
export const TYPES = ['Villa', 'Apartment', 'Plot', 'Shop', 'Office', 'Commercial'];
