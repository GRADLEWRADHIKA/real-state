import { useId, useState } from 'react';
import { inr } from '../lib/format';

/** Standard reducing-balance EMI, computed in the browser. Indicative only. */
export function emi(principal: number, annualRate: number, years: number) {
  const n = years * 12;
  const r = annualRate / 12 / 100;
  if (principal <= 0 || n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

function Slider({ label, value, set, min, max, step, show }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; show: string }) {
  const uid = useId();
  return (
    <div>
      <div className="flex justify-between text-sm">
        <label htmlFor={`${uid}-${label}`} className="font-semibold">
          {label}
        </label>
        <span className="font-bold text-forest">{show}</span>
      </div>
      <input id={`${uid}-${label}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-2 w-full accent-forest" />
    </div>
  );
}

export function EmiCalculator({ price }: { price: number }) {
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const loan = Math.round(price * (1 - down / 100));
  const m = emi(loan, rate, years);
  const total = m * years * 12;
  return (
    <div className="grid gap-6 rounded-2xl border border-black/5 bg-white p-6 md:grid-cols-2">
      <div className="space-y-5">
        <Slider label="Down payment" value={down} set={setDown} min={10} max={90} step={5} show={`${down}% · ${inr(price * (down / 100))}`} />
        <Slider label="Interest rate" value={rate} set={setRate} min={6} max={14} step={0.1} show={`${rate.toFixed(1)}% p.a.`} />
        <Slider label="Tenure" value={years} set={setYears} min={5} max={30} step={1} show={`${years} years`} />
      </div>
      <div className="flex flex-col justify-center rounded-xl bg-forest p-6 text-white" aria-live="polite">
        <p className="text-sm text-white/70">Estimated monthly EMI</p>
        <p className="mt-1 font-display text-4xl font-semibold">{inr(m)}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-white/60">Loan amount</dt>
            <dd className="font-semibold">{inr(loan)}</dd>
          </div>
          <div>
            <dt className="text-white/60">Total interest</dt>
            <dd className="font-semibold">{inr(Math.max(0, total - loan))}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs text-white/55">Indicative figures only. Your bank decides the final rate, eligibility and EMI.</p>
      </div>
    </div>
  );
}
