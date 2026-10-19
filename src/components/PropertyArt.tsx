import clsx from 'clsx';

const cn = clsx;

const PALETTES = [
  { bg: ['#e9f2ec', '#d3e6da'], line: '#0f5132', accent: '#c59d09' },
  { bg: ['#f5efdf', '#eadcb6'], line: '#6b5207', accent: '#0f5132' },
  { bg: ['#e8eef3', '#d3dee8'], line: '#284a66', accent: '#c59d09' },
  { bg: ['#f3ebe5', '#e6d5c8'], line: '#7a4325', accent: '#0f5132' },
];
const PROJECT_TONE: Record<string, number> = {
  'Green Valley Plots': 0,
  'Green Valley Villas': 1,
  'Green Valley Residency': 2,
  'Green Valley Commercial': 3,
};

/** Architectural line-art placeholder per property type (no stock photos needed offline). */
export function PropertyArt({ type, project, seed = 0, className, label }: { type: string; project?: string; seed?: number; className?: string; label?: string }) {
  const p = PALETTES[project && project in PROJECT_TONE ? PROJECT_TONE[project] : seed % PALETTES.length];
  const id = `g${seed}${type}`.replace(/\W/g, '');
  const s = {
    stroke: p.line,
    strokeWidth: 1.6,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const v = seed % 3;
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.bg[0]} />
            <stop offset="1" stopColor={p.bg[1]} />
          </linearGradient>
        </defs>
        <rect width="320" height="200" fill={`url(#${id})`} />
        <circle cx={150 + v * 22} cy="40" r="16" fill={p.accent} opacity="0.16" />
        <path d="M0 168 H320" {...s} opacity="0.5" />
        {type === 'Plot' && (
          <g>
            <path d="M70 160 L110 104 H230 L262 160 Z" {...s} />
            <path d="M90 132 H246 M150 104 L136 160 M190 104 L200 160" {...s} opacity="0.4" strokeDasharray="4 5" />
            <path d="M118 104 V92 M118 92 l10 4 l-10 4" {...s} />
            {[44, 284].map((x) => (
              <g key={x} opacity="0.75">
                <circle cx={x} cy="140" r="14" {...s} />
                <path d={`M${x} 154 V168`} {...s} />
              </g>
            ))}
          </g>
        )}
        {type === 'Villa' && (
          <g>
            <path d="M92 168 V112 L150 74 L208 112 V168" {...s} />
            <path d="M82 118 L150 70 L218 118" {...s} opacity="0.6" />
            <path d="M208 168 V126 H250 V168 M200 126 L229 104 L258 126" {...s} />
            <rect x="138" y="132" width="24" height="36" rx="2" {...s} />
            <rect x="106" y="122" width="20" height="18" rx="2" {...s} opacity="0.7" />
            <rect x="174" y="122" width="20" height="18" rx="2" {...s} opacity="0.7" />
            <rect x="218" y="138" width="22" height="14" rx="2" {...s} opacity="0.6" />
            <g opacity="0.7">
              <circle cx="56" cy="146" r="13" {...s} />
              <path d="M56 159 V168" {...s} />
            </g>
          </g>
        )}
        {type === 'Apartment' && (
          <g>
            <rect x="118" y="34" width="84" height="134" rx="3" {...s} />
            <rect x="214" y="78" width="54" height="90" rx="3" {...s} opacity="0.6" />
            <rect x="58" y="96" width="48" height="72" rx="3" {...s} opacity="0.6" />
            {Array.from({ length: 6 }).map((_, r) => Array.from({ length: 4 }).map((__, c) => <rect key={`${r}${c}`} x={128 + c * 18} y={46 + r * 19} width="10" height="11" rx="1.5" fill={p.line} opacity={(r + c + v) % 5 === 0 ? 0.5 : 0.14} />))}
            <rect x="148" y="150" width="24" height="18" rx="2" {...s} />
          </g>
        )}
        {(type === 'Shop' || type === 'Commercial' || type === 'Office') && (
          <g>
            <rect x="64" y={type === 'Office' ? 46 : 84} width="192" height={type === 'Office' ? 122 : 84} rx="3" {...s} />
            {type === 'Office' && Array.from({ length: 3 }).map((_, r) => <path key={r} d={`M64 ${76 + r * 26} H256`} {...s} opacity="0.35" />)}
            <path d="M64 108 H256" {...s} opacity="0.6" />
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M${64 + i * 48} 84 q24 18 48 0`} {...s} opacity="0.55" />
            ))}
            <rect x="82" y="120" width="48" height="48" rx="2" {...s} opacity="0.75" />
            <rect x="190" y="120" width="48" height="48" rx="2" {...s} opacity="0.75" />
            <rect x="142" y="126" width="36" height="42" rx="2" {...s} />
          </g>
        )}
      </svg>
      {label && <span className="absolute bottom-2.5 left-2.5 rounded-md bg-white/85 px-2 py-0.5 text-[11.5px] font-bold text-stone-800 shadow-sm backdrop-blur">{label}</span>}
    </div>
  );
}
