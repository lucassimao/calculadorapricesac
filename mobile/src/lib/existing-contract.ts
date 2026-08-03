import type {
  CorrectionIndexType,
  EntryMode,
  LoanSystem,
  RateType,
  Scenario,
} from '@loan-engine/loan';

export interface ExistingContractInput {
  id: string;
  name: string;
  system: LoanSystem;
  currentBalance: number;
  rate: number;
  rateType: RateType;
  remainingInstallments: number;
  nextDueDate: Date;
  propertyValue?: number;
  insuranceRate?: number;
  mipRate?: number;
  dfiRate?: number;
  borrowerAge?: number;
  adminFeeRate?: number;
  adminFee?: number;
  indexType?: CorrectionIndexType;
  indexRate?: number;
}

export function getExistingContractBalanceDate(date: Date): Date {
  const previous = new Date(date);
  const dueDay = inferExistingContractDueDay(date);
  previous.setDate(1);
  previous.setMonth(previous.getMonth() - 1);
  const lastDay = new Date(previous.getFullYear(), previous.getMonth() + 1, 0).getDate();
  previous.setDate(Math.min(dueDay, lastDay));
  return previous;
}

export function inferExistingContractDueDay(nextDueDate: Date): number {
  const lastDay = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
  const isFebruaryMonthEnd = nextDueDate.getMonth() === 1 && nextDueDate.getDate() === lastDay;
  return nextDueDate.getDate() === 31 || isFebruaryMonthEnd ? 31 : nextDueDate.getDate();
}

export function createExistingContractScenario(input: ExistingContractInput): Scenario {
  const mipRate = input.mipRate ?? input.insuranceRate ?? 0;
  const dfiRate = input.dfiRate ?? 0;
  const adminFeeRate = input.adminFeeRate ?? 0;
  const adminFee = input.adminFee;
  const nextDueDate = new Date(input.nextDueDate);

  return {
    id: input.id,
    name: input.name,
    system: input.system,
    loanMode: 'standard',
    principal: input.currentBalance,
    rate: input.rate,
    rateType: input.rateType,
    term: input.remainingInstallments,
    termUnit: 'months',
    startDate: getExistingContractBalanceDate(nextDueDate),
    dueDay: inferExistingContractDueDay(nextDueDate),
    entryMode: 'existing_contract',
    nextDueDate,
    propertyValue: input.propertyValue,
    prepayments: [],
    fgtsEvents: [],
    includeInsurance: mipRate > 0 || dfiRate > 0,
    mipRate,
    dfiRate,
    borrowerAge: input.borrowerAge,
    includeAdminFee: (adminFee ?? 0) > 0 || adminFeeRate > 0,
    adminFee,
    adminFeeRate,
    includeIOF: false,
    iofRate: 0,
    includeOpeningFee: false,
    openingFee: 0,
    indexType: input.indexType,
    indexRate: input.indexRate,
  };
}

export function getScenarioEntryMode(scenario: Pick<Scenario, 'entryMode'>): EntryMode {
  return scenario.entryMode ?? 'new_loan';
}
