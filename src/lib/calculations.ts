import type { LoanSummary, Scenario, ScheduleRow } from '../types/loan';

const roundCents = (value: number) => Math.round(value * 100) / 100;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function convertRateToMonthly(rate: number, isAnnual: boolean): number {
  if (!isAnnual) return rate / 100;
  return Math.pow(1 + rate / 100, 1 / 12) - 1;
}

export function calculatePricePayment(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  if (monthlyRate === 0) return principal / termMonths;
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
  return principal * (numerator / denominator);
}

export function calculateSacAmortization(principal: number, termMonths: number): number {
  return principal / termMonths;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetMonth = next.getMonth() + months;
  next.setMonth(targetMonth);
  return next;
}

export function generateAmortizationSchedule(scenario: Scenario): ScheduleRow[] {
  const monthlyRate = convertRateToMonthly(scenario.rate, scenario.rateType === 'annual');
  const termMonths = scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term;

  const schedule: ScheduleRow[] = [];
  let balance = scenario.principal;
  let currentDate = new Date(scenario.startDate);

  // Row 0 (spreadsheet parity)
  schedule.push({
    installmentNumber: 0,
    date: new Date(currentDate),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: roundCents(balance),
  });

  if (scenario.system === 'PRICE') {
    const fixedPayment = calculatePricePayment(balance, monthlyRate, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * monthlyRate;
      const amortization = fixedPayment - interest;
      balance -= amortization;

      const installmentDate = new Date(currentDate);
      installmentDate.setDate(scenario.dueDay);
      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: roundCents(fixedPayment),
        interest: roundCents(interest),
        amortization: roundCents(amortization),
        balance: roundCents(balance < 0 ? 0 : balance),
      });

      currentDate = addMonths(currentDate, 1);
    }
  } else {
    const fixedAmortization = calculateSacAmortization(balance, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * monthlyRate;
      const payment = fixedAmortization + interest;
      balance -= fixedAmortization;

      const installmentDate = new Date(currentDate);
      installmentDate.setDate(scenario.dueDay);
      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: roundCents(payment),
        interest: roundCents(interest),
        amortization: roundCents(fixedAmortization),
        balance: roundCents(balance < 0 ? 0 : balance),
      });

      currentDate = addMonths(currentDate, 1);
    }
  }

  return schedule;
}

export function calculateLoanSummary(schedule: ScheduleRow[]): LoanSummary {
  const totals = schedule.reduce(
    (acc, row) => ({
      payment: acc.payment + row.payment,
      interest: acc.interest + row.interest,
    }),
    { payment: 0, interest: 0 }
  );

  const payments = schedule.map((row) => row.payment).filter((p) => p > 0);
  const firstPayment = payments[0] || 0;
  const lastPayment = payments[payments.length - 1] || 0;
  const averagePayment = payments.length > 0 ? totals.payment / payments.length : 0;
  const interestPercentage = totals.payment > 0 ? (totals.interest / totals.payment) * 100 : 0;

  return {
    totalPayment: roundCents(totals.payment),
    totalInterest: roundCents(totals.interest),
    firstPayment: roundCents(firstPayment),
    lastPayment: roundCents(lastPayment),
    averagePayment: roundCents(averagePayment),
    interestPercentage: roundCents(interestPercentage),
  };
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function validateScenario(scenario: Scenario): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (scenario.principal <= 0) {
    errors.push('Valor do financiamento deve ser maior que zero.');
  }
  if (scenario.rate <= 0) {
    errors.push('Taxa de juros deve ser maior que zero.');
  }
  if (scenario.term <= 0) {
    errors.push('Prazo deve ser maior que zero.');
  }
  if (scenario.dueDay < 1 || scenario.dueDay > 31) {
    errors.push('Dia de vencimento deve estar entre 1 e 31.');
  }

  if (scenario.rateType === 'monthly' && scenario.rate > 10) {
    warnings.push('Taxa mensal parece alta. Verifique se não é anual.');
  }
  if (scenario.rateType === 'annual' && scenario.rate < 5) {
    warnings.push('Taxa anual parece baixa. Verifique se não é mensal.');
  }

  return { errors, warnings };
}
