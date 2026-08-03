import type { PrepaymentEvent, Scenario, ScheduleRow } from '@loan-engine/loan';
import { calculateLoanSummary, generateAmortizationSchedule } from '@loan-engine/calculations';
import {
  optimizePrepayments,
  type OptimizerPlanBuilder,
} from '@loan-engine/calculations/optimizer';
import { describe, expect, it } from 'vitest';
import { buildRecurringPrepaymentEvents } from '../recurring-events';

const baseScenario: Scenario = {
  id: 'optimizer-base',
  name: 'Contrato para otimizar',
  system: 'SAC',
  loanMode: 'standard',
  principal: 200_000,
  rate: 10,
  rateType: 'annual',
  term: 120,
  termUnit: 'months',
  startDate: new Date(2026, 0, 1),
  dueDay: 5,
  prepayments: [],
  fgtsEvents: [],
};

const buildPlan: OptimizerPlanBuilder = ({
  scenario,
  seriesId,
  startDate,
  amount,
  recurrence,
  strategy,
  maxOccurrences,
}) =>
  buildRecurringPrepaymentEvents({
    seriesId,
    startDate,
    loanStartDate: scenario.startDate,
    firstDueDate: scenario.nextDueDate,
    termMonths: scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term,
    dueDay: scenario.dueDay,
    recurrence,
    amount,
    type: 'fixed_amount',
    strategy,
    description: 'Plano do assistente',
    maxOccurrences,
  });

function runGeneratedPlan(scenario: Scenario, prepayments: PrepaymentEvent[]) {
  const plannedScenario = {
    ...scenario,
    prepayments: [...(scenario.prepayments ?? []), ...prepayments],
  };
  const schedule = generateAmortizationSchedule(plannedScenario);
  return {
    schedule,
    summary: calculateLoanSummary(schedule, plannedScenario),
  };
}

function calendarStamp(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function regularPayment(row: ScheduleRow) {
  return (row.netPayment ?? row.payment) - (row.prepaymentAmount ?? 0) + (row.extraCosts ?? 0);
}

describe('prepayment optimizer', () => {
  it('finds the minimum monthly reduce-term amount that pays off by the target date', () => {
    const baseSchedule = generateAmortizationSchedule(baseScenario);
    const targetDate = baseSchedule.find((row) => row.installmentNumber === 60)!.date;

    const result = optimizePrepayments({
      goal: 'payoff_by_date',
      scenario: baseScenario,
      targetDate,
      buildPlan,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.goal).toBe('payoff_by_date');
    expect(result.iterations).toBeLessThanOrEqual(40);
    expect(result.recurringAmount).toBeGreaterThan(0);
    expect(result.prepayments.length).toBeGreaterThan(1);
    expect(result.prepayments.every((event) => event.strategy === 'reduce_term')).toBe(true);

    const rerun = runGeneratedPlan(baseScenario, result.prepayments);
    expect(calendarStamp(rerun.schedule.at(-1)!.date)).toBeLessThanOrEqual(
      calendarStamp(targetDate),
    );
    expect(rerun.summary.totalInterest).toBe(result.optimizedSummary.totalInterest);

    const oneCentLessPlan = buildPlan({
      scenario: baseScenario,
      seriesId: 'one-cent-less',
      startDate: baseSchedule[1].date,
      amount: result.recurringAmount! - 0.01,
      recurrence: 'monthly',
      strategy: 'reduce_term',
      maxOccurrences: 60,
    });
    const oneCentLess = runGeneratedPlan(baseScenario, oneCentLessPlan);
    expect(calendarStamp(oneCentLess.schedule.at(-1)!.date)).toBeGreaterThan(
      calendarStamp(targetDate),
    );
  });

  it('returns a clear pt-BR unreachable result instead of a garbage plan', () => {
    const result = optimizePrepayments({
      goal: 'payoff_by_date',
      scenario: baseScenario,
      targetDate: new Date(2026, 0, 15),
      buildPlan,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'unreachable',
        goal: 'payoff_by_date',
        prepayments: [],
      }),
    );
    if (result.status !== 'unreachable') return;
    expect(result.message).toMatch(/não é possível|não pode/i);
    expect(result.iterations).toBeLessThanOrEqual(40);
  });

  it('puts one-off and recurring budget at the earliest dates with reduce-term', () => {
    const result = optimizePrepayments({
      goal: 'minimize_interest',
      scenario: baseScenario,
      oneOffAmount: 10_000,
      recurringAmount: 500,
      buildPlan,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.prepayments.length).toBeGreaterThan(2);
    expect(result.prepayments.every((event) => event.strategy === 'reduce_term')).toBe(true);
    expect(result.prepayments[0].date.getTime()).toBe(
      generateAmortizationSchedule(baseScenario)[1].date.getTime(),
    );
    expect(result.explanation).toMatch(/quanto antes/i);
    expect(result.explanation).toMatch(/reduzir prazo/i);
    expect(result.optimizedSummary.totalInterest).toBeLessThan(result.baseSummary.totalInterest);

    const rerun = runGeneratedPlan(baseScenario, result.prepayments);
    expect(rerun.summary.totalInterest).toBe(result.optimizedSummary.totalInterest);
    expect(result.interestSaved).toBeCloseTo(
      result.baseSummary.totalInterest - rerun.summary.totalInterest,
      2,
    );
  });

  it('names generated event series with the supplied unique plan prefix', () => {
    const result = optimizePrepayments({
      goal: 'minimize_interest',
      scenario: baseScenario,
      oneOffAmount: 10_000,
      recurringAmount: 500,
      seriesIdPrefix: 'optimizer-run-42',
      buildPlan,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.prepayments.every((event) => event.id.startsWith('optimizer-run-42-'))).toBe(
      true,
    );
  });

  it('finds a reduce-payment prepayment that keeps later installments under the cap', () => {
    const baseRows = generateAmortizationSchedule(baseScenario).filter(
      (row) => row.installmentNumber > 0,
    );
    const targetPayment = regularPayment(baseRows[1]) - 300;

    const result = optimizePrepayments({
      goal: 'payment_cap',
      scenario: baseScenario,
      targetPayment,
      buildPlan,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.iterations).toBeLessThanOrEqual(40);
    expect(result.oneOffAmount).toBeGreaterThan(0);
    expect(result.prepayments).toHaveLength(1);
    expect(result.prepayments[0].strategy).toBe('reduce_payment');
    expect(result.interestTradeoff).toBeGreaterThanOrEqual(0);

    const rerun = runGeneratedPlan(baseScenario, result.prepayments);
    const laterPayments = rerun.schedule
      .filter((row) => row.installmentNumber > 1)
      .map(regularPayment);
    expect(Math.max(...laterPayments)).toBeLessThanOrEqual(targetPayment + 0.01);
    expect(rerun.summary.totalInterest).toBe(result.optimizedSummary.totalInterest);
  });

  it('reports an unreachable payment cap below unavoidable monthly costs', () => {
    const scenarioWithFee: Scenario = {
      ...baseScenario,
      includeAdminFee: true,
      adminFee: 100,
    };
    const result = optimizePrepayments({
      goal: 'payment_cap',
      scenario: scenarioWithFee,
      targetPayment: 50,
      buildPlan,
    });

    expect(result.status).toBe('unreachable');
    if (result.status !== 'unreachable') return;
    expect(result.prepayments).toEqual([]);
    expect(result.message).toMatch(/tarifas|teto/i);
  });

  it('reports an unreachable interest goal when no budget is provided', () => {
    const result = optimizePrepayments({
      goal: 'minimize_interest',
      scenario: baseScenario,
      buildPlan,
    });

    expect(result.status).toBe('unreachable');
    if (result.status !== 'unreachable') return;
    expect(result.message).toMatch(/valor único|mensal/i);
    expect(result.prepayments).toEqual([]);
  });

  it.each([
    { system: 'SAC' as const, principal: 80_000, term: 48, rate: 7.5 },
    { system: 'PRICE' as const, principal: 350_000, term: 240, rate: 12.25 },
    { system: 'SAC' as const, principal: 900_000, term: 600, rate: 15 },
  ])('reproduces payoff and interest across $system/$term-month scenarios', (variant) => {
    const scenario: Scenario = {
      ...baseScenario,
      ...variant,
      id: `property-${variant.system}-${variant.term}`,
    };
    const baseSchedule = generateAmortizationSchedule(scenario);
    const targetInstallment = Math.max(12, Math.floor(variant.term * 0.65));
    const targetDate = baseSchedule.find(
      (row) => row.installmentNumber === targetInstallment,
    )!.date;
    const result = optimizePrepayments({
      goal: 'payoff_by_date',
      scenario,
      targetDate,
      buildPlan,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.iterations).toBeLessThanOrEqual(40);
    const rerun = runGeneratedPlan(scenario, result.prepayments);
    expect(calendarStamp(rerun.schedule.at(-1)!.date)).toBeLessThanOrEqual(
      calendarStamp(targetDate),
    );
    expect(rerun.summary.totalInterest).toBeCloseTo(result.optimizedSummary.totalInterest, 2);
  });
});
