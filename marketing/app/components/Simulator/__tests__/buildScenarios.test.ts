import { describe, expect, it } from 'vitest';
import { buildScenarios } from '../buildScenarios';
import { DEFAULT_INPUTS } from '../types';
import {
  generateAmortizationSchedule,
  calculateLoanSummary,
} from '@loan-engine/calculations';

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

  it('produces summaries where SAC first payment > last and PRICE is flat', () => {
    const { sac, price } = buildScenarios(DEFAULT_INPUTS);
    const sacSum = calculateLoanSummary(generateAmortizationSchedule(sac), sac);
    const priceSum = calculateLoanSummary(generateAmortizationSchedule(price), price);
    expect(sacSum.firstPayment).toBeGreaterThan(sacSum.lastPayment);
    expect(priceSum.firstPayment).toBeCloseTo(priceSum.lastPayment, 0);
    expect(sacSum.cetAnnualRate).toBeGreaterThan(0);
  });
});
