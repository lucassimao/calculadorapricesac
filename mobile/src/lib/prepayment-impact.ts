import { calculateLoanSummary, generateAmortizationSchedule } from '@loan-engine/calculations';
import type { Scenario } from '@loan-engine/loan';

export interface PrepaymentImpact {
  interestSaved: number;
  originalPayoffDate: Date;
  newPayoffDate: Date;
  installmentsSaved: number;
  paymentBefore?: number;
  paymentAfter?: number;
}

function getContractInstallmentCost(row: {
  payment: number;
  totalCost?: number;
  prepaymentAmount?: number;
}) {
  return Math.max((row.totalCost ?? row.payment) - (row.prepaymentAmount ?? 0), 0);
}

export function calculatePrepaymentImpact(scenario: Scenario): PrepaymentImpact | null {
  const hasBalanceReducingEvent =
    (scenario.prepayments?.length ?? 0) > 0 ||
    (scenario.fgtsEvents ?? []).some((event) => event.usage === 'amortization');
  if (!hasBalanceReducingEvent) return null;

  const baseScenario: Scenario = {
    ...scenario,
    prepayments: [],
    fgtsEvents: (scenario.fgtsEvents ?? []).filter((event) => event.usage !== 'amortization'),
  };
  const baseSchedule = generateAmortizationSchedule(baseScenario);
  const updatedSchedule = generateAmortizationSchedule(scenario);
  const originalPayoffDate = baseSchedule.at(-1)?.date;
  const newPayoffDate = updatedSchedule.at(-1)?.date;
  if (!originalPayoffDate || !newPayoffDate) return null;

  const baseSummary = calculateLoanSummary(baseSchedule, baseScenario);
  const updatedSummary = calculateLoanSummary(updatedSchedule, scenario);
  const applicationRow = updatedSchedule.find(
    (row) => (row.prepaymentAmount ?? 0) > 0 || (row.fgtsAmortization ?? 0) > 0,
  );
  const comparisonInstallmentNumber = applicationRow
    ? applicationRow.installmentNumber + 1
    : undefined;
  const baseFollowingRow = baseSchedule.find(
    (row) => row.installmentNumber === comparisonInstallmentNumber,
  );
  const updatedFollowingRow = updatedSchedule.find(
    (row) => row.installmentNumber === comparisonInstallmentNumber,
  );
  const interestSaved =
    Math.round(Math.max(baseSummary.totalInterest - updatedSummary.totalInterest, 0) * 100) / 100;
  const installmentsSaved = Math.max(baseSchedule.length - updatedSchedule.length, 0);
  if (interestSaved === 0 && installmentsSaved === 0 && !baseFollowingRow && !updatedFollowingRow) {
    return null;
  }

  return {
    interestSaved,
    originalPayoffDate: new Date(originalPayoffDate),
    newPayoffDate: new Date(newPayoffDate),
    installmentsSaved,
    paymentBefore: baseFollowingRow ? getContractInstallmentCost(baseFollowingRow) : undefined,
    paymentAfter: updatedFollowingRow ? getContractInstallmentCost(updatedFollowingRow) : undefined,
  };
}
