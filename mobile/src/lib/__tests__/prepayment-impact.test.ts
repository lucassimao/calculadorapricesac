import { describe, expect, it } from 'vitest';
import type { Scenario } from '@loan-engine/loan';
import { calculatePrepaymentImpact } from '../prepayment-impact';

const existingContract: Scenario = {
  id: 'existing',
  name: 'Contrato atual',
  system: 'SAC',
  loanMode: 'standard',
  principal: 180_000,
  rate: 0.8,
  rateType: 'monthly',
  term: 120,
  termUnit: 'months',
  entryMode: 'existing_contract',
  startDate: new Date(2026, 7, 10),
  nextDueDate: new Date(2026, 8, 10),
  dueDay: 10,
  prepayments: [],
  fgtsEvents: [],
};

describe('prepayment impact', () => {
  it('reports interest saved and an earlier payoff for an existing contract', () => {
    const impact = calculatePrepaymentImpact({
      ...existingContract,
      prepayments: [
        {
          id: 'extra',
          date: new Date(2026, 8, 10),
          amount: 20_000,
          type: 'fixed_amount',
          strategy: 'reduce_term',
        },
      ],
    });

    expect(impact).not.toBeNull();
    expect(impact!.interestSaved).toBeGreaterThan(0);
    expect(impact!.newPayoffDate.getTime()).toBeLessThan(impact!.originalPayoffDate.getTime());
    expect(impact!.installmentsSaved).toBeGreaterThan(0);
  });

  it('returns null when there is no balance-reducing event', () => {
    expect(calculatePrepaymentImpact(existingContract)).toBeNull();
  });

  it('reports the lower following installment when reduce-payment keeps the payoff date', () => {
    const impact = calculatePrepaymentImpact({
      ...existingContract,
      prepayments: [
        {
          id: 'reduce-payment',
          date: new Date(2026, 8, 10),
          amount: 20_000,
          type: 'fixed_amount',
          strategy: 'reduce_payment',
        },
      ],
    });

    expect(impact).toMatchObject({ installmentsSaved: 0 });
    expect(impact!.paymentBefore).toBeGreaterThan(impact!.paymentAfter!);
    expect(impact!.paymentAfter).toBeGreaterThan(0);
  });

  it('suppresses impact when an event on the final installment changes nothing', () => {
    expect(
      calculatePrepaymentImpact({
        ...existingContract,
        term: 2,
        prepayments: [
          {
            id: 'too-late',
            date: new Date(2026, 9, 10),
            amount: 5_000,
            type: 'fixed_amount',
            strategy: 'reduce_term',
          },
        ],
      }),
    ).toBeNull();
  });

  it('excludes monthly recurring extras from the displayed following installment', () => {
    const prepayments = Array.from({ length: 2 }, (_, index) => ({
      id: `monthly-${index}`,
      date: new Date(2026, 8 + index, 10),
      amount: 1_000,
      type: 'fixed_amount' as const,
      strategy: 'reduce_payment' as const,
    }));
    const impact = calculatePrepaymentImpact({ ...existingContract, prepayments });

    expect(impact).toMatchObject({ installmentsSaved: 0 });
    expect(impact!.paymentAfter).toBeLessThan(impact!.paymentBefore!);
    expect(impact!.paymentBefore! - impact!.paymentAfter!).toBeLessThan(1_000);
  });
});
