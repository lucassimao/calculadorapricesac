import type { LoanSummary, PrepaymentEvent, Scenario, ScheduleRow } from '../types/loan';

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
  let balance = getFinancedPrincipal(scenario);
  let currentDate = new Date(scenario.startDate);
  const prepayments = scenario.prepayments ?? [];
  const sortedPrepayments = [...prepayments].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Row 0 (spreadsheet parity)
  schedule.push({
    installmentNumber: 0,
    date: new Date(currentDate),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: roundCents(balance),
  });

  const getPrepaymentsForMonth = (installmentDate: Date): PrepaymentEvent[] => {
    const month = installmentDate.getMonth();
    const year = installmentDate.getFullYear();
    return sortedPrepayments.filter((p) => p.date.getMonth() === month && p.date.getFullYear() === year);
  };

  if (scenario.system === 'PRICE') {
    let fixedPayment = calculatePricePayment(balance, monthlyRate, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * monthlyRate;
      let amortization = fixedPayment - interest;
      let payment = fixedPayment;
      const { insurance, adminFee, extraCosts } = getMonthlyExtraCosts(balance, scenario);

      const installmentDate = new Date(currentDate);
      installmentDate.setDate(scenario.dueDay);

      const prepaymentsForMonth = getPrepaymentsForMonth(installmentDate);
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
      });

      if (isPaidOff) {
        break;
      }

      currentDate = addMonths(currentDate, 1);
    }
  } else {
    let fixedAmortization = calculateSacAmortization(balance, termMonths);
    for (let i = 1; i <= termMonths; i++) {
      const interest = balance * monthlyRate;
      let amortization = fixedAmortization;
      let payment = fixedAmortization + interest;
      const { insurance, adminFee, extraCosts } = getMonthlyExtraCosts(balance, scenario);

      const installmentDate = new Date(currentDate);
      installmentDate.setDate(scenario.dueDay);

      const prepaymentsForMonth = getPrepaymentsForMonth(installmentDate);
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
    }),
    { payment: 0, interest: 0, extraCosts: 0 }
  );

  const payments = schedule.map((row) => row.payment).filter((p) => p > 0);
  const firstPayment = payments[0] || 0;
  const lastPayment = payments[payments.length - 1] || 0;
  const averagePayment = payments.length > 0 ? totals.payment / payments.length : 0;
  const interestPercentage = totals.payment > 0 ? (totals.interest / totals.payment) * 100 : 0;

  const financedPrincipal = getFinancedPrincipal(scenario);
  const upfrontCosts = getUpfrontCosts(scenario, financedPrincipal);
  const totalUpfrontCosts = upfrontCosts.upfront;
  const totalMonthlyCosts = totals.extraCosts;
  const totalPaymentWithCosts = totals.payment + totalUpfrontCosts + totalMonthlyCosts;
  const propertyValue = scenario.propertyValue ?? 0;
  const propertyTotalCost =
    scenario.loanMode === 'property' && propertyValue > 0
      ? propertyValue + upfrontCosts.itbi + upfrontCosts.registryFee
      : 0;

  const installments = schedule.filter((row) => row.installmentNumber > 0);
  const netDisbursement = financedPrincipal - totalUpfrontCosts;
  let cetAnnualRate = 0;
  if (netDisbursement > 0 && installments.length > 0) {
    const cashFlows = installments.map((row) => row.payment + (row.extraCosts ?? 0));
    const npv = (rate: number) => {
      return (
        netDisbursement -
        cashFlows.reduce((sum, value, index) => sum + value / Math.pow(1 + rate, index + 1), 0)
      );
    };
    if (npv(0) < 0) {
      let low = 0;
      let high = 1;
      while (npv(high) < 0 && high < 100) {
        high *= 2;
      }
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        if (npv(mid) > 0) {
          high = mid;
        } else {
          low = mid;
        }
      }
      const monthlyRate = (low + high) / 2;
      cetAnnualRate = Math.pow(1 + monthlyRate, 12) - 1;
    }
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
    cetAnnualRate: roundCents(cetAnnualRate * 100),
    financedPrincipal: roundCents(financedPrincipal),
    propertyTotalCost: roundCents(propertyTotalCost),
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
  if (scenario.rate <= 0) {
    errors.push('Taxa de juros deve ser maior que zero.');
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
