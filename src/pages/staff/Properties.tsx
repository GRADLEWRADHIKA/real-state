import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Building2, Compass, Ruler, Share2 } from 'lucide-react';
import { PROPERTY_TYPES, inr, inrShort, type Property } from '@estateflow/shared';
import { api } from '@/lib/api';
import { Badge, Button, Card, Empty, KeyValue, Loadable, ListSkeleton, RowLink, Screen, Section, Segmented, StatusBadge } from '@/components/ui';
import { ProgressiveImage, SwipeGallery, websiteLink, shareProperty } from '@/components/gallery';

/** Property browser for field staff: image cards, filters, and a detail page with the gallery. */
export function Properties() {
  const [type, setType] = useState<string>('all');
  const [block, setBlock] = useState<string>('all');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['properties', type, block, q],
    queryFn: () =>
      api.get<{ data: Property[]; meta?: { blocks?: string[] } }>('/properties', { type: type === 'all' ? undefined : type, block: block === 'all' ? undefined : block, q: q || undefined, limit: 100 }),
    placeholderData: (prev) => prev,
  });
  const blocks = query.data?.meta?.blocks ?? [];
  return (
    <Screen title="Properties" back="/more">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project, unit or location" className="input" aria-label="Search properties" />
      <Segmented value={type} onChange={setType} className="overflow-x-auto" options={[{ value: 'all', label: 'All' }, ...PROPERTY_TYPES.filter((t) => t !== 'Commercial').map((t) => ({ value: t, label: t }))]} />
      {(blocks.length > 0 || block !== 'all') && (
        <Segmented value={block} onChange={setBlock} className="overflow-x-auto" options={[{ value: 'all', label: 'All blocks' }, ...blocks.map((b) => ({ value: b, label: `Block ${b}` }))]} />
      )}
      <Loadable q={query} skeleton={<ListSkeleton rows={3} />}>
        {({ data }) =>
          data.length ? (
            <div className="space-y-3">
              {data.map((p) => (
                <RowLink key={p.id} to={`/properties/${p.id}`} className="card block overflow-hidden p-0">
                  <div className="relative">
                    <ProgressiveImage img={p.cover} fallback={p} className="h-44 w-full" />
                    <span className="absolute top-2.5 left-2.5">
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-ink">{p.name}</p>
                      <p className="truncate text-[13px] text-stone-500">
                        {p.project}
                        {p.block ? ` · Block ${p.block}` : ''} · {p.unit_number}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-[17px] font-semibold text-brand-950">{inrShort(p.price)}</p>
                  </div>
                </RowLink>
              ))}
            </div>
          ) : (
            <Empty icon={Building2} title="No properties match" />
          )
        }
      </Loadable>
    </Screen>
  );
}

export function PropertyDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['properties', 'detail', id], queryFn: () => api.get<Property>(`/properties/${id}`) });
  return (
    <Screen title={q.data ? `${q.data.project} · ${q.data.unit_number}` : 'Property'} back="/properties" bleed>
      <Loadable q={q}>
        {(p) => (
          <>
            <SwipeGallery property={p} images={p.images ?? []} />
            <div className="space-y-4 px-4 pb-6">
              <div className="flex items-start justify-between gap-3 pt-1">
                <div>
                  <p className="font-display text-[22px] leading-tight font-semibold text-brand-950">{p.name}</p>
                  <p className="text-[13.5px] text-stone-500">
                    {p.location}, {p.city}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap gap-2 text-[13px] text-stone-600">
                <Badge className="gap-1">
                  <Ruler className="size-3.5" /> {p.area_sqft.toLocaleString('en-IN')} sq ft
                </Badge>
                {p.bedrooms ? (
                  <Badge className="gap-1">
                    <BedDouble className="size-3.5" /> {p.bedrooms} BHK
                  </Badge>
                ) : null}
                {p.facing && (
                  <Badge className="gap-1">
                    <Compass className="size-3.5" /> {p.facing}
                  </Badge>
                )}
              </div>
              <Card className="p-4">
                <KeyValue label="Price">{inr(p.price)}</KeyValue>
                {p.rate_per_sqft ? <KeyValue label="Rate">{inr(p.rate_per_sqft)} / sq ft</KeyValue> : null}
                {p.block && <KeyValue label="Block">{p.block}</KeyValue>}
                {p.possession && <KeyValue label="Possession">{p.possession}</KeyValue>}
                {p.rera_number && <KeyValue label="RERA">{p.rera_number}</KeyValue>}
                <KeyValue label="Website">{websiteLink(p) ? 'Published' : 'Not published'}</KeyValue>
              </Card>
              {p.description && <p className="text-[14px] leading-relaxed text-stone-600">{p.description}</p>}
              {p.amenities.length > 0 && (
                <Section title="Amenities">
                  <div className="flex flex-wrap gap-1.5">
                    {p.amenities.map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                  </div>
                </Section>
              )}
              {(p.images ?? []).some((i) => i.is_ai_generated) && <p className="text-[12px] text-stone-500">Images marked "Artist's impression" are illustrations, not photographs.</p>}
              <Button variant="secondary" icon={Share2} onClick={() => shareProperty(p)} block>
                Share{websiteLink(p) ? ' link' : ''}
              </Button>
            </div>
          </>
        )}
      </Loadable>
    </Screen>
  );
}
