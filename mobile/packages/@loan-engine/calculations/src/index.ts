import type {
  CetResult,
  FgtsEvent,
  LoanSummary,
  PrepaymentEvent,
  Scenario,
  ScheduleRow,
} from '@loan-engine/loan';

const roundCents = (value: number) => Math.round(value * 100) / 100;
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

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
const MAX_TERM_MONTHS = 600;
export const CET_UNAVAILABLE_LABEL = 'CET indisponível para este cenário';
export const MIXED_PREPAYMENT_STRATEGIES_WARNING =
  'Amortizações na mesma parcela com estratégias diferentes serão aplicadas nesta ordem: reduzir parcela e depois reduzir prazo.';
export const OUT_OF_TERM_EVENT_WARNING_FRAGMENT =
  'está fora do período do financiamento e foi ignorada.';

export function formatCetResult(cet: CetResult, decimalSeparator: ',' | '.' = ','): string {
  if (cet.status === 'unavailable') return CET_UNAVAILABLE_LABEL;
  return `${cet.annualRate.toFixed(2).replace('.', decimalSeparator)}%`;
}

type MonthlyAmortization = PrepaymentEvent & {
  source: 'prepayment' | 'fgts';
};

interface AppliedMonthlyAmortizations {
  totalCents: number;
  reducePaymentCents: number;
  fgtsCents: number;
  description?: string;
}

function applyMonthlyAmortizations(
  amortizations: MonthlyAmortization[],
  openingBalanceCents: number,
  scheduledAmortizationCents: number,
): AppliedMonthlyAmortizations {
  const orderedAmortizations = [...amortizations].sort((left, right) => {
    const strategyOrder =
      Number(left.strategy === 'reduce_term') - Number(right.strategy === 'reduce_term');
    if (strategyOrder !== 0) return strategyOrder;

    const dateOrder = left.date.getTime() - right.date.getTime();
    if (dateOrder !== 0) return dateOrder;

    const sourceOrder = Number(left.source === 'fgts') - Number(right.source === 'fgts');
    if (sourceOrder !== 0) return sourceOrder;
    return left.id.localeCompare(right.id);
  });

  let remainingCapacityCents = openingBalanceCents - scheduledAmortizationCents;
  let totalCents = 0;
  let reducePaymentCents = 0;
  let fgtsCents = 0;
  let description: string | undefined;

  for (const amortization of orderedAmortizations) {
    let amountCents = 0;
    if (amortization.type === 'fixed_amount') {
      amountCents = toCents(amortization.amount);
    } else if (amortization.type === 'percentage') {
      // Percentages use the opening installment balance; sequential processing only reduces
      // the remaining allocation headroom so same-month events can never double-spend it.
      amountCents = Math.round((amortization.amount / 100) * openingBalanceCents);
    }

    amountCents = Math.min(amountCents, remainingCapacityCents);
    if (amountCents <= 0) continue;

    totalCents += amountCents;
    remainingCapacityCents -= amountCents;
    description = amortization.description || description;
    if (amortization.strategy === 'reduce_payment') {
      reducePaymentCents += amountCents;
    }
    if (amortization.source === 'fgts') {
      fgtsCents += amountCents;
    }
  }

  return { totalCents, reducePaymentCents, fgtsCents, description };
}

function getMonthlyCorrectionRate(scenario: Scenario): number | null {
  if (!scenario.indexType) return null;
  const rate = scenario.indexRate;
  return typeof rate === 'number' && Number.isFinite(rate) ? rate / 100 : 0;
}

function applyBalanceCorrection(
  balanceCents: number,
  monthlyCorrectionRate: number | null,
): { balanceCents: number; indexCorrectionCents?: number } {
  if (monthlyCorrectionRate === null) {
    return { balanceCents };
  }

  const indexCorrectionCents = Math.max(
    Math.round(balanceCents * monthlyCorrectionRate),
    -balanceCents,
  );
  return {
    balanceCents: balanceCents + indexCorrectionCents,
    indexCorrectionCents,
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
  const includesPropertyCosts = scenario.loanMode === 'property';
  const itbi =
    includesPropertyCosts && propertyValue > 0 && itbiRate > 0
      ? propertyValue * (itbiRate / 100)
      : 0;
  const registryFee = includesPropertyCosts ? (scenario.registryFee ?? 0) : 0;

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

function getCalendarDayStamp(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

// Contract: each dated event is consumed exactly once, by the first installment whose local
// calendar due date is greater than or equal to the event's local calendar date.
function takeEventsDueBy<T extends { date: Date }>(
  events: T[],
  appliedEvents: Set<T>,
  installmentDate: Date,
): T[] {
  const dueEvents = events.filter(
    (event) =>
      !appliedEvents.has(event) &&
      getCalendarDayStamp(event.date) <= getCalendarDayStamp(installmentDate),
  );
  for (const event of dueEvents) {
    appliedEvents.add(event);
  }
  return dueEvents;
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
  const discountExponent = -termMonths * Math.log1p(monthlyRate);
  const denominator = -Math.expm1(discountExponent);
  return (principal * monthlyRate) / denominator;
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
  const normalizedTerm = scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term;
  // Validation rejects invalid/oversized terms; this cap only keeps eager UI callers bounded.
  const termMonths =
    Number.isFinite(normalizedTerm) && normalizedTerm > 0 && Number.isInteger(normalizedTerm)
      ? Math.min(normalizedTerm, MAX_TERM_MONTHS)
      : 0;

  const schedule: ScheduleRow[] = [];
  const fgtsDownPayment = getFgtsDownPayment(scenario);
  let balanceCents = Math.max(
    toCents(getFinancedPrincipal(scenario)) - toCents(fgtsDownPayment),
    0,
  );
  let currentDate = getFirstDueDate(scenario.startDate, scenario.dueDay);
  const prepayments = scenario.prepayments ?? [];
  const fgtsEvents = scenario.fgtsEvents ?? [];
  const sortedPrepayments = [...prepayments].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedFgts = [...fgtsEvents].sort((a, b) => a.date.getTime() - b.date.getTime());
  const appliedPrepayments = new Set<PrepaymentEvent>();
  const appliedFgtsAmortizations = new Set<FgtsEvent>();
  const appliedFgtsInstallments = new Set<FgtsEvent>();
  const monthlyCorrectionRate = getMonthlyCorrectionRate(scenario);

  // Row 0 (spreadsheet parity)
  schedule.push({
    installmentNumber: 0,
    date: new Date(scenario.startDate),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: fromCents(balanceCents),
  });

  const getPrepaymentsForInstallment = (installmentDate: Date): MonthlyAmortization[] => {
    return takeEventsDueBy(sortedPrepayments, appliedPrepayments, installmentDate).map(
      (prepayment) => ({
        ...prepayment,
        source: 'prepayment',
      }),
    );
  };
  const getAllAmortizationsForInstallment = (installmentDate: Date): MonthlyAmortization[] => {
    const base = getPrepaymentsForInstallment(installmentDate);
    const pendingFgtsAmortizations = sortedFgts.filter((event) => event.usage === 'amortization');
    const fgtsAmortizations = takeEventsDueBy(
      pendingFgtsAmortizations,
      appliedFgtsAmortizations,
      installmentDate,
    ).map((event) => ({
      id: event.id,
      date: event.date,
      amount: event.amount,
      type: 'fixed_amount' as const,
      strategy: event.strategy ?? 'reduce_term',
      description: event.description ?? 'FGTS',
      source: 'fgts' as const,
    }));
    return [...base, ...fgtsAmortizations];
  };
  const getFgtsInstallmentForInstallment = (installmentDate: Date): number => {
    const pendingFgtsInstallments = sortedFgts.filter((event) => event.usage === 'installment');
    return takeEventsDueBy(
      pendingFgtsInstallments,
      appliedFgtsInstallments,
      installmentDate,
    ).reduce((total, event) => total + event.amount, 0);
  };

  if (scenario.system === 'PRICE') {
    let fixedPaymentCents = toCents(
      calculatePricePayment(fromCents(balanceCents), monthlyRate, termMonths),
    );
    for (let i = 1; i <= termMonths; i++) {
      const corrected = applyBalanceCorrection(balanceCents, monthlyCorrectionRate);
      balanceCents = corrected.balanceCents;
      const indexCorrection =
        corrected.indexCorrectionCents === undefined
          ? undefined
          : fromCents(corrected.indexCorrectionCents);
      if (monthlyCorrectionRate !== null) {
        fixedPaymentCents = toCents(
          calculatePricePayment(fromCents(balanceCents), monthlyRate, termMonths - i + 1),
        );
      }

      const interestCents = Math.round(balanceCents * monthlyRate);
      let amortizationCents = Math.max(fixedPaymentCents - interestCents, 0);
      if (i === termMonths || amortizationCents >= balanceCents) {
        amortizationCents = balanceCents;
      }
      let paymentCents = interestCents + amortizationCents;
      const { insurance, adminFee, extraCosts } = getMonthlyExtraCosts(
        fromCents(balanceCents),
        scenario,
      );

      const installmentDate = new Date(currentDate);
      setDayClamped(installmentDate, scenario.dueDay);

      const prepaymentsForMonth = getAllAmortizationsForInstallment(installmentDate);
      const appliedAmortizations = applyMonthlyAmortizations(
        prepaymentsForMonth,
        balanceCents,
        amortizationCents,
      );
      const scheduledAmortizationCents = amortizationCents;
      amortizationCents += appliedAmortizations.totalCents;
      paymentCents += appliedAmortizations.totalCents;

      const remaining = termMonths - i;
      if (appliedAmortizations.reducePaymentCents > 0 && remaining > 0) {
        fixedPaymentCents = toCents(
          calculatePricePayment(
            fromCents(
              balanceCents - scheduledAmortizationCents - appliedAmortizations.reducePaymentCents,
            ),
            monthlyRate,
            remaining,
          ),
        );
      }

      balanceCents -= amortizationCents;
      const isPaidOff = balanceCents === 0;

      const fgtsSubsidyCents = Math.min(
        toCents(getFgtsInstallmentForInstallment(installmentDate)),
        paymentCents,
      );
      const netPaymentCents = paymentCents - fgtsSubsidyCents;

      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: fromCents(paymentCents),
        interest: fromCents(interestCents),
        amortization: fromCents(amortizationCents),
        balance: fromCents(balanceCents),
        prepaymentAmount:
          appliedAmortizations.totalCents > 0
            ? fromCents(appliedAmortizations.totalCents)
            : undefined,
        prepaymentDescription: appliedAmortizations.description,
        insurance: insurance > 0 ? roundCents(insurance) : undefined,
        adminFee: adminFee > 0 ? roundCents(adminFee) : undefined,
        extraCosts: extraCosts > 0 ? roundCents(extraCosts) : undefined,
        totalCost: roundCents(fromCents(paymentCents) + extraCosts),
        fgtsAmortization:
          appliedAmortizations.fgtsCents > 0
            ? fromCents(appliedAmortizations.fgtsCents)
            : undefined,
        fgtsSubsidy: fgtsSubsidyCents > 0 ? fromCents(fgtsSubsidyCents) : undefined,
        netPayment: fromCents(netPaymentCents),
        indexCorrection,
      });

      if (isPaidOff) {
        break;
      }

      currentDate = addMonths(currentDate, 1);
    }
  } else {
    let fixedAmortizationCents = toCents(
      calculateSacAmortization(fromCents(balanceCents), termMonths),
    );
    for (let i = 1; i <= termMonths; i++) {
      const corrected = applyBalanceCorrection(balanceCents, monthlyCorrectionRate);
      balanceCents = corrected.balanceCents;
      const indexCorrection =
        corrected.indexCorrectionCents === undefined
          ? undefined
          : fromCents(corrected.indexCorrectionCents);
      if (monthlyCorrectionRate !== null) {
        fixedAmortizationCents = toCents(
          calculateSacAmortization(fromCents(balanceCents), termMonths - i + 1),
        );
      }

      const interestCents = Math.round(balanceCents * monthlyRate);
      let amortizationCents = Math.min(fixedAmortizationCents, balanceCents);
      if (i === termMonths) {
        amortizationCents = balanceCents;
      }
      let paymentCents = interestCents + amortizationCents;
      const { insurance, adminFee, extraCosts } = getMonthlyExtraCosts(
        fromCents(balanceCents),
        scenario,
      );

      const installmentDate = new Date(currentDate);
      setDayClamped(installmentDate, scenario.dueDay);

      const prepaymentsForMonth = getAllAmortizationsForInstallment(installmentDate);
      const appliedAmortizations = applyMonthlyAmortizations(
        prepaymentsForMonth,
        balanceCents,
        amortizationCents,
      );
      const scheduledAmortizationCents = amortizationCents;
      amortizationCents += appliedAmortizations.totalCents;
      paymentCents += appliedAmortizations.totalCents;

      const remaining = termMonths - i;
      if (appliedAmortizations.reducePaymentCents > 0 && remaining > 0) {
        fixedAmortizationCents = toCents(
          calculateSacAmortization(
            fromCents(
              balanceCents - scheduledAmortizationCents - appliedAmortizations.reducePaymentCents,
            ),
            remaining,
          ),
        );
      }

      balanceCents -= amortizationCents;
      const isPaidOff = balanceCents === 0;

      const fgtsSubsidyCents = Math.min(
        toCents(getFgtsInstallmentForInstallment(installmentDate)),
        paymentCents,
      );
      const netPaymentCents = paymentCents - fgtsSubsidyCents;

      schedule.push({
        installmentNumber: i,
        date: installmentDate,
        payment: fromCents(paymentCents),
        interest: fromCents(interestCents),
        amortization: fromCents(amortizationCents),
        balance: fromCents(balanceCents),
        prepaymentAmount:
          appliedAmortizations.totalCents > 0
            ? fromCents(appliedAmortizations.totalCents)
            : undefined,
        prepaymentDescription: appliedAmortizations.description,
        insurance: insurance > 0 ? roundCents(insurance) : undefined,
        adminFee: adminFee > 0 ? roundCents(adminFee) : undefined,
        extraCosts: extraCosts > 0 ? roundCents(extraCosts) : undefined,
        totalCost: roundCents(fromCents(paymentCents) + extraCosts),
        fgtsAmortization:
          appliedAmortizations.fgtsCents > 0
            ? fromCents(appliedAmortizations.fgtsCents)
            : undefined,
        fgtsSubsidy: fgtsSubsidyCents > 0 ? fromCents(fgtsSubsidyCents) : undefined,
        netPayment: fromCents(netPaymentCents),
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

function hasMixedSameInstallmentAmortizationStrategies(
  scenario: Scenario,
  schedule: ScheduleRow[],
): boolean {
  const installments = schedule.filter((row) => row.installmentNumber > 0);
  const strategiesByInstallment = new Map<number, Set<PrepaymentEvent['strategy']>>();
  const addStrategy = (date: Date, strategy: PrepaymentEvent['strategy']) => {
    const applicationRow = installments.find(
      (row) => getCalendarDayStamp(row.date) >= getCalendarDayStamp(date),
    );
    if (!applicationRow) return;

    const strategies = strategiesByInstallment.get(applicationRow.installmentNumber) ?? new Set();
    strategies.add(strategy);
    strategiesByInstallment.set(applicationRow.installmentNumber, strategies);
  };

  for (const prepayment of scenario.prepayments ?? []) {
    addStrategy(prepayment.date, prepayment.strategy);
  }
  for (const fgtsEvent of scenario.fgtsEvents ?? []) {
    if (fgtsEvent.usage === 'amortization') {
      addStrategy(fgtsEvent.date, fgtsEvent.strategy ?? 'reduce_term');
    }
  }

  return [...strategiesByInstallment.values()].some((strategies) => strategies.size > 1);
}

export function validateScenario(
  scenario: Scenario,
  existingSchedule?: ScheduleRow[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prepayments = scenario.prepayments ?? [];
  const fgtsEvents = scenario.fgtsEvents ?? [];

  const numericValues = [
    scenario.principal,
    scenario.rate,
    scenario.term,
    scenario.dueDay,
    scenario.propertyValue,
    scenario.downPayment,
    scenario.iofRate,
    scenario.insuranceRate,
    scenario.adminFeeRate,
    scenario.openingFee,
    scenario.itbiRate,
    scenario.registryFee,
    scenario.indexRate,
    ...prepayments.map((event) => event.amount),
    ...fgtsEvents.map((event) => event.amount),
  ].filter((value): value is number => value !== undefined);
  const hasNonFiniteNumber = numericValues.some((value) => !Number.isFinite(value));
  if (hasNonFiniteNumber) {
    errors.push('Todos os valores numéricos devem ser finitos.');
  }

  const dates = [
    scenario.startDate,
    ...prepayments.map((event) => event.date),
    ...fgtsEvents.map((event) => event.date),
  ];
  const hasInvalidDate = dates.some((date) => !Number.isFinite(date.getTime()));
  if (hasInvalidDate) {
    errors.push('Todas as datas devem ser válidas.');
  }

  if (
    prepayments.some((event) => Number.isFinite(event.amount) && event.amount < 0) ||
    fgtsEvents.some((event) => Number.isFinite(event.amount) && event.amount < 0)
  ) {
    errors.push('Valores de amortização e FGTS não podem ser negativos.');
  }
  if (
    prepayments.some(
      (event) =>
        event.type === 'percentage' &&
        Number.isFinite(event.amount) &&
        (event.amount <= 0 || event.amount > 100),
    )
  ) {
    errors.push('Percentual de amortização deve ser maior que 0% e até 100%.');
  }

  const optionalNonNegativeValues = [
    scenario.propertyValue,
    scenario.downPayment,
    scenario.iofRate,
    scenario.insuranceRate,
    scenario.adminFeeRate,
    scenario.openingFee,
    scenario.itbiRate,
    scenario.registryFee,
  ].filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (optionalNonNegativeValues.some((value) => value < 0)) {
    errors.push('Valores monetários e taxas de custos não podem ser negativos.');
  }

  const financedPrincipal = getFinancedPrincipal(scenario);
  if (Number.isFinite(financedPrincipal) && financedPrincipal <= 0) {
    errors.push('Valor do financiamento deve ser maior que zero.');
  }
  if (Number.isFinite(scenario.rate) && scenario.rate < 0) {
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
  const normalizedTerm = scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term;
  const isTermValid =
    Number.isFinite(normalizedTerm) &&
    normalizedTerm > 0 &&
    Number.isInteger(normalizedTerm) &&
    normalizedTerm <= MAX_TERM_MONTHS;
  if (!isTermValid) {
    errors.push('Prazo deve ser um número inteiro entre 1 e 600 meses.');
  }
  if (!Number.isInteger(scenario.dueDay) || scenario.dueDay < 1 || scenario.dueDay > 31) {
    errors.push('Dia de vencimento deve ser um inteiro entre 1 e 31.');
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

  if (Number.isFinite(scenario.rate) && scenario.rateType === 'monthly' && scenario.rate > 10) {
    warnings.push('Taxa mensal parece alta. Verifique se não é anual.');
  }
  if (Number.isFinite(scenario.rate) && scenario.rateType === 'annual' && scenario.rate < 5) {
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
  const fgtsDownPayment = fgtsEvents
    .filter((event) => event.usage === 'down_payment')
    .reduce((total, event) => total + event.amount, 0);
  if (
    Number.isFinite(fgtsDownPayment) &&
    Number.isFinite(financedPrincipal) &&
    fgtsDownPayment >= financedPrincipal
  ) {
    errors.push('Entrada com FGTS deve ser menor que o valor financiado.');
  }

  const scheduledEvents = [
    ...prepayments.map((event) => ({ date: event.date })),
    ...fgtsEvents
      .filter((event) => event.usage !== 'down_payment')
      .map((event) => ({ date: event.date })),
  ];
  if (
    scheduledEvents.length > 0 &&
    !hasInvalidDate &&
    isTermValid &&
    Number.isInteger(scenario.dueDay) &&
    scenario.dueDay >= 1 &&
    scenario.dueDay <= 31
  ) {
    const schedule = existingSchedule ?? generateAmortizationSchedule(scenario);
    const installments = schedule.filter((row) => row.installmentNumber > 0);
    const finalDueDate = installments.at(-1)?.date;
    if (hasMixedSameInstallmentAmortizationStrategies(scenario, schedule)) {
      warnings.push(MIXED_PREPAYMENT_STRATEGIES_WARNING);
    }

    const warnedMonths = new Set<string>();
    for (const event of scheduledEvents) {
      if (finalDueDate && getCalendarDayStamp(event.date) <= getCalendarDayStamp(finalDueDate)) {
        continue;
      }
      const monthYear = `${String(event.date.getMonth() + 1).padStart(2, '0')}/${event.date.getFullYear()}`;
      if (warnedMonths.has(monthYear)) continue;
      warnedMonths.add(monthYear);
      warnings.push(`Amortização em ${monthYear} ${OUT_OF_TERM_EVENT_WARNING_FRAGMENT}`);
    }
  }

  return { errors, warnings };
}
