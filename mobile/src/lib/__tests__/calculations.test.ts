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

const toCents = (value: number) => Math.round(value * 100);

function expectReconciled(schedule: ReturnType<typeof generateAmortizationSchedule>) {
  const openingBalance = toCents(schedule[0].balance);
  const endingBalance = toCents(schedule.at(-1)?.balance ?? 0);
  const indexCorrections = schedule.reduce(
    (total, row) => total + toCents(row.indexCorrection ?? 0),
    0,
  );
  const amortization = schedule.reduce((total, row) => total + toCents(row.amortization), 0);

  expect(openingBalance + indexCorrections - endingBalance).toBe(amortization);
  expect(endingBalance).toBe(0);
}

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

describe('cent-ledger reconciliation', () => {
  it.each(['PRICE', 'SAC'] as const)(
    'reconciles displayed %s rows over a principal/rate/term grid',
    (system) => {
      for (const principal of [1, 10_000, 123_456.78]) {
        for (const rate of [0, 0.01, 1, 10]) {
          for (const term of [1, 12, 120, 360]) {
            const schedule = generateAmortizationSchedule({
              ...baseScenario,
              system,
              principal,
              rate,
              term,
            });

            expectReconciled(schedule);
          }
        }
      }
    },
  );

  it.each(['PRICE', 'SAC'] as const)(
    'includes displayed monetary corrections in the %s ledger identity',
    (system) => {
      const schedule = generateAmortizationSchedule({
        ...baseScenario,
        system,
        principal: 123_456.78,
        rate: 1.37,
        term: 120,
        indexType: 'IPCA',
        indexRate: 0.41,
      });

      expectReconciled(schedule);
    },
  );

  it.each(['PRICE', 'SAC'] as const)(
    'caps combined prepayment and FGTS amortization at the remaining %s balance',
    (system) => {
      const schedule = generateAmortizationSchedule({
        ...baseScenario,
        system,
        prepayments: [
          {
            id: 'large-prepayment',
            date: new Date(2026, 1, 5),
            amount: 7_000,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
        ],
        fgtsEvents: [
          {
            id: 'large-fgts-amortization',
            date: new Date(2026, 1, 5),
            amount: 7_000,
            usage: 'amortization',
            strategy: 'reduce_term',
          },
        ],
      });

      const payoffRow = schedule.at(-1);
      expect(payoffRow?.amortization).toBeCloseTo(10_000, 2);
      expect(payoffRow?.fgtsAmortization).toBeLessThan(7_000);
      expectReconciled(schedule);
    },
  );

  it('keeps the 10% monthly PRICE / 360-month extreme domain finite and fully paid', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      system: 'PRICE',
      principal: 100_000,
      rate: 10,
      term: 360,
    });

    expect(schedule).toHaveLength(361);
    expect(
      schedule.every((row) =>
        [row.payment, row.interest, row.amortization, row.balance].every(Number.isFinite),
      ),
    ).toBe(true);
    expectReconciled(schedule);
  });
});

describe('same-month prepayment strategy semantics', () => {
  it.each(['PRICE', 'SAC'] as const)(
    'caps two same-month fixed prepayments against the cumulative %s headroom',
    (system) => {
      const schedule = generateAmortizationSchedule({
        ...baseScenario,
        system,
        principal: 1_000,
        rate: 0,
        prepayments: [
          {
            id: 'first-600',
            date: new Date(2026, 1, 5),
            amount: 600,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
          {
            id: 'second-600',
            date: new Date(2026, 1, 5),
            amount: 600,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
        ],
      });

      expect(schedule).toHaveLength(2);
      expect(schedule[1].amortization).toBe(1_000);
      expect(schedule[1].prepaymentAmount).toBe(916.67);
      expect(schedule[1].balance).toBe(0);
    },
  );

  it.each(['PRICE', 'SAC'] as const)(
    'applies %s reduce_payment before reduce_term regardless of input order',
    (system) => {
      const reducePaymentOnly = generateAmortizationSchedule({
        ...baseScenario,
        system,
        prepayments: [
          {
            id: 'reduce-payment',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_payment',
          },
        ],
      });
      const mixed = generateAmortizationSchedule({
        ...baseScenario,
        system,
        prepayments: [
          {
            id: 'reduce-term-first-in-input',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
          {
            id: 'reduce-payment-second-in-input',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_payment',
          },
        ],
      });

      if (system === 'PRICE') {
        expect(mixed[2].payment).toBe(reducePaymentOnly[2].payment);
      } else {
        expect(mixed[2].amortization).toBe(reducePaymentOnly[2].amortization);
        expect(mixed[2].interest).toBeLessThan(reducePaymentOnly[2].interest);
      }
      expect(mixed.length).toBeLessThan(reducePaymentOnly.length);
      expectReconciled(mixed);
    },
  );

  it.each(['PRICE', 'SAC'] as const)(
    'does not let same-month FGTS reduce_term hijack %s reduce_payment semantics',
    (system) => {
      const reducePaymentOnly = generateAmortizationSchedule({
        ...baseScenario,
        system,
        prepayments: [
          {
            id: 'reduce-payment',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_payment',
          },
        ],
      });
      const mixedWithFgts = generateAmortizationSchedule({
        ...baseScenario,
        system,
        prepayments: [
          {
            id: 'reduce-payment',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_payment',
          },
        ],
        fgtsEvents: [
          {
            id: 'fgts-reduce-term',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            usage: 'amortization',
            strategy: 'reduce_term',
          },
        ],
      });

      if (system === 'PRICE') {
        expect(mixedWithFgts[2].payment).toBe(reducePaymentOnly[2].payment);
      } else {
        expect(mixedWithFgts[2].amortization).toBe(reducePaymentOnly[2].amortization);
        expect(mixedWithFgts[2].interest).toBeLessThan(reducePaymentOnly[2].interest);
      }
      expect(mixedWithFgts.length).toBeLessThan(reducePaymentOnly.length);
      expectReconciled(mixedWithFgts);
    },
  );

  it.each(['PRICE', 'SAC'] as const)(
    'keeps the existing indexed %s contract of re-amortizing after each correction',
    (system) => {
      const mixedIndexed = generateAmortizationSchedule({
        ...baseScenario,
        system,
        indexType: 'IPCA',
        indexRate: 0.5,
        prepayments: [
          {
            id: 'indexed-reduce-payment',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_payment',
          },
          {
            id: 'indexed-reduce-term',
            date: new Date(2026, 1, 5),
            amount: 1_000,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
        ],
      });

      // Indexed schedules intentionally recalculate the next row from the corrected balance
      // and remaining contractual term. P0.5 governs deterministic allocation within the row.
      expect(mixedIndexed[1].prepaymentAmount).toBe(2_000);
      expect(mixedIndexed[1].balance).toBeLessThan(8_000);
      expectReconciled(mixedIndexed);
    },
  );

  it('warns that mixed same-installment strategies use reduce_payment before reduce_term', () => {
    const result = validateScenario({
      ...baseScenario,
      prepayments: [
        {
          id: 'mixed-warning-payment',
          date: new Date(2026, 1, 5),
          amount: 500,
          type: 'fixed_amount',
          strategy: 'reduce_payment',
        },
      ],
      fgtsEvents: [
        {
          id: 'mixed-warning-term',
          date: new Date(2026, 1, 3),
          amount: 500,
          usage: 'amortization',
          strategy: 'reduce_term',
        },
      ],
    });

    expect(result.warnings).toContain(
      'Amortizações na mesma parcela com estratégias diferentes serão aplicadas nesta ordem: reduzir parcela e depois reduzir prazo.',
    );
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

describe('event application dates', () => {
  it.each([
    { relation: 'before', eventDate: new Date(2026, 1, 1), expectedInstallment: 1 },
    { relation: 'on', eventDate: new Date(2026, 1, 5), expectedInstallment: 1 },
    { relation: 'after', eventDate: new Date(2026, 1, 6), expectedInstallment: 2 },
  ])(
    'applies prepayment and FGTS amortization on the first due date $relation the event',
    ({ eventDate, expectedInstallment }) => {
      const schedule = generateAmortizationSchedule({
        ...baseScenario,
        prepayments: [
          {
            id: `prepayment-${expectedInstallment}`,
            date: eventDate,
            amount: 100,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
        ],
        fgtsEvents: [
          {
            id: `fgts-${expectedInstallment}`,
            date: eventDate,
            amount: 100,
            usage: 'amortization',
            strategy: 'reduce_term',
          },
        ],
      });

      const applicationRow = schedule.find((row) => row.installmentNumber === expectedInstallment);
      expect(applicationRow?.prepaymentAmount).toBe(200);
      expect(applicationRow?.fgtsAmortization).toBe(100);
      expect(
        schedule
          .filter((row) => row.installmentNumber !== expectedInstallment)
          .every((row) => row.prepaymentAmount === undefined),
      ).toBe(true);
    },
  );

  it('applies an FGTS installment subsidy on the first due date at or after its date', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      fgtsEvents: [
        {
          id: 'fgts-installment-after-due-date',
          date: new Date(2026, 1, 28),
          amount: 100,
          usage: 'installment',
        },
      ],
    });

    expect(schedule[1].fgtsSubsidy).toBeUndefined();
    expect(schedule[2].fgtsSubsidy).toBe(100);
  });

  it('treats different times on the same calendar due date as the same day', () => {
    const schedule = generateAmortizationSchedule({
      ...baseScenario,
      startDate: new Date(2026, 0, 1, 9),
      prepayments: [
        {
          id: 'same-day-afternoon',
          date: new Date(2026, 1, 5, 14),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    });

    expect(schedule[1].prepaymentAmount).toBe(100);
    expect(schedule[2].prepaymentAmount).toBeUndefined();
  });

  it('rolls a pre-window event into the first eligible installment by contract', () => {
    const scenario: Scenario = {
      ...baseScenario,
      prepayments: [
        {
          id: 'before-schedule-window',
          date: new Date(2020, 0, 1),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    };
    const schedule = generateAmortizationSchedule(scenario);
    const validation = validateScenario(scenario, schedule);

    expect(schedule[1].prepaymentAmount).toBe(100);
    expect(validation.warnings.some((warning) => warning.includes('fora do período'))).toBe(false);
  });

  it('caps bunched FGTS installment subsidies at the eligible payment', () => {
    const scenario: Scenario = {
      ...baseScenario,
      fgtsEvents: [
        {
          id: 'fgts-bunched-one',
          date: new Date(2026, 1, 10),
          amount: 600,
          usage: 'installment',
        },
        {
          id: 'fgts-bunched-two',
          date: new Date(2026, 2, 1),
          amount: 600,
          usage: 'installment',
        },
      ],
    };
    const schedule = generateAmortizationSchedule(scenario);
    const summary = calculateLoanSummary(schedule, scenario);

    expect(schedule[2].fgtsSubsidy).toBe(schedule[2].payment);
    expect(schedule[3].fgtsSubsidy).toBeUndefined();
    expect(summary.totalFgtsUsed).toBe(schedule[2].payment);
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

  it.each([
    ['principal', { principal: Number.NaN }],
    ['rate', { rate: Number.POSITIVE_INFINITY }],
    ['term', { term: Number.NaN }],
    ['dueDay', { dueDay: Number.NEGATIVE_INFINITY }],
    ['propertyValue', { propertyValue: Number.NaN }],
    ['downPayment', { downPayment: Number.POSITIVE_INFINITY }],
    ['iofRate', { iofRate: Number.NaN }],
    ['insuranceRate', { insuranceRate: Number.POSITIVE_INFINITY }],
    ['adminFeeRate', { adminFeeRate: Number.NaN }],
    ['openingFee', { openingFee: Number.POSITIVE_INFINITY }],
    ['itbiRate', { itbiRate: Number.NaN }],
    ['registryFee', { registryFee: Number.POSITIVE_INFINITY }],
    ['indexRate', { indexRate: Number.NaN }],
  ] as const)('rejects non-finite scenario field %s', (_field, patch) => {
    const result = validateScenario({ ...baseScenario, ...patch });

    expect(result.errors).toContain('Todos os valores numéricos devem ser finitos.');
  });

  it.each([
    {
      source: 'prepayment',
      scenario: {
        ...baseScenario,
        prepayments: [
          {
            id: 'non-finite-prepayment',
            date: new Date(2026, 1, 5),
            amount: Number.NaN,
            type: 'fixed_amount' as const,
            strategy: 'reduce_term' as const,
          },
        ],
      },
    },
    {
      source: 'FGTS',
      scenario: {
        ...baseScenario,
        fgtsEvents: [
          {
            id: 'non-finite-fgts',
            date: new Date(2026, 1, 5),
            amount: Number.POSITIVE_INFINITY,
            usage: 'amortization' as const,
          },
        ],
      },
    },
  ])('rejects non-finite $source event amounts', ({ scenario }) => {
    expect(validateScenario(scenario).errors).toContain(
      'Todos os valores numéricos devem ser finitos.',
    );
  });

  it.each<{ source: string; scenario: Scenario }>([
    { source: 'start date', scenario: { ...baseScenario, startDate: new Date('invalid') } },
    {
      source: 'prepayment date',
      scenario: {
        ...baseScenario,
        prepayments: [
          {
            id: 'invalid-date-prepayment',
            date: new Date('invalid'),
            amount: 100,
            type: 'fixed_amount' as const,
            strategy: 'reduce_term' as const,
          },
        ],
      },
    },
    {
      source: 'FGTS date',
      scenario: {
        ...baseScenario,
        fgtsEvents: [
          {
            id: 'invalid-date-fgts',
            date: new Date('invalid'),
            amount: 100,
            usage: 'amortization' as const,
          },
        ],
      },
    },
  ])('rejects an invalid $source', ({ scenario }) => {
    expect(validateScenario(scenario).errors).toContain('Todas as datas devem ser válidas.');
  });

  it.each([
    {
      source: 'prepayment',
      scenario: {
        ...baseScenario,
        prepayments: [
          {
            id: 'negative-prepayment',
            date: new Date(2026, 1, 5),
            amount: -1,
            type: 'fixed_amount' as const,
            strategy: 'reduce_term' as const,
          },
        ],
      },
    },
    {
      source: 'FGTS',
      scenario: {
        ...baseScenario,
        fgtsEvents: [
          {
            id: 'negative-fgts',
            date: new Date(2026, 1, 5),
            amount: -1,
            usage: 'amortization' as const,
          },
        ],
      },
    },
  ])('rejects negative $source amounts', ({ scenario }) => {
    expect(validateScenario(scenario).errors).toContain(
      'Valores de amortização e FGTS não podem ser negativos.',
    );
  });

  it.each([0, -1, 100.01])('rejects percentage prepayment amount %s outside (0, 100]', (amount) => {
    const result = validateScenario({
      ...baseScenario,
      prepayments: [
        {
          id: `invalid-percentage-${amount}`,
          date: new Date(2026, 1, 5),
          amount,
          type: 'percentage',
          strategy: 'reduce_term',
        },
      ],
    });

    expect(result.errors).toContain('Percentual de amortização deve ser maior que 0% e até 100%.');
  });

  it.each([0, 5.5, 32])('rejects non-integer or out-of-range due day %s', (dueDay) => {
    const result = validateScenario({ ...baseScenario, dueDay });

    expect(result.errors).toContain('Dia de vencimento deve ser um inteiro entre 1 e 31.');
  });

  it.each([10_000, 12_000])(
    'rejects FGTS down payment %s greater than or equal to financed principal',
    (amount) => {
      const result = validateScenario({
        ...baseScenario,
        fgtsEvents: [
          {
            id: `invalid-fgts-down-${amount}`,
            date: new Date(2026, 0, 1),
            amount,
            usage: 'down_payment',
          },
        ],
      });

      expect(result.errors).toContain('Entrada com FGTS deve ser menor que o valor financiado.');
    },
  );

  it('warns when an amortization is after the final due date and ignores it', () => {
    const scenario: Scenario = {
      ...baseScenario,
      term: 1,
      prepayments: [
        {
          id: 'outside-term',
          date: new Date(2026, 2, 1),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    };
    const result = validateScenario(scenario);
    const schedule = generateAmortizationSchedule(scenario);

    expect(result.warnings).toContain(
      'Amortização em 03/2026 está fora do período do financiamento e foi ignorada.',
    );
    expect(schedule.every((row) => row.prepaymentAmount === undefined)).toBe(true);
  });

  it('does not warn for an event later in the day on the final due date', () => {
    const scenario: Scenario = {
      ...baseScenario,
      startDate: new Date(2026, 0, 1, 9),
      term: 1,
      prepayments: [
        {
          id: 'final-due-afternoon',
          date: new Date(2026, 1, 5, 18),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    };
    const result = validateScenario(scenario);
    const schedule = generateAmortizationSchedule(scenario);

    expect(result.warnings.some((warning) => warning.includes('fora do período'))).toBe(false);
    expect(schedule[1].date).toEqual(new Date(2026, 1, 5, 9));
  });

  it('warns when early payoff leaves a later nominally in-term event unapplied', () => {
    const scenario: Scenario = {
      ...baseScenario,
      prepayments: [
        {
          id: 'payoff-first-installment',
          date: new Date(2026, 1, 5),
          amount: 10_000,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
        {
          id: 'after-early-payoff',
          date: new Date(2026, 5, 1),
          amount: 500,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    };
    const schedule = generateAmortizationSchedule(scenario);
    const result = validateScenario(scenario, schedule);

    expect(schedule).toHaveLength(2);
    expect(result.warnings).toContain(
      'Amortização em 06/2026 está fora do período do financiamento e foi ignorada.',
    );
  });

  it('warns only when different strategies map to the same installment', () => {
    const sameInstallment: Scenario = {
      ...baseScenario,
      prepayments: [
        {
          id: 'january-reduce-payment',
          date: new Date(2026, 0, 10),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_payment',
        },
        {
          id: 'february-reduce-term',
          date: new Date(2026, 1, 3),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    };
    const differentInstallments: Scenario = {
      ...baseScenario,
      prepayments: [
        {
          id: 'february-reduce-payment',
          date: new Date(2026, 1, 3),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_payment',
        },
        {
          id: 'february-reduce-term-after-due',
          date: new Date(2026, 1, 20),
          amount: 100,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    };

    expect(validateScenario(sameInstallment).warnings).toContain(
      'Amortizações na mesma parcela com estratégias diferentes serão aplicadas nesta ordem: reduzir parcela e depois reduzir prazo.',
    );
    expect(validateScenario(differentInstallments).warnings).not.toContain(
      'Amortizações na mesma parcela com estratégias diferentes serão aplicadas nesta ordem: reduzir parcela e depois reduzir prazo.',
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
