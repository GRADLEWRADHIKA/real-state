import { fmtDate, inr } from '@estateflow/shared';

/** Ready-to-send WhatsApp texts for customers (Hinglish, as the office writes them). */
const sign = (company?: string | null) => (company ? ` – ${company}` : '');

export const paymentReminderText = (name: string, i: { label: string; balance: number; due_date: string }, company?: string | null) =>
  `Namaste ${name}, aapki kist ${i.label} ${inr(i.balance)} (${fmtDate(i.due_date)}) pending hai. Kripya jald bhugtan karein.${sign(company)}`;

export const receiptText = (name: string, t: { receipt_number?: string | null; code?: string; amount: number; payment_date: string; method: string }, company?: string | null) =>
  `Namaste ${name}, aapka bhugtan ${inr(t.amount)} (${fmtDate(t.payment_date)}, ${t.method}) prapt hua. Receipt no. ${t.receipt_number ?? t.code ?? '—'}. Dhanyavaad!${sign(company)}`;

export const registryReminderText = (name: string, date: string, property?: string | null, company?: string | null) =>
  `Namaste ${name}, aapki ${property ? `property ${property} ki ` : ''}registry ${fmtDate(date)} ko tay hai. Kripya apne documents aur ID taiyaar rakhein.${sign(company)}`;
