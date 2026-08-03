import { calculateLoanSummary, generateAmortizationSchedule } from '@loan-engine/calculations';
import type { Scenario, ScheduleRow } from '@loan-engine/loan';

export type InvestmentVehicle = 'cdi' | 'tesouro_selic';
export type InvestmentTaxRegime = 'regressive' | 'exempt';

interface InvestmentRatePreset {
  vehicle: InvestmentVehicle;
  label: string;
  annualRate: number;
  asOf: string;
  sourceLabel: string;
  sourceUrl: string;
  disclaimer: string;
}

export const INVESTMENT_RATE_PRESETS: Record<InvestmentVehicle, InvestmentRatePreset> = {
  cdi: {
    vehicle: 'cdi',
    label: '100% do CDI',
    annualRate: 14.15,
    asOf: '2026-07-06',
    sourceLabel: 'B3 — DI Over',
    sourceUrl: 'https://arquivos.b3.com.br/bdi/download/bdi/2026-07-06/BDI_01_20260706.pdf',
    disclaimer: 'Taxa bruta estática usada como estimativa; informe a taxa real do seu produto.',
  },
  tesouro_selic: {
    vehicle: 'tesouro_selic',
    label: 'Tesouro Selic',
    annualRate: 14.25,
    asOf: '2026-06-18',
    sourceLabel: 'Banco Central — meta Selic',
    sourceUrl: 'https://www.bcb.gov.br/controleinflacao/historicotaxasjuros',
    disclaimer:
      'Taxa bruta estática usada como estimativa; não inclui ágio/deságio, custódia ou oscilação.',
  },
};

export interface InvestmentProjection {
  grossBalance: number;
  grossProfit: number;
  taxRate: number;
  taxAmount: number;
  netBalance: number;
  netProfit: number;
}

export interface AmortizeOrInvestResult {
  amortization: {
    interestSaved: number;
    originalPayoffDate: Date;
    newPayoffDate: Date;
    horizonValue: number;
    equivalentAnnualReturn: number;
  };
  investment: InvestmentProjection;
  winner: 'amortize' | 'invest' | 'tie';
  difference: number;
  flipAnnualRate: number;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getRegressiveIncomeTaxRate(horizonDays: number) {
  if (horizonDays <= 180) return 0.225;
  if (horizonDays <= 360) return 0.2;
  if (horizonDays <= 720) return 0.175;
  return 0.15;
}

function assertProjectionInputs({
  principal,
  annualRate,
  horizonMonths,
  horizonDays,
}: {
  principal: number;
  annualRate: number;
  horizonMonths: number;
  horizonDays?: number;
}) {
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('Informe um valor extra maior que zero.');
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new Error('Informe uma rentabilidade anual válida.');
  }
  if (!Number.isInteger(horizonMonths) || horizonMonths <= 0) {
    throw new Error('Informe um horizonte inteiro maior que zero.');
  }
  if (horizonDays !== undefined && (!Number.isInteger(horizonDays) || horizonDays <= 0)) {
    throw new Error('Informe um prazo em dias maior que zero.');
  }
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function calendarDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

function calendarDaysBetween(start: Date, end: Date) {
  return Math.max(Math.round(calendarDayNumber(end) - calendarDayNumber(start)), 0);
}

function projectInvestmentRaw({
  principal,
  annualRate,
  horizonMonths,
  horizonDays,
  taxRegime,
}: {
  principal: number;
  annualRate: number;
  horizonMonths: number;
  horizonDays: number;
  taxRegime: InvestmentTaxRegime;
}) {
  const grossBalance = principal * Math.pow(1 + annualRate / 100, horizonMonths / 12);
  const grossProfit = Math.max(grossBalance - principal, 0);
  const taxRate = taxRegime === 'exempt' ? 0 : getRegressiveIncomeTaxRate(horizonDays);
  const taxAmount = grossProfit * taxRate;
  return {
    grossBalance,
    grossProfit,
    taxRate,
    taxAmount,
    netBalance: grossBalance - taxAmount,
  };
}

export function projectInvestment({
  principal,
  annualRate,
  horizonMonths,
  horizonDays,
  taxRegime = 'regressive',
}: {
  principal: number;
  annualRate: number;
  horizonMonths: number;
  horizonDays: number;
  taxRegime?: InvestmentTaxRegime;
}): InvestmentProjection {
  assertProjectionInputs({ principal, annualRate, horizonMonths, horizonDays });
  const { grossBalance, grossProfit, taxRate, taxAmount, netBalance } = projectInvestmentRaw({
    principal,
    annualRate,
    horizonMonths,
    horizonDays,
    taxRegime,
  });

  return {
    grossBalance: roundMoney(grossBalance),
    grossProfit: roundMoney(grossProfit),
    taxRate,
    taxAmount: roundMoney(taxAmount),
    netBalance: roundMoney(netBalance),
    netProfit: roundMoney(netBalance - principal),
  };
}

function getRegularPayment(row: ScheduleRow) {
  return Math.max(
    (row.totalCost ?? row.payment) - (row.prepaymentAmount ?? 0) - (row.fgtsSubsidy ?? 0),
    0,
  );
}

function getHorizonPosition(schedule: ScheduleRow[], horizonEndDate: Date) {
  const rows = schedule.filter(
    (row) => row.installmentNumber > 0 && row.date.getTime() < horizonEndDate.getTime(),
  );
  const finalRow = schedule.at(-1);
  const balance =
    finalRow && finalRow.date.getTime() < horizonEndDate.getTime()
      ? 0
      : (rows.at(-1)?.balance ?? schedule[0]?.balance ?? 0);
  const regularPayments = new Map(
    rows.map((row) => [row.installmentNumber, getRegularPayment(row)] as const),
  );
  return { balance, regularPayments, rows };
}

function calculateAmortizationHorizonValue({
  baseSchedule,
  amortizedSchedule,
  horizonMonths,
  horizonDays,
  horizonEndDate,
  reinvestmentAnnualRate,
  taxRegime,
}: {
  baseSchedule: ScheduleRow[];
  amortizedSchedule: ScheduleRow[];
  horizonMonths: number;
  horizonDays: number;
  horizonEndDate: Date;
  reinvestmentAnnualRate: number;
  taxRegime: InvestmentTaxRegime;
}) {
  const base = getHorizonPosition(baseSchedule, horizonEndDate);
  const amortized = getHorizonPosition(amortizedSchedule, horizonEndDate);
  let reinvestedPaymentSavings = 0;

  for (const baseRow of base.rows) {
    const saving =
      (base.regularPayments.get(baseRow.installmentNumber) ?? 0) -
      (amortized.regularPayments.get(baseRow.installmentNumber) ?? 0);
    if (Math.abs(saving) < 0.005) continue;

    const remainingDays = calendarDaysBetween(baseRow.date, horizonEndDate);
    const remainingMonths = horizonMonths * (remainingDays / horizonDays);
    if (remainingDays === 0 || reinvestmentAnnualRate === 0) {
      reinvestedPaymentSavings += saving;
      continue;
    }

    if (saving < 0) {
      reinvestedPaymentSavings +=
        saving * Math.pow(1 + reinvestmentAnnualRate / 100, remainingMonths / 12);
      continue;
    }

    reinvestedPaymentSavings += projectInvestmentRaw({
      principal: saving,
      annualRate: reinvestmentAnnualRate,
      horizonMonths: remainingMonths,
      horizonDays: remainingDays,
      taxRegime,
    }).netBalance;
  }

  return Math.max(base.balance - amortized.balance + reinvestedPaymentSavings, 0);
}

function solveAnnualRate(valueDifferenceAtRate: (annualRate: number) => number) {
  if (valueDifferenceAtRate(0) >= 0) return 0;
  let low = 0;
  let high = 25;
  while (valueDifferenceAtRate(high) < 0 && high < 10_000) high *= 2;
  if (valueDifferenceAtRate(high) < 0) return high;

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    if (valueDifferenceAtRate(middle) < 0) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function calculateBreakEvenAnnualRate({
  principal,
  horizonMonths,
  horizonDays,
  taxRegime,
  amortizationValueAtRate,
}: {
  principal: number;
  horizonMonths: number;
  horizonDays: number;
  taxRegime: InvestmentTaxRegime;
  amortizationValueAtRate: (annualRate: number, taxRegime: InvestmentTaxRegime) => number;
}) {
  return solveAnnualRate((annualRate) => {
    const investmentValue = projectInvestmentRaw({
      principal,
      annualRate,
      horizonMonths,
      horizonDays,
      taxRegime,
    }).netBalance;
    return investmentValue - amortizationValueAtRate(annualRate, taxRegime);
  });
}

export function compareAmortizeOrInvest({
  scenario,
  extraAmount,
  investmentAnnualRate,
  horizonMonths,
  taxRegime = 'regressive',
}: {
  scenario: Scenario;
  extraAmount: number;
  investmentAnnualRate: number;
  horizonMonths: number;
  taxRegime?: InvestmentTaxRegime;
}): AmortizeOrInvestResult {
  assertProjectionInputs({
    principal: extraAmount,
    annualRate: investmentAnnualRate,
    horizonMonths,
  });
  if (extraAmount > scenario.principal) {
    throw new Error('O valor extra não pode superar o saldo devedor.');
  }

  const baseSchedule = generateAmortizationSchedule(scenario);
  const firstInstallment = baseSchedule.find((row) => row.installmentNumber === 1);
  const originalPayoffDate = baseSchedule.at(-1)?.date;
  if (!firstInstallment || !originalPayoffDate) {
    throw new Error('Não foi possível gerar o cronograma para comparar.');
  }

  const comparisonScenario: Scenario = {
    ...scenario,
    prepayments: [
      ...(scenario.prepayments ?? []),
      {
        id: 'amortize-or-invest-comparison',
        date: new Date(firstInstallment.date),
        amount: extraAmount,
        type: 'fixed_amount',
        strategy: 'reduce_term',
        description: 'Comparador amortizar ou investir',
      },
    ],
  };
  const amortizedSchedule = generateAmortizationSchedule(comparisonScenario);
  const newPayoffDate = amortizedSchedule.at(-1)?.date;
  if (!newPayoffDate) {
    throw new Error('Não foi possível gerar o cronograma amortizado.');
  }

  const baseSummary = calculateLoanSummary(baseSchedule, scenario);
  const amortizedSummary = calculateLoanSummary(amortizedSchedule, comparisonScenario);
  const horizonStartDate = new Date(firstInstallment.date);
  const horizonEndDate = addMonthsClamped(horizonStartDate, horizonMonths);
  const horizonDays = Math.max(calendarDaysBetween(horizonStartDate, horizonEndDate), 1);
  const amortizationValueAtRate = (
    annualRate: number,
    reinvestmentTaxRegime: InvestmentTaxRegime,
  ) =>
    calculateAmortizationHorizonValue({
      baseSchedule,
      amortizedSchedule,
      horizonMonths,
      horizonDays,
      horizonEndDate,
      reinvestmentAnnualRate: annualRate,
      taxRegime: reinvestmentTaxRegime,
    });
  const horizonValue = amortizationValueAtRate(investmentAnnualRate, taxRegime);
  const equivalentAnnualReturn = calculateBreakEvenAnnualRate({
    principal: extraAmount,
    horizonMonths,
    horizonDays,
    taxRegime: 'exempt',
    amortizationValueAtRate,
  });
  const investment = projectInvestment({
    principal: extraAmount,
    annualRate: investmentAnnualRate,
    horizonMonths,
    horizonDays,
    taxRegime,
  });
  const difference = roundMoney(investment.netBalance - horizonValue);
  const winner = Math.abs(difference) <= 0.01 ? 'tie' : difference > 0 ? 'invest' : 'amortize';

  return {
    amortization: {
      interestSaved: roundMoney(
        Math.max(baseSummary.totalInterest - amortizedSummary.totalInterest, 0),
      ),
      originalPayoffDate: new Date(originalPayoffDate),
      newPayoffDate: new Date(newPayoffDate),
      horizonValue: roundMoney(horizonValue),
      equivalentAnnualReturn: Math.max(equivalentAnnualReturn, 0),
    },
    investment,
    winner,
    difference: Math.abs(difference),
    flipAnnualRate: calculateBreakEvenAnnualRate({
      principal: extraAmount,
      horizonMonths,
      horizonDays,
      taxRegime,
      amortizationValueAtRate,
    }),
  };
}
