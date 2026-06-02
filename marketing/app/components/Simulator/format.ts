import type { ScheduleRow } from '@loan-engine/loan';

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

/** Evenly downsample a schedule's balances to `points` values, always keeping first and last. */
export function sampleBalances(rows: ScheduleRow[], points: number): number[] {
  if (rows.length <= points) return rows.map((r) => r.balance);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.round((i * (rows.length - 1)) / (points - 1));
    out.push(rows[idx].balance);
  }
  return out;
}
