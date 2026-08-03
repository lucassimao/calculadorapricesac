import { describe, expect, it } from 'vitest';
import { generateAmortizationSchedule } from '@loan-engine/calculations';
import type { Scenario } from '@loan-engine/loan';
import {
  buildRecurringFgtsEvents,
  buildRecurringPrepaymentEvents,
  canAppendFgtsInstallmentEvents,
  expandRecurringDates,
  getFgtsRecurrencePolicy,
  trimEventsToSchedule,
  trimFgtsEventsToSchedule,
  type Recurrence,
} from '../recurring-events';

const localDates = (dates: Date[]) =>
  dates.map(
    (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`,
  );

describe('recurring event expansion', () => {
  it.each<[Recurrence, string[]]>([
    ['monthly', ['2026-01-31', '2026-02-28', '2026-03-31']],
    ['yearly', ['2026-01-31']],
    ['biennial', ['2026-01-31']],
  ])('expands %s dates through the inclusive contract horizon', (recurrence, expected) => {
    expect(
      localDates(
        expandRecurringDates({
          startDate: new Date(2026, 0, 31),
          loanStartDate: new Date(2026, 0, 1),
          termMonths: 3,
          dueDay: 31,
          recurrence,
        }),
      ),
    ).toEqual(expected);
  });

  it('creates the complete biennial FGTS amortization series', () => {
    expect(
      localDates(
        expandRecurringDates({
          startDate: new Date(2026, 0, 5),
          loanStartDate: new Date(2026, 0, 5),
          termMonths: 72,
          dueDay: 5,
          recurrence: 'biennial',
        }),
      ),
    ).toEqual(['2026-02-05', '2028-02-05', '2030-02-05']);
  });

  it('builds the accepted R$ 10,000 biennial FGTS reduce-term series', () => {
    const events = buildRecurringFgtsEvents({
      seriesId: 'fgts-10k',
      startDate: new Date(2026, 0, 5),
      loanStartDate: new Date(2026, 0, 5),
      termMonths: 360,
      dueDay: 5,
      recurrence: 'biennial',
      amount: 10_000,
      usage: 'amortization',
      strategy: 'reduce_term',
    });

    expect(localDates(events.slice(0, 3).map((event) => event.date))).toEqual([
      '2026-02-05',
      '2028-02-05',
      '2030-02-05',
    ]);
    expect(localDates([events.at(-1)!.date])).toEqual(['2054-02-05']);
    expect(events).toHaveLength(15);
    expect(events.every((event) => event.amount === 10_000)).toBe(true);
    expect(events.every((event) => event.strategy === 'reduce_term')).toBe(true);
    expect(events.every((event) => event.recurrence === 'biennial')).toBe(true);
  });

  it('trims a reduce-term series at the payoff date produced by the engine', () => {
    const fgtsEvents = buildRecurringFgtsEvents({
      seriesId: 'fgts-payoff',
      startDate: new Date(2026, 7, 2),
      loanStartDate: new Date(2026, 7, 2),
      termMonths: 360,
      dueDay: 5,
      recurrence: 'biennial',
      amount: 10_000,
      usage: 'amortization',
      strategy: 'reduce_term',
    });
    const scenario: Scenario = {
      id: 'fgts-payoff',
      name: 'FGTS bienal',
      system: 'SAC',
      principal: 320_000,
      rate: 11.5,
      rateType: 'annual',
      term: 360,
      termUnit: 'months',
      startDate: new Date(2026, 7, 2),
      dueDay: 5,
      fgtsEvents,
    };
    const tentativeSchedule = generateAmortizationSchedule(scenario);
    const trimmedEvents = trimEventsToSchedule(fgtsEvents, tentativeSchedule);

    expect(trimmedEvents.length).toBeLessThan(fgtsEvents.length);
    expect(trimmedEvents).toHaveLength(11);
    expect(trimmedEvents.at(-1)!.date.getTime()).toBeLessThanOrEqual(
      tentativeSchedule.at(-1)!.date.getTime(),
    );
    expect(fgtsEvents[trimmedEvents.length].date.getTime()).toBeGreaterThan(
      tentativeSchedule.at(-1)!.date.getTime(),
    );
  });

  it('builds individually editable prepayment events with recurrence metadata', () => {
    const events = buildRecurringPrepaymentEvents({
      seriesId: 'prepayment-series',
      startDate: new Date(2026, 0, 5),
      loanStartDate: new Date(2026, 0, 5),
      termMonths: 24,
      dueDay: 5,
      recurrence: 'yearly',
      amount: 10_000,
      type: 'fixed_amount',
      strategy: 'reduce_term',
      description: '13º salário',
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      id: 'prepayment-series-1',
      amount: 10_000,
      type: 'fixed_amount',
      strategy: 'reduce_term',
      recurrence: 'yearly',
    });
  });

  it('builds at most twelve monthly FGTS installment events', () => {
    const events = buildRecurringFgtsEvents({
      seriesId: 'fgts-series',
      startDate: new Date(2026, 1, 5),
      loanStartDate: new Date(2026, 0, 5),
      termMonths: 360,
      dueDay: 5,
      recurrence: 'monthly',
      amount: 800,
      usage: 'installment',
    });

    expect(events).toHaveLength(12);
    expect(events[11]).toMatchObject({
      id: 'fgts-series-11',
      amount: 800,
      usage: 'installment',
      recurrence: 'monthly',
    });
  });

  it('applies the twelve FGTS installment events to twelve distinct installments', () => {
    const fgtsEvents = buildRecurringFgtsEvents({
      seriesId: 'fgts-installments',
      startDate: new Date(2026, 7, 2),
      loanStartDate: new Date(2026, 7, 2),
      termMonths: 24,
      dueDay: 5,
      recurrence: 'monthly',
      amount: 800,
      usage: 'installment',
    });
    const scenario: Scenario = {
      id: 'recurring-fgts',
      name: 'FGTS recorrente',
      system: 'PRICE',
      principal: 100_000,
      rate: 1,
      rateType: 'monthly',
      term: 24,
      termUnit: 'months',
      startDate: new Date(2026, 7, 2),
      dueDay: 5,
      fgtsEvents,
    };

    const subsidizedRows = generateAmortizationSchedule(scenario).filter(
      (row) => row.fgtsSubsidy !== undefined,
    );
    expect(subsidizedRows).toHaveLength(12);
    expect(subsidizedRows.every((row) => row.fgtsSubsidy === 800)).toBe(true);
    expect(localDates(subsidizedRows.map((row) => row.date))).toEqual(
      localDates(fgtsEvents.map((event) => event.date)),
    );
  });

  it('normalizes recurrence to the policy for each FGTS usage', () => {
    const installmentEvents = buildRecurringFgtsEvents({
      seriesId: 'installment-series',
      startDate: new Date(2026, 0, 5),
      loanStartDate: new Date(2026, 0, 5),
      termMonths: 360,
      dueDay: 5,
      recurrence: 'biennial',
      amount: 800,
      usage: 'installment',
    });
    const downPaymentEvents = buildRecurringFgtsEvents({
      seriesId: 'down-payment-series',
      startDate: new Date(2026, 0, 5),
      loanStartDate: new Date(2026, 0, 5),
      termMonths: 360,
      dueDay: 5,
      recurrence: 'monthly',
      amount: 50_000,
      usage: 'down_payment',
    });

    expect(installmentEvents).toHaveLength(12);
    expect(installmentEvents.every((event) => event.recurrence === 'monthly')).toBe(true);
    expect(downPaymentEvents).toHaveLength(1);
    expect(downPaymentEvents[0].recurrence).toBe('none');
  });

  it('aligns recurring events to installment dates so each installment gets one occurrence', () => {
    expect(
      localDates(
        expandRecurringDates({
          startDate: new Date(2026, 7, 2),
          loanStartDate: new Date(2026, 7, 2),
          termMonths: 4,
          dueDay: 5,
          recurrence: 'monthly',
        }),
      ),
    ).toEqual(['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05']);
  });

  it('mirrors the engine recovery of the configured due day after a short month', () => {
    const events = buildRecurringFgtsEvents({
      seriesId: 'month-end-fgts',
      startDate: new Date(2026, 0, 15),
      loanStartDate: new Date(2026, 0, 15),
      termMonths: 24,
      dueDay: 31,
      recurrence: 'monthly',
      amount: 800,
      usage: 'installment',
    });
    const scenario: Scenario = {
      id: 'month-end-fgts',
      name: 'FGTS no fim do mês',
      system: 'PRICE',
      principal: 100_000,
      rate: 1,
      rateType: 'monthly',
      term: 24,
      termUnit: 'months',
      startDate: new Date(2026, 0, 15),
      dueDay: 31,
      fgtsEvents: events,
    };
    const subsidizedRows = generateAmortizationSchedule(scenario).filter(
      (row) => row.fgtsSubsidy !== undefined,
    );

    expect(localDates(events.slice(0, 4).map((event) => event.date))).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
    expect(localDates(subsidizedRows.map((row) => row.date))).toEqual(
      localDates(events.map((event) => event.date)),
    );
  });

  it('accepts one-off events through the actual final installment date', () => {
    expect(
      localDates(
        expandRecurringDates({
          startDate: new Date(2027, 8, 1),
          loanStartDate: new Date(2026, 7, 20),
          termMonths: 12,
          dueDay: 5,
          recurrence: 'none',
        }),
      ),
    ).toEqual(['2027-09-01']);
  });

  it('limits the FGTS installment preset to twelve consecutive events', () => {
    expect(
      expandRecurringDates({
        startDate: new Date(2026, 1, 5),
        loanStartDate: new Date(2026, 0, 5),
        termMonths: 360,
        dueDay: 5,
        recurrence: 'monthly',
        maxOccurrences: 12,
      }),
    ).toHaveLength(12);
  });

  it('uses usage-specific FGTS defaults and never offers biennial for installments', () => {
    expect(getFgtsRecurrencePolicy('down_payment')).toEqual({
      defaultRecurrence: 'none',
      allowedRecurrences: ['none'],
    });
    expect(getFgtsRecurrencePolicy('amortization')).toEqual({
      defaultRecurrence: 'biennial',
      allowedRecurrences: ['none', 'biennial'],
    });
    expect(getFgtsRecurrencePolicy('installment')).toEqual({
      defaultRecurrence: 'monthly',
      allowedRecurrences: ['none', 'monthly'],
      maxOccurrences: 12,
    });
  });

  it('allows at most twelve FGTS installment events in one scenario', () => {
    const events = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      date: new Date(2026, index, 5),
      amount: 800,
      usage: 'installment' as const,
    }));

    expect(canAppendFgtsInstallmentEvents([], events)).toBe(true);
    expect(canAppendFgtsInstallmentEvents(events.slice(0, 11), events.slice(0, 1))).toBe(true);
    expect(canAppendFgtsInstallmentEvents(events, events.slice(0, 1))).toBe(false);
  });

  it('never trims a down payment because the engine applies it at contract start', () => {
    const finalScheduleRow = { date: new Date(2027, 0, 5) };
    const legacyDownPayment = {
      id: 'legacy-down-payment',
      date: new Date(2030, 0, 5),
      amount: 50_000,
      usage: 'down_payment' as const,
    };
    const lateAmortization = {
      id: 'late-amortization',
      date: new Date(2030, 0, 5),
      amount: 10_000,
      usage: 'amortization' as const,
      strategy: 'reduce_term' as const,
    };

    expect(
      trimFgtsEventsToSchedule([legacyDownPayment, lateAmortization], [finalScheduleRow]),
    ).toEqual([legacyDownPayment]);
  });
});
