import { describe, expect, it } from 'vitest';
import type { Scenario } from '../../types/loan';
import { buildQuickComparisonScenario } from '../comparison';

const baseScenario: Scenario = {
  id: 'quick',
  name: 'Condição A',
  system: 'PRICE',
  loanMode: 'standard',
  principal: 300000,
  rate: 1.2,
  rateType: 'monthly',
  term: 360,
  termUnit: 'months',
  startDate: new Date(2026, 0, 1),
  dueDay: 5,
  prepayments: [],
};

describe('buildQuickComparisonScenario', () => {
  it('reduces the financed principal by the down payment', () => {
    const result = buildQuickComparisonScenario(300000, {
      ...baseScenario,
      downPayment: 50000,
    });

    expect(result.loanMode).toBe('property');
    expect(result.propertyValue).toBe(300000);
    expect(result.principal).toBe(250000);
  });

  it('preserves the financed principal when there is no down payment', () => {
    const result = buildQuickComparisonScenario(300000, baseScenario);

    expect(result.propertyValue).toBe(300000);
    expect(result.principal).toBe(300000);
  });

  it('clamps the financed principal at zero when down payment exceeds the base amount', () => {
    const result = buildQuickComparisonScenario(300000, {
      ...baseScenario,
      downPayment: 350000,
    });

    expect(result.propertyValue).toBe(300000);
    expect(result.principal).toBe(0);
  });
});
