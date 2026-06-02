import { describe, expect, it } from 'vitest';
import {
  generateAmortizationSchedule,
  calculateLoanSummary,
} from '@loan-engine/calculations';
import type { Scenario } from '@loan-engine/loan';

function base(system: 'SAC' | 'PRICE'): Scenario {
  return {
    id: 't',
    name: 'parity',
    system,
    loanMode: 'property',
    propertyValue: 400000,
    downPayment: 80000,
    principal: 320000,
    rate: 11.5,
    rateType: 'annual',
    term: 30,
    termUnit: 'years',
    startDate: new Date(2026, 0, 1),
    dueDay: 1,
  };
}

describe('shared engine is reachable from marketing', () => {
  it('produces a 361-row schedule (row 0 + 360 months) for a 30y loan', () => {
    const schedule = generateAmortizationSchedule(base('SAC'));
    expect(schedule).toHaveLength(361);
  });

  it('SAC pays less total interest than PRICE for the same loan', () => {
    const sac = calculateLoanSummary(generateAmortizationSchedule(base('SAC')), base('SAC'));
    const price = calculateLoanSummary(generateAmortizationSchedule(base('PRICE')), base('PRICE'));
    expect(sac.totalInterest).toBeLessThan(price.totalInterest);
  });
});
