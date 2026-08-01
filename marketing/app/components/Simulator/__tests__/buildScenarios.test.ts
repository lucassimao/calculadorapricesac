import { describe, expect, it } from 'vitest';
import { buildScenarios } from '../buildScenarios';
import { DEFAULT_INPUTS } from '../types';
import { generateAmortizationSchedule, calculateLoanSummary } from '@loan-engine/calculations';

describe('buildScenarios', () => {
  it('derives the financed principal from propertyValue - downPayment', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    expect(sac.principal).toBe(320000);
    expect(price.principal).toBe(320000);
    expect(sac.propertyValue).toBe(400000);
    expect(sac.downPayment).toBe(80000);
    expect(sac.loanMode).toBe('property');
  });

  it('sets the two systems, annual rate, and year term', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    expect(sac.system).toBe('SAC');
    expect(price.system).toBe('PRICE');
    expect(sac.rate).toBe(11.5);
    expect(sac.rateType).toBe('annual');
    expect(sac.term).toBe(30);
    expect(sac.termUnit).toBe('years');
  });

  it('keeps regular PRICE installments flat and exposes the final cent-ledger true-up', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    const sacSchedule = generateAmortizationSchedule(sac);
    const priceSchedule = generateAmortizationSchedule(price);
    const sacSum = calculateLoanSummary(sacSchedule, sac);
    const priceSum = calculateLoanSummary(priceSchedule, price);
    const regularPricePayments = priceSchedule.slice(1, -1).map((row) => row.payment);

    expect(sacSum.firstPayment).toBeGreaterThan(sacSum.lastPayment);
    expect(regularPricePayments.every((payment) => payment === priceSum.firstPayment)).toBe(true);
    expect(priceSum.firstPayment).toBe(3031.72);
    // Before the cent ledger, the test treated the final payment as flat. The reconciled
    // ledger makes the accumulated rounding explicit in a 3031.72 -> 3029.05 true-up.
    expect(priceSum.lastPayment).toBe(3029.05);
    expect(sacSum.cet).toMatchObject({ status: 'available', root: 'positive' });
    if (sacSum.cet.status === 'available') {
      expect(sacSum.cet.annualRate).toBeGreaterThan(0);
    }
  });
});
