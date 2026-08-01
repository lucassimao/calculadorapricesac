import type {
  CetResult,
  FgtsEvent,
  LoanSummary,
  PrepaymentEvent,
  Scenario,
  ScheduleRow,
} from '@loan-engine/loan';

const roundCents = (value: number) => Math.round(value * 100) / 100;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

interface CostSummary {
  upfront: number;
  iof: number;
  openingFee: number;
  itbi: number;
  registryFee: number;
}

export interface CetCashFlow {
  amount: number;
  yearFraction: number;
}

export interface SolveCetInput {
  netDisbursement: number;
  cashFlows: CetCashFlow[];
}

const CET_MAX_ANNUAL_RATE = 1;
const CET_MIN_ANNUAL_RATE = -0.99;
const CET_RATE_TOLERANCE = 1e-10;
const CET_MAX_ITERATIONS = 100;
export const CET_UNAVAILABLE_LABEL = 'CET indisponível para este cenário';

export function formatCetResult(cet: CetResult, decimalSeparator: ',' | '.' = ','): string {
  if (cet.status === 'unavailable') return CET_UNAVAILABLE_LABEL;
  return `${cet.annualRate.toFixed(2).replace('.', decimalSeparator)}%`;
}

type MonthlyAmortization = PrepaymentEvent & {
  source: 'prepayment' | 'fgts';
};

function getMonthlyCorrectionRate(scenario: Scenario): number | null {
  if (!scenario.indexType) return null;
  const rate = scenario.indexRate;
  return typeof rate === 'number' && Number.isFinite(rate) ? rate / 100 : 0;
}

function applyBalanceCorrection(
  balance: number,
  monthlyCorrectionRate: number | null,
): { balance: number; indexCorrection?: number } {
  if (monthlyCorrectionRate === null) {
    return { balance };
  }

  const originalBalance = balance;
  const correctedBalance = Math.max(balance + roundCents(balance * monthlyCorrectionRate), 0);
  return {
    balance: correctedBalance,
    indexCorrection: roundCents(correctedBalance - originalBalance),
  };
}

function getFinancedPrincipal(scenario: Scenario): number {
  const propertyValue = scenario.propertyValue ?? 0;
  const downPayment = scenario.downPayment ?? 0;
  if (scenario.loanMode === 'property' && propertyValue > 0) {
    return Math.max(propertyValue - downPayment, 0);
  }
  return scenario.principal;
}

function getUpfrontCosts(scenario: Scenario, principal: number): CostSummary {
  const includeIOF = scenario.includeIOF ?? (scenario.iofRate ?? 0) > 0;
  const iofRate = scenario.iofRate ?? 0;
  const iof = includeIOF ? principal * (iofRate / 100) : 0;

  const openingFeeValue = scenario.openingFee ?? 0;
  const includeOpening = scenario.includeOpeningFee ?? openingFeeValue > 0;
  const openingFee = includeOpening ? openingFeeValue : 0;

  const propertyValue = scenario.propertyValue ?? 0;
  const itbiRate = scenario.itbiRate ?? 0;
  const itbi = propertyValue > 0 && itbiRate > 0 ? propertyValue * (itbiRate / 100) : 0;
  const registryFee = scenario.registryFee ?? 0;

  return {
    upfront: iof + openingFee + itbi + registryFee,
    iof,
    openingFee,
    itbi,
    registryFee,
  };
}

function getFgtsDownPayment(scenario: Scenario): number {
  const fgtsEvents = scenario.fgtsEvents ?? [];
  return fgtsEvents
    .filter((event) => event.usage === 'down_payment')
    .reduce((total, event) => total + event.amount, 0);
}

function getFgtsAmortizationsForMonth(fgtsEvents: FgtsEvent[], installmentDate: Date): FgtsEvent[] {
  const month = installmentDate.getMonth();
  const year = installmentDate.getFullYear();
  return fgtsEvents.filter(
    (event) =>
      event.usage === 'amortization' &&
      event.date.getMonth() === month &&
      event.date.getFullYear() === year,
  );
}

function getFgtsInstallmentForMonth(fgtsEvents: FgtsEvent[], installmentDate: Date): number {
  const month = installmentDate.getMonth();
  const year = installmentDate.getFullYear();
  return fgtsEvents
    .filter(
      (event) =>
        event.usage === 'installment' &&
        event.date.getMonth() === month &&
        event.date.getFullYear() === year,
    )
    .reduce((total, event) => total + event.amount, 0);
}

function getMonthlyExtraCosts(balance: number, scenario: Scenario) {
  const includeInsurance = scenario.includeInsurance ?? (scenario.insuranceRate ?? 0) > 0;
  const includeAdminFee = scenario.includeAdminFee ?? (scenario.adminFeeRate ?? 0) > 0;
  const insuranceRate = scenario.insuranceRate ?? 0;
  const adminFeeRate = scenario.adminFeeRate ?? 0;
  const insurance = includeInsurance ? balance * (insuranceRate / 100) : 0;
  const adminFee = includeAdminFee ? balance * (adminFeeRate / 100) : 0;
  const extraCosts = insurance + adminFee;
  return {
    insurance,
    adminFee,
    extraCosts,
  };
}

export function convertRateToMonthly(rate: number, isAnnual: boolean): number {
  if (!isAnnual) return rate / 100;
  return Math.pow(1 + rate / 100, 1 / 12) - 1;
}

export function calculatePricePayment(
  principal: number,
  monthlyRate: number,
  termMonths: number,
): number {
  if (monthlyRate === 0) return principal / termMonths;
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
  return principal * (numerator / denominator);
}

export function calculateSacAmortization(principal: number, termMonths: number): number {
  return principal / termMonths;
}

export function solveCet({ netDisbursement, cashFlows }: SolveCetInput): CetResult {
  if (
    !Number.isFinite(netDisbursement) ||
    cashFlows.length === 0 ||
    cashFlows.some(
      ({ amount, yearFraction }) =>
        !Number.isFinite(amount) ||
        amount < 0 ||
        !Number.isFinite(yearFraction) ||
        yearFraction < 0,
    )
  ) {
    return { status: 'unavailable', reason: 'non_convergence' };
  }

  const npv = (annualRate: number) => {
    const base = 1 + annualRate;
    if (base <= 0) return Number.NaN;

    let discountedOutflows = 0;
    for (const { amount, yearFraction } of cashFlows) {
      const discountFactor = Math.pow(base, yearFraction);
      const presentValue = amount / discountFactor;
      if (!Number.isFinite(presentValue)) return Number.NaN;
      discountedOutflows += presentValue;
      if (!Number.isFinite(discountedOutflows)) return Number.NaN;
    }
    return netDisbursement - discountedOutflows;
  };

  const monetaryTolerance = Math.max(0.01, cashFlows.length * 0.01);
  const atZero = npv(0);
  if (!Number.isFinite(atZero)) {
    return { status: 'unavailable', reason: 'non_convergence' };
  }
  if (Math.abs(atZero) <= monetaryTolerance) {
    return { status: 'available', root: 'zero', annualRate: 0 };
  }

  const root = atZero < 0 ? 'positive' : 'negative';
  let low = root === 'positive' ? 0 : CET_MIN_ANNUAL_RATE;
  let high = root === 'positive' ? CET_MAX_ANNUAL_RATE : 0;
  let lowValue = npv(low);
  let highValue = npv(high);

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
    return { status: 'unavailable', reason: 'non_convergence' };
  }
  if (Math.abs(lowValue) <= monetaryTolerance) {
    return { status: 'available', root, annualRate: roundCents(low * 100) };
  }
  if (Math.abs(highValue) <= monetaryTolerance) {
    return { status: 'available', root, annualRate: roundCents(high * 100) };
  }
  if (lowValue > 0 || highValue < 0) {
    return { status: 'unavailable', reason: 'no_sign_change' };
  }

  for (let iteration = 0; iteration < CET_MAX_ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid);
    if (!Number.isFinite(midValue)) {
      return { status: 'unavailable', reason: 'non_convergence' };
    }
    if (Math.abs(midValue) <= monetaryTolerance || high - low <= CET_RATE_TOLERANCE) {
      return { status: 'available', root, annualRate: roundCents(mid * 100) };
    }
    if (midValue < 0) {
      low = mid;
      lowValue = midValue;
    } else {
      high = mid;
      highValue = midValue;
    }
  }

  return { status: 'unavailable', reason: 'non_convergence' };
}

function addMonths(date: Date, months: number): Date {
  const dayOfMonth = date.getDate();

  // Calculate target year and month
  const totalMonths = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Get last day of target month
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  // Create new date, setting day to 1 first to avoid intermediate overflow
  const next = new Date(date);
  next.setDate(1);
  next.setFullYear(targetYear);
  next.setMonth(targetMonth);
  next.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return next;
}

function setDayClamped(date: Date, day: number): void {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDayOfMonth));
}

function getFirstDueDate(startDate: Date, dueDay: number): Date {
  const earliestDueDate = new Date(startDate);
  earliestDueDate.setDate(earliestDueDate.getDate() + 30);

  let candidate = new Date(startDate);
  candidate.setDate(1);
  setDayClamped(candidate, dueDay);

  while (candidate.getTime() < earliestDueDate.getTime()) {
    candidate = addMonths(candidate, 1);
    setDayClamped(candidate, dueDay);
  }

  return candidate;
}

export function generateAmortizationSchedule(scenario: Scenario): ScheduleRow[] {
  const monthlyRate = convertRateToMonthly(scenario.rate, scenario.rateType === 'annual');
  const termMonths = scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term;

  const schedule: ScheduleRow[] = [];
  const fgtsDownPayment = getFgtsDownPayment(scenario);
  let balance = Math.max(getFinancedPrincipal(scenario) - fgtsDownPayment, 0);
  let currentDate = getFirstDueDate(scenario.startDate, scenario.dueDay);
  const prepayments = scenario.prepayments ?? [];
  const fgtsEvents = scenario.fgtsEvents ?? [];
  const sortedPrepayments = [...prepayments].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedFgts = [...fgtsEvents].sort((a, b) => a.date.getTime() - b.date.getTime());
  const monthlyCorrectionRate = getMonthlyCorrectionRate(scenario);

  // Row 0 (spreadsheet parity)
  schedule.push({
    installmentNumber: 0,
    date: new Date(currentDate),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: roundCents(balance),
  });

  const getPrepaymentsForMonth = (installmentDate: Date): MonthlyAmortization[] => {
    const month = installmentDate.getMonth();
    const year = installmentDate.getFullYear();
    return sortedPrepayments
      .filter((p) => p.date.getMonth() === month && p.date.getFullYear() === year)
      .map((prepayment) => ({
        ...prepayment,
        source: 'prepayment',
      }));
  };
  const getAllAmortizationsForMonth = (installmentDate: Date): MonthlyAmortization[] => {
    const base = getPrepaymentsForMonth(installmentDate);
    const fgtsAmortizations = getFgtsAmortizationsForMonth(sortedFgts, installmentDate).map(
      (event) => ({
        id: event.id,
        date: event.date,
        amount: event.amount,
        type: 'fixed_amount' as const,
        strategy: event.strategy ?? 'reduce_term',
        description: event.description ?? 'FGTS',
        source: 'fgts' as const,
      }),
    );
    return [...base, ...fgtsAmortizations];
  };

  if (scenario.system === 'PRICE') {
    let fixedPayment = calculatePricePayment(balance, monthlyRate, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const corrected = applyBalanceCorrection(balance, monthlyCorrectionRate);
      balance = corrected.balance;
      const indexCorrection = corrected.indexCorrection;
      if (monthlyCorrectionRate !== null) {
        fixedPayment = calculatePricePayment(balance, monthlyRate, termMonths - i + 1);
      }

      const interest = balance * monthlyRate;
      let amortization = fixedPayment - interest;
      let payment = fixedPayment;
      const { insurance, adminFee, extraCosts } = getMonthlyExtraCosts(balance, scenario);

      const installmentDate = new Date(currentDate);
      setDayClamped(installmentDate, scenario.dueDay);

      const prepaymentsForMonth = getAllAmortizationsForMonth(installmentDate);
      let fgtsAmortization = 0;
      let prepaymentAmount = 0;
      let prepaymentDescription: string | undefined;

      if (prepaymentsForMonth.length > 0) {
        for (const prepayment of prepaymentsForMonth) {
          let amount = 0;
          if (prepayment.type === 'fixed_amount') {
            amount = prepayment.amount;
          } else if (prepayment.type === 'percentage') {
            amount = (prepayment.amount / 100) * balance;
          } else {
            continue;
          }

          amount = Math.min(amount, balance - amortization);
          if (amount > 0) {
            prepaymentAmount += amount;
            prepaymentDescription = prepayment.description || prepaymentDescription;
            if (prepayment.source === 'fgts') {
              fgtsAmortization += amount;
            }
          }
        }

        if (prepaymentAmount > 0) {
          if (prepaymentsForMonth.some((p) => p.strategy === 'reduce_term')) {
            amortization += prepaymentAmount;
            payment += prepaymentAmount;
          } else {
            amortization += prepaymentAmount;
            payment += prepaymentAmount;
            const remaining = termMonths - i;
            if (remaining > 0) {
              fixedPayment = calculatePricePayment(balance - amortization, monthlyRate, remaining);
            }
          }
        }
      }

      balance -= amortization;
      const isPaidOff = balance <= 0;

      const fgtsSubsidy = Math.min(
        getFgtsInstallmentForMonth(sortedFgts, installmentDate),
        payment,
      );
      const netPayment = payment - fgtsSubsidy;

      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: roundCents(payment),
        interest: roundCents(interest),
        amortization: roundCents(amortization),
        balance: roundCents(balance < 0 ? 0 : balance),
        prepaymentAmount: prepaymentAmount > 0 ? roundCents(prepaymentAmount) : undefined,
        prepaymentDescription,
        insurance: insurance > 0 ? roundCents(insurance) : undefined,
        adminFee: adminFee > 0 ? roundCents(adminFee) : undefined,
        extraCosts: extraCosts > 0 ? roundCents(extraCosts) : undefined,
        totalCost: roundCents(payment + extraCosts),
        fgtsAmortization: fgtsAmortization > 0 ? roundCents(fgtsAmortization) : undefined,
        fgtsSubsidy: fgtsSubsidy > 0 ? roundCents(fgtsSubsidy) : undefined,
        netPayment: roundCents(netPayment),
        indexCorrection,
      });

      if (isPaidOff) {
        break;
      }

      currentDate = addMonths(currentDate, 1);
    }
  } else {
    let fixedAmortization = calculateSacAmortization(balance, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const corrected = applyBalanceCorrection(balance, monthlyCorrectionRate);
      balance = corrected.balance;
      const indexCorrection = corrected.indexCorrection;
      if (monthlyCorrectionRate !== null) {
        fixedAmortization = calculateSacAmortization(balance, termMonths - i + 1);
      }

      const interest = balance * monthlyRate;
      let amortization = fixedAmortization;
      let payment = fixedAmortization + interest;
      const { insurance, adminFee, extraCosts } = getMonthlyExtraCosts(balance, scenario);

      const installmentDate = new Date(currentDate);
      setDayClamped(installmentDate, scenario.dueDay);

      const prepaymentsForMonth = getAllAmortizationsForMonth(installmentDate);
      let fgtsAmortization = 0;
      let prepaymentAmount = 0;
      let prepaymentDescription: string | undefined;

      if (prepaymentsForMonth.length > 0) {
        for (const prepayment of prepaymentsForMonth) {
          let amount = 0;
          if (prepayment.type === 'fixed_amount') {
            amount = prepayment.amount;
          } else if (prepayment.type === 'percentage') {
            amount = (prepayment.amount / 100) * balance;
          } else {
            continue;
          }

          amount = Math.min(amount, balance - amortization);
          if (amount > 0) {
            prepaymentAmount += amount;
            prepaymentDescription = prepayment.description || prepaymentDescription;
            if (prepayment.source === 'fgts') {
              fgtsAmortization += amount;
            }
          }
        }

        if (prepaymentAmount > 0) {
          if (prepaymentsForMonth.some((p) => p.strategy === 'reduce_term')) {
            amortization += prepaymentAmount;
            payment += prepaymentAmount;
          } else {
            amortization += prepaymentAmount;
            payment += prepaymentAmount;
            const remaining = termMonths - i;
            if (remaining > 0) {
              fixedAmortization = calculateSacAmortization(balance - amortization, remaining);
            }
          }
        }
      }

      balance -= amortization;
      const isPaidOff = balance <= 0;

      const fgtsSubsidy = Math.min(
        getFgtsInstallmentForMonth(sortedFgts, installmentDate),
        payment,
      );
      const netPayment = payment - fgtsSubsidy;

      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: roundCents(payment),
        interest: roundCents(interest),
        amortization: roundCents(amortization),
        balance: roundCents(balance < 0 ? 0 : balance),
        prepaymentAmount: prepaymentAmount > 0 ? roundCents(prepaymentAmount) : undefined,
        prepaymentDescription,
        insurance: insurance > 0 ? roundCents(insurance) : undefined,
        adminFee: adminFee > 0 ? roundCents(adminFee) : undefined,
        extraCosts: extraCosts > 0 ? roundCents(extraCosts) : undefined,
        totalCost: roundCents(payment + extraCosts),
        fgtsAmortization: fgtsAmortization > 0 ? roundCents(fgtsAmortization) : undefined,
        fgtsSubsidy: fgtsSubsidy > 0 ? roundCents(fgtsSubsidy) : undefined,
        netPayment: roundCents(netPayment),
        indexCorrection,
      });

      if (isPaidOff) {
        break;
      }

      currentDate = addMonths(currentDate, 1);
    }
  }

  return schedule;
}

export function calculateLoanSummary(schedule: ScheduleRow[], scenario: Scenario): LoanSummary {
  const totals = schedule.reduce(
    (acc, row) => ({
      payment: acc.payment + row.payment,
      interest: acc.interest + row.interest,
      extraCosts: acc.extraCosts + (row.extraCosts ?? 0),
      netPayment: acc.netPayment + (row.netPayment ?? row.payment),
      fgtsAmortization: acc.fgtsAmortization + (row.fgtsAmortization ?? 0),
      fgtsSubsidy: acc.fgtsSubsidy + (row.fgtsSubsidy ?? 0),
      indexCorrection: acc.indexCorrection + (row.indexCorrection ?? 0),
    }),
    {
      payment: 0,
      interest: 0,
      extraCosts: 0,
      netPayment: 0,
      fgtsAmortization: 0,
      fgtsSubsidy: 0,
      indexCorrection: 0,
    },
  );

  const payments = schedule.map((row) => row.payment).filter((p) => p > 0);
  const firstPayment = payments[0] || 0;
  const lastPayment = payments[payments.length - 1] || 0;
  const averagePayment = payments.length > 0 ? totals.payment / payments.length : 0;
  const interestPercentage = totals.payment > 0 ? (totals.interest / totals.payment) * 100 : 0;

  const financedPrincipal = getFinancedPrincipal(scenario);
  const upfrontCosts = getUpfrontCosts(scenario, financedPrincipal);
  const fgtsDownPayment = getFgtsDownPayment(scenario);
  const totalUpfrontCosts = upfrontCosts.upfront;
  const totalMonthlyCosts = totals.extraCosts;
  const totalPaymentWithCosts = totals.payment + totalUpfrontCosts + totalMonthlyCosts;
  const propertyValue = scenario.propertyValue ?? 0;
  const propertyTotalCost =
    scenario.loanMode === 'property' && propertyValue > 0
      ? propertyValue + upfrontCosts.itbi + upfrontCosts.registryFee
      : 0;

  const installments = schedule.filter((row) => row.installmentNumber > 0);
  const netDisbursement = financedPrincipal - totalUpfrontCosts - fgtsDownPayment;
  let cet: CetResult = { status: 'unavailable', reason: 'no_sign_change' };
  if (netDisbursement > 0 && installments.length > 0) {
    // Use actual dates for more accurate CET calculation (Brazilian standard uses 365-day year)
    const startDate = scenario.startDate;
    const startTime = startDate.getTime();

    // Calculate year fractions based on actual dates
    // CET follows the borrower's out-of-pocket cash flow. An FGTS installment subsidy therefore
    // reduces the discounted outflow and can legitimately produce the negative-root case.
    const cashFlows = installments.map((row) => ({
      amount: (row.netPayment ?? row.payment) + (row.extraCosts ?? 0),
      yearFraction: (row.date.getTime() - startTime) / (1000 * 60 * 60 * 24) / 365,
    }));
    cet = solveCet({ netDisbursement, cashFlows });
  }

  return {
    totalPayment: roundCents(totals.payment),
    totalInterest: roundCents(totals.interest),
    firstPayment: roundCents(firstPayment),
    lastPayment: roundCents(lastPayment),
    averagePayment: roundCents(averagePayment),
    interestPercentage: roundCents(interestPercentage),
    totalUpfrontCosts: roundCents(totalUpfrontCosts),
    totalMonthlyCosts: roundCents(totalMonthlyCosts),
    totalPaymentWithCosts: roundCents(totalPaymentWithCosts),
    cet,
    financedPrincipal: roundCents(financedPrincipal),
    propertyTotalCost: roundCents(propertyTotalCost),
    totalFgtsUsed: roundCents(fgtsDownPayment + totals.fgtsAmortization + totals.fgtsSubsidy),
    totalPaymentNet: roundCents(totals.netPayment),
    totalIndexCorrection: roundCents(totals.indexCorrection),
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

  const financedPrincipal = getFinancedPrincipal(scenario);
  if (financedPrincipal <= 0) {
    errors.push('Valor do financiamento deve ser maior que zero.');
  }
  if (scenario.rate < 0) {
    errors.push('Taxa de juros não pode ser negativa.');
  }
  if (scenario.indexType) {
    if (typeof scenario.indexRate !== 'number' || !Number.isFinite(scenario.indexRate)) {
      errors.push('Informe a taxa mensal do índice de correção.');
    } else {
      if (scenario.indexRate <= -100) {
        errors.push('Taxa de correção deve ser maior que -100% a.m.');
      }
      if (Math.abs(scenario.indexRate) > 5) {
        warnings.push('Taxa mensal de correção parece alta. Verifique o valor informado.');
      }
    }
  }
  if (scenario.term <= 0) {
    errors.push('Prazo deve ser maior que zero.');
  }
  if (scenario.dueDay < 1 || scenario.dueDay > 31) {
    errors.push('Dia de vencimento deve estar entre 1 e 31.');
  }

  if (scenario.loanMode === 'property' && (scenario.propertyValue ?? 0) > 0) {
    const downPayment = scenario.downPayment ?? 0;
    if (downPayment < 0) {
      errors.push('Entrada deve ser maior ou igual a zero.');
    }
    if (downPayment >= (scenario.propertyValue ?? 0)) {
      errors.push('Entrada deve ser menor que o valor do imóvel.');
    }
  }

  if (scenario.rateType === 'monthly' && scenario.rate > 10) {
    warnings.push('Taxa mensal parece alta. Verifique se não é anual.');
  }
  if (scenario.rateType === 'annual' && scenario.rate < 5) {
    warnings.push('Taxa anual parece baixa. Verifique se não é mensal.');
  }
  if (scenario.loanMode === 'property') {
    if (!scenario.propertyValue || scenario.propertyValue <= 0) {
      errors.push('Informe o valor do imóvel para o modo imobiliário.');
    }
    if (scenario.downPayment === undefined || scenario.downPayment < 0) {
      errors.push('Informe a entrada para o modo imobiliário.');
    }
  }
  if ((scenario.includeInsurance ?? false) && (scenario.insuranceRate ?? 0) <= 0) {
    warnings.push('Seguro ativado sem taxa informada.');
  }
  if ((scenario.includeAdminFee ?? false) && (scenario.adminFeeRate ?? 0) <= 0) {
    warnings.push('Tarifa administrativa ativada sem taxa informada.');
  }
  if ((scenario.includeIOF ?? false) && (scenario.iofRate ?? 0) <= 0) {
    warnings.push('IOF ativado sem taxa informada.');
  }
  if ((scenario.includeOpeningFee ?? false) && (scenario.openingFee ?? 0) <= 0) {
    warnings.push('Taxa de abertura ativada sem valor informado.');
  }

  return { errors, warnings };
}
