import { describe, expect, it } from 'vitest';
import { formatPercent, sampleBalances } from '../format';
import type { ScheduleRow } from '@loan-engine/loan';

describe('formatPercent', () => {
  it('formats with pt-BR comma and one decimal', () => {
    expect(formatPercent(13.84)).toBe('13,8%');
  });
});

describe('sampleBalances', () => {
  const rows: ScheduleRow[] = Array.from({ length: 361 }, (_, i) => ({
    installmentNumber: i,
    date: new Date(2026, 0, 1),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: 361 - i, // strictly decreasing 361..1
  }));

  it('downsamples to the requested point count, keeping first and last', () => {
    const out = sampleBalances(rows, 24);
    expect(out).toHaveLength(24);
    expect(out[0]).toBe(361);
    expect(out[out.length - 1]).toBe(1);
  });

  it('never returns more points than rows', () => {
    expect(sampleBalances(rows.slice(0, 5), 24)).toHaveLength(5);
  });
});
