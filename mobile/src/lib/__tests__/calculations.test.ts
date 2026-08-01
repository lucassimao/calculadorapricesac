import { describe, expect, it } from 'vitest';
import {
  calculatePricePayment,
  calculateLoanSummary,
  convertRateToMonthly,
  CET_UNAVAILABLE_LABEL,
  formatCetResult,
  generateAmortizationSchedule,
  solveCet,
  validateScenario,
} from '@loan-engine/calculations';
import type { Scenario } from '@loan-engine/loan';

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
          date: new Date('2026-02-05T00:00:00Z'),
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
          date: new Date(2026, 2, 5),
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

describe('generateAmortizationSchedule with monetary correction', () => {
  const indexedBase: Scenario = {
    ...baseScenario,
    name: 'Indexado',
    indexType: 'TR',
    indexRate: 0.5,
  };

  it('applies PRICE correction before interest and recalculates payment', () => {
    const schedule = generateAmortizationSchedule(indexedBase);

    expect(schedule[1].indexCorrection).toBeCloseTo(50, 2);
    expect(schedule[1].interest).toBeCloseTo(100.5, 2);
    expect(schedule[1].payment).toBeGreaterThan(
      generateAmortizationSchedule(baseScenario)[1].payment,
    );
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
  });

  it('applies SAC correction before interest and recalculates amortization', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      system: 'SAC',
      indexType: 'IPCA',
    });

    expect(schedule[1].indexCorrection).toBeCloseTo(50, 2);
    expect(schedule[1].interest).toBeCloseTo(100.5, 2);
    expect(schedule[1].amortization).toBeCloseTo(837.5, 2);
    expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
  });

  it('supports negative correction rates as balance reductions', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      indexType: 'IPCA',
      indexRate: -0.25,
    });

    expect(schedule[1].indexCorrection).toBeCloseTo(-25, 2);
    expect(schedule[1].interest).toBeCloseTo(99.75, 2);
  });

  it('reports clamped correction when a negative rate floors balance at zero', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      principal: 10000,
      indexRate: -150,
    });

    expect(schedule[1].balance).toBeCloseTo(0, 2);
    expect(schedule[1].indexCorrection).toBeCloseTo(-10000, 2);
  });

  it('omits indexCorrection when no index is active', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      indexType: undefined,
      indexRate: undefined,
    });

    expect(schedule[1].indexCorrection).toBeUndefined();
  });

  it('applies prepayments against the corrected balance', () => {
    const schedule = generateAmortizationSchedule({
      ...indexedBase,
      prepayments: [
        {
          id: 'p-index',
          date: new Date(2026, 1, 5),
          amount: 100,
          type: 'percentage',
          strategy: 'reduce_term',
        },
      ],
    });

    expect(schedule[1].indexCorrection).toBeCloseTo(50, 2);
    expect(schedule[1].prepaymentAmount).toBeCloseTo(9257.57, 2);
    expect(schedule.at(-1)?.balance).toBeCloseTo(0, 2);
  });
});

describe('calculateLoanSummary', () => {
  it('computes summary totals from schedule', () => {
    const schedule = generateAmortizationSchedule({ ...baseScenario, system: 'PRICE' });
    const summary = calculateLoanSummary(schedule, baseScenario);

    expect(summary.totalPayment).toBeGreaterThan(0);
    expect(summary.totalInterest).toBeGreaterThan(0);
    expect(summary.totalIndexCorrection).toBe(0);
    expect(summary.firstPayment).toBeCloseTo(schedule[1].payment, 2);
    expect(summary.lastPayment).toBeCloseTo(schedule[schedule.length - 1].payment, 2);
  });

  it('aggregates total monetary correction', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      indexType: 'TR',
      indexRate: 0.5,
    });
    const summary = calculateLoanSummary(schedule, {
      ...baseScenario,
      indexType: 'TR',
      indexRate: 0.5,
    });
    const expectedCorrection = schedule.reduce(
      (total, row) => total + (row.indexCorrection ?? 0),
      0,
    );

    expect(summary.totalIndexCorrection).toBeCloseTo(expectedCorrection, 2);
    expect(summary.totalIndexCorrection).toBeGreaterThan(0);
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
    expect(summary.cet).toMatchObject({ status: 'available', root: 'positive' });
    if (summary.cet.status === 'available') {
      expect(summary.cet.annualRate).toBeGreaterThan(0);
    }
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
          date: new Date(2026, 1, 5),
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

  it('tracks FGTS amortization even when the event has a custom description', () => {
    const scenario = {
      ...baseScenario,
      fgtsEvents: [
        {
          id: 'fgts-amort',
          date: new Date(2026, 1, 5),
          amount: 800,
          usage: 'amortization' as const,
          strategy: 'reduce_term' as const,
          description: 'Dev FGTS',
        },
      ],
    };
    const schedule = generateAmortizationSchedule(scenario);
    const summary = calculateLoanSummary(schedule, scenario);

    expect(schedule[1]?.prepaymentAmount).toBeCloseTo(800, 2);
    expect(schedule[1]?.fgtsAmortization).toBeCloseTo(800, 2);
    expect(summary.totalFgtsUsed).toBeCloseTo(800, 2);
  });

  it('returns an available exact-zero CET for a zero-rate no-fee loan', () => {
    const scenario = { ...baseScenario, rate: 0 };
    const summary = calculateLoanSummary(generateAmortizationSchedule(scenario), scenario);

    expect(summary.cet).toEqual({ status: 'available', root: 'zero', annualRate: 0 });
  });

  it('returns an available negative CET when FGTS subsidy makes borrower outflows lower', () => {
    const scenario = {
      ...baseScenario,
      rate: 0,
      fgtsEvents: [
        {
          id: 'fgts-negative-cet',
          date: new Date(2026, 1, 5),
          amount: 1000,
          usage: 'installment' as const,
        },
      ],
    };
    const summary = calculateLoanSummary(generateAmortizationSchedule(scenario), scenario);

    expect(summary.cet).toMatchObject({ status: 'available', root: 'negative' });
    if (summary.cet.status === 'available') {
      expect(summary.cet.annualRate).toBeLessThan(0);
    }
  });

  it('keeps a partial FGTS installment subsidy positive while lowering borrower CET', () => {
    const baseline = calculateLoanSummary(
      generateAmortizationSchedule(baseScenario),
      baseScenario,
    ).cet;
    const subsidizedScenario: Scenario = {
      ...baseScenario,
      fgtsEvents: [
        {
          id: 'fgts-partial-cet',
          date: new Date(2026, 1, 5),
          amount: 100,
          usage: 'installment',
        },
      ],
    };
    const subsidized = calculateLoanSummary(
      generateAmortizationSchedule(subsidizedScenario),
      subsidizedScenario,
    ).cet;

    expect(baseline).toMatchObject({ status: 'available', root: 'positive' });
    expect(subsidized).toMatchObject({ status: 'available', root: 'positive' });
    if (baseline.status === 'available' && subsidized.status === 'available') {
      expect(subsidized.annualRate).toBeLessThan(baseline.annualRate);
    }
  });

  it('returns unavailable when an extreme-cost root is outside the 100% bracket', () => {
    const scenario = {
      ...baseScenario,
      includeOpeningFee: true,
      openingFee: 9900,
    };
    const summary = calculateLoanSummary(generateAmortizationSchedule(scenario), scenario);

    expect(summary.cet).toEqual({ status: 'unavailable', reason: 'no_sign_change' });
  });

  it('distinguishes numerical non-convergence from a missing bracket sign change', () => {
    expect(
      solveCet({
        netDisbursement: 1000,
        cashFlows: [{ amount: Number.POSITIVE_INFINITY, yearFraction: 1 }],
      }),
    ).toEqual({ status: 'unavailable', reason: 'non_convergence' });
  });

  it('formats zero, negative, and unavailable CET results', () => {
    expect(formatCetResult({ status: 'available', root: 'zero', annualRate: 0 })).toBe('0,00%');
    expect(formatCetResult({ status: 'available', root: 'negative', annualRate: -3.25 })).toBe(
      '-3,25%',
    );
    expect(formatCetResult({ status: 'unavailable', reason: 'non_convergence' })).toBe(
      CET_UNAVAILABLE_LABEL,
    );
  });

  it('documents the structured CET for the Android export-readback fixture', () => {
    const firstDueDate = new Date(2026, 1, 5);
    const scenario: Scenario = {
      ...baseScenario,
      name: 'Teste Exportacao',
      principal: 300000,
      rate: 1.2,
      term: 360,
      prepayments: [
        {
          id: 'dev-prepayment',
          amount: 1000,
          date: firstDueDate,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
      fgtsEvents: [
        {
          id: 'dev-fgts',
          amount: 800,
          date: firstDueDate,
          usage: 'amortization',
          strategy: 'reduce_term',
        },
      ],
    };
    const schedule = generateAmortizationSchedule(scenario);
    const summary = calculateLoanSummary(schedule, scenario);

    expect(schedule).toHaveLength(332);
    // P0.2 moved installment 1 from Jan 5 to Feb 5: CET changed from 15.58% to 15.36% a.a.
    expect(summary.cet).toEqual({ status: 'available', root: 'positive', annualRate: 15.36 });
  });
});

describe('validateScenario', () => {
  it('flags invalid inputs', () => {
    const result = validateScenario({
      ...baseScenario,
      principal: 0,
      rate: -1,
      term: 0,
      dueDay: 0,
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('allows zero-rate (interest-free) loans', () => {
    const result = validateScenario({
      ...baseScenario,
      rate: 0,
    });

    // Should not have rate-related errors
    const rateErrors = result.errors.filter((e) => e.toLowerCase().includes('taxa'));
    expect(rateErrors.length).toBe(0);
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

  it('requires a correction rate when an index is selected', () => {
    const result = validateScenario({
      ...baseScenario,
      indexType: 'TR',
      indexRate: undefined,
    });

    expect(result.errors).toContain('Informe a taxa mensal do índice de correção.');
  });

  it('allows negative correction rates above -100%', () => {
    const result = validateScenario({
      ...baseScenario,
      indexType: 'IPCA',
      indexRate: -0.25,
    });

    expect(result.errors).toHaveLength(0);
  });

  it('blocks correction rates at or below -100%', () => {
    const result = validateScenario({
      ...baseScenario,
      indexType: 'IPCA',
      indexRate: -100,
    });

    expect(result.errors).toContain('Taxa de correção deve ser maior que -100% a.m.');
  });

  it('warns when correction rate looks unusually high', () => {
    const result = validateScenario({
      ...baseScenario,
      indexType: 'IPCA',
      indexRate: 5.5,
    });

    expect(result.warnings).toContain(
      'Taxa mensal de correção parece alta. Verifique o valor informado.',
    );
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

describe('date handling edge cases', () => {
  it.each([
    {
      relation: 'before the due day',
      startDate: new Date(2026, 0, 1),
      dueDay: 5,
      expectedFirstDueDate: new Date(2026, 1, 5),
    },
    {
      relation: 'on the due day',
      startDate: new Date(2026, 0, 5),
      dueDay: 5,
      expectedFirstDueDate: new Date(2026, 1, 5),
    },
    {
      relation: 'after the due day',
      startDate: new Date(2026, 0, 20),
      dueDay: 5,
      expectedFirstDueDate: new Date(2026, 2, 5),
    },
  ])(
    'uses the first due-day occurrence at least 30 days after a start date $relation',
    ({ startDate, dueDay, expectedFirstDueDate }) => {
      const schedule = generateAmortizationSchedule({
        ...baseScenario,
        startDate,
        dueDay,
        term: 3,
      });

      expect(schedule[1].date).toEqual(expectedFirstDueDate);
      expect(schedule.every((row) => row.date.getTime() >= startDate.getTime())).toBe(true);
    },
  );

  it('keeps every CET cash-flow interval non-negative for both amortization systems', () => {
    const startDate = new Date(2026, 0, 20);

    for (const system of ['PRICE', 'SAC'] as const) {
      const scenario = { ...baseScenario, system, startDate, dueDay: 5 };
      const schedule = generateAmortizationSchedule(scenario);
      const dayIntervals = schedule
        .filter((row) => row.installmentNumber > 0)
        .map((row) => (row.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(dayIntervals.every((days) => days >= 0)).toBe(true);
      const cet = calculateLoanSummary(schedule, scenario).cet;
      expect(cet.status).toBe('available');
      if (cet.status === 'available') {
        expect(cet.annualRate).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('documents the CET fixture change caused by the corrected first due date', () => {
    const scenario = {
      ...baseScenario,
      startDate: new Date(2026, 0, 20),
      dueDay: 5,
    };
    const schedule = generateAmortizationSchedule(scenario);

    // Before the date fix this fixture produced 16.98% a.a. from a negative first interval.
    const cet = calculateLoanSummary(schedule, scenario).cet;
    expect(cet.status).toBe('available');
    if (cet.status === 'available') {
      expect(cet.annualRate).toBeCloseTo(11.75, 2);
    }
  });

  it('keeps the documented full-month interest convention for a 44-day first period', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      startDate: new Date(2026, 0, 20),
      dueDay: 5,
    });

    expect(schedule[1].date).toEqual(new Date(2026, 2, 5));
    expect(schedule[1].interest).toBeCloseTo(100, 2);
  });

  it('handles end-of-month dates without overflow after applying the 30-day minimum', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      startDate: new Date(2026, 0, 31), // Jan 31, 2026
      dueDay: 31, // Use day 31 to test clamping
      term: 3,
    });

    expect(schedule[1].date.getMonth()).toBe(2); // March
    expect(schedule[1].date.getDate()).toBe(31); // Mar 31
    expect(schedule[2].date.getMonth()).toBe(3); // April
    expect(schedule[2].date.getDate()).toBe(30); // Clamped to Apr 30
    expect(schedule[3].date.getMonth()).toBe(4); // May
    expect(schedule[3].date.getDate()).toBe(31); // May 31
  });

  it('does not accept leap day when it is only 29 days after the start date', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      startDate: new Date(2024, 0, 31), // Jan 31, 2024 (leap year)
      dueDay: 31,
      term: 2,
    });

    expect(schedule[1].date.getMonth()).toBe(2); // March (Feb 29 is only 29 days later)
    expect(schedule[1].date.getDate()).toBe(31);
    expect(schedule[2].date.getMonth()).toBe(3); // April
    expect(schedule[2].date.getDate()).toBe(30);
  });

  it('accepts a clamped April 30 due date exactly 30 days after March 31', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      startDate: new Date(2026, 2, 31), // Mar 31, 2026
      dueDay: 31,
      term: 2,
    });

    expect(schedule[1].date.getMonth()).toBe(3); // April 30 is exactly 30 days later
    expect(schedule[1].date.getDate()).toBe(30);
    expect(schedule[2].date.getMonth()).toBe(4); // May
    expect(schedule[2].date.getDate()).toBe(31);
  });
});
