import { describe, expect, it } from 'vitest';
import type { Scenario } from '@loan-engine/loan';
import {
  INVESTMENT_RATE_PRESETS,
  compareAmortizeOrInvest,
  getRegressiveIncomeTaxRate,
  projectInvestment,
} from '../amortize-or-invest';

const scenario: Scenario = {
  id: 'comparison',
  name: 'Contrato para comparar',
  system: 'PRICE',
  loanMode: 'standard',
  principal: 200_000,
  rate: 1,
  rateType: 'monthly',
  term: 120,
  termUnit: 'months',
  startDate: new Date(2026, 7, 1),
  dueDay: 5,
  prepayments: [],
  fgtsEvents: [],
};

describe('amortizar ou investir', () => {
  it.each([
    [180, 0.225],
    [181, 0.2],
    [360, 0.2],
    [361, 0.175],
    [720, 0.175],
    [721, 0.15],
  ])('applies the regressive IR bracket at %s calendar days', (horizonDays, expectedRate) => {
    expect(getRegressiveIncomeTaxRate(horizonDays)).toBe(expectedRate);
  });

  it('projects compound gross return and taxes only the profit', () => {
    const projection = projectInvestment({
      principal: 10_000,
      annualRate: 12,
      horizonMonths: 12,
      horizonDays: 365,
    });

    expect(projection.grossBalance).toBeCloseTo(11_200, 2);
    expect(projection.grossProfit).toBeCloseTo(1_200, 2);
    expect(projection.taxRate).toBe(0.175);
    expect(projection.taxAmount).toBeCloseTo(210, 2);
    expect(projection.netBalance).toBeCloseTo(10_990, 2);
    expect(projection.netProfit).toBeCloseTo(990, 2);
  });

  it('supports an exempt investment tax regime', () => {
    const projection = projectInvestment({
      principal: 10_000,
      annualRate: 12,
      horizonMonths: 12,
      horizonDays: 365,
      taxRegime: 'exempt',
    });

    expect(projection.taxRate).toBe(0);
    expect(projection.taxAmount).toBe(0);
    expect(projection.netBalance).toBe(projection.grossBalance);
  });

  it('compares both paths through the engine and reports the flip rate', () => {
    const result = compareAmortizeOrInvest({
      scenario,
      extraAmount: 20_000,
      investmentAnnualRate: 8,
      horizonMonths: 60,
    });

    expect(result.amortization.interestSaved).toBeGreaterThan(0);
    expect(result.amortization.newPayoffDate.getTime()).toBeLessThan(
      result.amortization.originalPayoffDate.getTime(),
    );
    expect(result.amortization.horizonValue).toBeGreaterThan(20_000);
    expect(result.amortization.equivalentAnnualReturn).toBeGreaterThan(11);
    expect(result.investment.netBalance).toBeLessThan(result.amortization.horizonValue);
    expect(result.winner).toBe('amortize');
    expect(result.flipAnnualRate).toBeGreaterThan(8);

    const atFlip = compareAmortizeOrInvest({
      scenario,
      extraAmount: 20_000,
      investmentAnnualRate: result.flipAnnualRate,
      horizonMonths: 60,
    });
    expect(atFlip.winner).toBe('tie');
    expect(atFlip.difference).toBeLessThan(0.01);
  });

  it('reinvests installment savings symmetrically through the selected horizon', () => {
    const shortScenario = { ...scenario, term: 24 };
    const withoutReinvestment = compareAmortizeOrInvest({
      scenario: shortScenario,
      extraAmount: 100_000,
      investmentAnnualRate: 0,
      horizonMonths: 24,
    });
    const withReinvestment = compareAmortizeOrInvest({
      scenario: shortScenario,
      extraAmount: 100_000,
      investmentAnnualRate: 12,
      horizonMonths: 24,
    });

    expect(withReinvestment.amortization.horizonValue).toBeGreaterThan(
      withoutReinvestment.amortization.horizonValue,
    );
    expect(withReinvestment.amortization.equivalentAnnualReturn).toBeCloseTo(
      withoutReinvestment.amortization.equivalentAnnualReturn,
      6,
    );
  });

  it('can select investing when its net return beats the debt reduction', () => {
    const result = compareAmortizeOrInvest({
      scenario,
      extraAmount: 20_000,
      investmentAnnualRate: 30,
      horizonMonths: 60,
    });

    expect(result.winner).toBe('invest');
    expect(result.difference).toBeGreaterThan(0);
  });

  it('rejects invalid amounts, rates and horizons instead of returning garbage', () => {
    expect(() =>
      compareAmortizeOrInvest({
        scenario,
        extraAmount: 0,
        investmentAnnualRate: 12,
        horizonMonths: 12,
      }),
    ).toThrow('Informe um valor extra maior que zero.');
    expect(() =>
      compareAmortizeOrInvest({
        scenario,
        extraAmount: 20_000,
        investmentAnnualRate: -1,
        horizonMonths: 12,
      }),
    ).toThrow('Informe uma rentabilidade anual válida.');
    expect(() =>
      compareAmortizeOrInvest({
        scenario,
        extraAmount: 20_000,
        investmentAnnualRate: 12,
        horizonMonths: 0,
      }),
    ).toThrow('Informe um horizonte inteiro maior que zero.');
    expect(() =>
      compareAmortizeOrInvest({
        scenario,
        extraAmount: scenario.principal + 1,
        investmentAnnualRate: 12,
        horizonMonths: 12,
      }),
    ).toThrow('O valor extra não pode superar o saldo devedor.');
  });

  it('keeps versioned CDI and Tesouro Selic presets with source metadata', () => {
    expect(Object.keys(INVESTMENT_RATE_PRESETS)).toEqual(['cdi', 'tesouro_selic']);
    for (const preset of Object.values(INVESTMENT_RATE_PRESETS)) {
      expect(preset.annualRate).toBeGreaterThan(0);
      expect(preset.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(preset.sourceUrl).toMatch(/^https:\/\//);
      expect(preset.disclaimer).toContain('estimativa');
    }
    expect(INVESTMENT_RATE_PRESETS.tesouro_selic.asOf).toBe('2026-06-18');
  });
});
