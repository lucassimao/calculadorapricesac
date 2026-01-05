import { describe, expect, it } from 'vitest';
import {
  calculatePricePayment,
  calculateLoanSummary,
  convertRateToMonthly,
  generateAmortizationSchedule,
  validateScenario,
} from '../calculations';
import type { Scenario } from '../../types/loan';

const baseScenario: Scenario = {
  id: 'test',
  name: 'Teste',
  system: 'PRICE',
  principal: 10000,
  rate: 1,
  rateType: 'monthly',
  term: 12,
  termUnit: 'months',
  startDate: new Date(2026, 0, 1),
  dueDay: 5,
  prepayments: [],
};

describe('generateAmortizationSchedule', () => {
  it('matches spreadsheet values for Price example', () => {
    const schedule = generateAmortizationSchedule({ ...baseScenario, system: 'PRICE' });
    const firstPayment = schedule[1];

    expect(firstPayment.interest).toBeCloseTo(100, 2);
    expect(firstPayment.payment).toBeCloseTo(888.49, 2);
    expect(firstPayment.amortization).toBeCloseTo(788.49, 2);
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 2);
  });

  it('matches spreadsheet values for SAC example', () => {
    const schedule = generateAmortizationSchedule({ ...baseScenario, system: 'SAC' });
    const firstPayment = schedule[1];

    expect(firstPayment.interest).toBeCloseTo(100, 2);
    expect(firstPayment.amortization).toBeCloseTo(833.33, 2);
    expect(firstPayment.payment).toBeCloseTo(933.33, 2);
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 2);
  });

  it('stops schedule when reduce_term prepayment pays off balance', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      system: 'PRICE',
      prepayments: [
        {
          id: 'p1',
          date: new Date('2026-01-05T00:00:00Z'),
          amount: 9500,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    });

    const last = schedule[schedule.length - 1];
    expect(last.balance).toBeCloseTo(0, 2);
    expect(schedule.length).toBeLessThan(baseScenario.term + 1);
  });

  it('recalculates payment when reduce_payment prepayment is used', () => {
    const baseline = generateAmortizationSchedule({ ...baseScenario, system: 'PRICE' });
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      system: 'PRICE',
      prepayments: [
        {
          id: 'p2',
          date: new Date(2026, 1, 5),
          amount: 5000,
          type: 'fixed_amount',
          strategy: 'reduce_payment',
        },
      ],
    });

    const paymentBefore = schedule[1].payment;
    const paymentAfter = schedule[3]?.payment ?? paymentBefore;
    expect(paymentAfter).toBeLessThanOrEqual(paymentBefore);

    const baselineMonth2 = baseline[2];
    const withPrepayMonth2 = schedule[2];
    expect(withPrepayMonth2.payment).toBeGreaterThan(baselineMonth2.payment);
    expect(withPrepayMonth2.prepaymentAmount).toBeCloseTo(5000, 2);
    expect(withPrepayMonth2.balance).toBeLessThan(baselineMonth2.balance);
  });
});

describe('calculateLoanSummary', () => {
  it('computes summary totals from schedule', () => {
    const schedule = generateAmortizationSchedule({ ...baseScenario, system: 'PRICE' });
    const summary = calculateLoanSummary(schedule, baseScenario);

    expect(summary.totalPayment).toBeGreaterThan(0);
    expect(summary.totalInterest).toBeGreaterThan(0);
    expect(summary.firstPayment).toBeCloseTo(schedule[1].payment, 2);
    expect(summary.lastPayment).toBeCloseTo(schedule[schedule.length - 1].payment, 2);
  });

  it('includes upfront and monthly costs in totals', () => {
    const scenario = {
      ...baseScenario,
      principal: 100000,
      includeIOF: true,
      iofRate: 2,
      includeOpeningFee: true,
      openingFee: 1500,
      includeInsurance: true,
      insuranceRate: 0.1,
    };
    const schedule = generateAmortizationSchedule(scenario);
    const summary = calculateLoanSummary(schedule, scenario);

    expect(summary.totalUpfrontCosts).toBeGreaterThan(0);
    expect(summary.totalMonthlyCosts).toBeGreaterThan(0);
    expect(summary.totalPaymentWithCosts).toBeGreaterThan(summary.totalPayment);
    expect(summary.cetAnnualRate).toBeGreaterThan(0);
  });

  it('applies FGTS down payment and installment subsidy', () => {
    const scenario = {
      ...baseScenario,
      fgtsEvents: [
        {
          id: 'fgts-down',
          date: new Date(2026, 0, 1),
          amount: 2000,
          usage: 'down_payment' as const,
        },
        {
          id: 'fgts-install',
          date: new Date(2026, 0, 5),
          amount: 500,
          usage: 'installment' as const,
        },
      ],
    };
    const schedule = generateAmortizationSchedule(scenario);
    const summary = calculateLoanSummary(schedule, scenario);

    expect(summary.financedPrincipal).toBeCloseTo(baseScenario.principal, 2);
    expect(summary.totalFgtsUsed).toBeGreaterThan(0);
    expect(summary.totalPaymentNet).toBeLessThan(summary.totalPayment);
    expect(schedule[1]?.netPayment).toBeLessThanOrEqual(schedule[1]?.payment ?? 0);
  });
});

describe('validateScenario', () => {
  it('flags invalid inputs', () => {
    const result = validateScenario({
      ...baseScenario,
      principal: 0,
      rate: 0,
      term: 0,
      dueDay: 0,
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns on suspicious rate types', () => {
    const result = validateScenario({
      ...baseScenario,
      rate: 12,
      rateType: 'monthly',
    });

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('validates property value and down payment', () => {
    const result = validateScenario({
      ...baseScenario,
      loanMode: 'property',
      propertyValue: 500000,
      downPayment: 600000,
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns when cost toggles are enabled without values', () => {
    const result = validateScenario({
      ...baseScenario,
      includeInsurance: true,
      includeAdminFee: true,
      includeIOF: true,
      includeOpeningFee: true,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('rate conversions and payment edge cases', () => {
  it('converts annual rate to monthly effective rate', () => {
    const monthly = convertRateToMonthly(12, true);
    expect(monthly).toBeCloseTo(0.009488, 4);
  });

  it('uses principal/term when rate is zero', () => {
    const payment = calculatePricePayment(12000, 0, 12);
    expect(payment).toBeCloseTo(1000, 2);
  });
});
