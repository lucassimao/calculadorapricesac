import { generateAmortizationSchedule } from '@loan-engine/calculations';
import type { RateType, Scenario, ScheduleRow } from '@loan-engine/loan';
import { parseCurrencyInput, parseNumberInput } from './utils';

export interface PortabilityProposal {
  rate: number;
  rateType: RateType;
  term: number;
  costs: number;
}

export interface PortabilityProposalInputs {
  rateText: string;
  rateType: RateType;
  termText: string;
  costsText: string;
}

export interface NominalCashFlowComparison {
  currentTotalCost: number;
  newTotalCost: number;
  totalSavings: number;
  monthlyPaymentDelta: number;
  currentFirstPayment: number;
  newFirstPayment: number;
  breakEvenMonth: number | null;
  recommendation: string;
}

export interface PortabilityComparison extends NominalCashFlowComparison {
  currentMonthlyPayments: number[];
  newMonthlyPayments: number[];
  proposalScenario: Scenario;
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function buildRecommendation(totalSavings: number, breakEvenMonth: number | null) {
  if (totalSavings > 0 && breakEvenMonth !== null) {
    return `A portabilidade economiza ${formatCurrency(totalSavings)} no total e recupera os custos no ${breakEvenMonth}º mês.`;
  }
  if (totalSavings > 0) {
    return `A portabilidade economiza ${formatCurrency(totalSavings)} no total, mas não atinge o break-even no prazo comparado.`;
  }
  if (totalSavings < 0) {
    return `Pelos valores informados, manter o contrato atual custa ${formatCurrency(Math.abs(totalSavings))} a menos no total.`;
  }
  return 'Pelos valores informados, as duas opções têm o mesmo custo total nominal.';
}

export function parsePortabilityProposalInputs({
  rateText,
  rateType,
  termText,
  costsText,
}: PortabilityProposalInputs): PortabilityProposal {
  const rate = parseNumberInput(rateText);
  const term = Number.parseInt(termText, 10);
  const costs = parseCurrencyInput(costsText);

  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 100 ||
    !/^\d+$/.test(termText.trim()) ||
    term <= 0 ||
    term > 600 ||
    !Number.isFinite(costs) ||
    costs < 0
  ) {
    throw new Error('Proposta de portabilidade inválida');
  }

  return { rate, rateType, term, costs };
}

export function compareNominalCashFlows(
  currentMonthlyPayments: number[],
  newMonthlyPayments: number[],
  portabilityCosts: number,
): NominalCashFlowComparison {
  if (!Number.isFinite(portabilityCosts) || portabilityCosts < 0) {
    throw new Error('Custos da portabilidade inválidos');
  }
  if (
    [...currentMonthlyPayments, ...newMonthlyPayments].some(
      (payment) => !Number.isFinite(payment) || payment < 0,
    )
  ) {
    throw new Error('Fluxo mensal inválido');
  }

  const currentCents = currentMonthlyPayments.map(toCents);
  const newCents = newMonthlyPayments.map(toCents);
  const costsCents = toCents(portabilityCosts);
  const currentTotalCents = currentCents.reduce((total, payment) => total + payment, 0);
  const newPaymentsTotalCents = newCents.reduce((total, payment) => total + payment, 0);
  const newTotalCents = newPaymentsTotalCents + costsCents;
  const comparisonMonths = Math.max(currentCents.length, newCents.length);
  let cumulativeSavingsCents = 0;
  let breakEvenMonth: number | null = null;

  for (let month = 0; month < comparisonMonths && breakEvenMonth === null; month += 1) {
    cumulativeSavingsCents += (currentCents[month] ?? 0) - (newCents[month] ?? 0);
    if (cumulativeSavingsCents >= costsCents) {
      breakEvenMonth = month + 1;
    }
  }

  const currentTotalCost = fromCents(currentTotalCents);
  const newTotalCost = fromCents(newTotalCents);
  const totalSavings = fromCents(currentTotalCents - newTotalCents);
  const currentFirstPayment = fromCents(currentCents[0] ?? 0);
  const newFirstPayment = fromCents(newCents[0] ?? 0);
  const monthlyPaymentDelta = fromCents((newCents[0] ?? 0) - (currentCents[0] ?? 0));

  return {
    currentTotalCost,
    newTotalCost,
    totalSavings,
    monthlyPaymentDelta,
    currentFirstPayment,
    newFirstPayment,
    breakEvenMonth,
    recommendation: buildRecommendation(totalSavings, breakEvenMonth),
  };
}

export function createPortabilityScenario(
  currentScenario: Scenario,
  proposal: PortabilityProposal,
): Scenario {
  return {
    ...currentScenario,
    id: `${currentScenario.id}-portability`,
    name: 'Proposta de portabilidade',
    loanMode: 'standard',
    principal: currentScenario.principal,
    rate: proposal.rate,
    rateType: proposal.rateType,
    term: proposal.term,
    termUnit: 'months',
    startDate: new Date(currentScenario.startDate),
    entryMode: 'existing_contract',
    nextDueDate: currentScenario.nextDueDate ? new Date(currentScenario.nextDueDate) : undefined,
    prepayments: [],
    fgtsEvents: [],
    downPayment: undefined,
    includeIOF: false,
    iofRate: 0,
    includeOpeningFee: false,
    openingFee: 0,
    itbiRate: 0,
    registryFee: 0,
  };
}

function getMonthlyPayments(schedule: ScheduleRow[]) {
  return schedule
    .filter((row) => row.installmentNumber > 0)
    .map((row) => (row.netPayment ?? row.payment) + (row.extraCosts ?? 0));
}

export function calculatePortabilityComparison(
  currentScenario: Scenario,
  proposal: PortabilityProposal,
): PortabilityComparison {
  const proposalScenario = createPortabilityScenario(currentScenario, proposal);
  const contractualCurrentScenario: Scenario = {
    ...currentScenario,
    prepayments: [],
    fgtsEvents: [],
  };
  const currentMonthlyPayments = getMonthlyPayments(
    generateAmortizationSchedule(contractualCurrentScenario),
  );
  const newMonthlyPayments = getMonthlyPayments(generateAmortizationSchedule(proposalScenario));
  const comparison = compareNominalCashFlows(
    currentMonthlyPayments,
    newMonthlyPayments,
    proposal.costs,
  );

  return {
    ...comparison,
    currentMonthlyPayments,
    newMonthlyPayments,
    proposalScenario,
  };
}
