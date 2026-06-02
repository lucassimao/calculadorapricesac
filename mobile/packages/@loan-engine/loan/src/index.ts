export type LoanSystem = 'SAC' | 'PRICE';

export type RateType = 'monthly' | 'annual';

export type TimeUnit = 'months' | 'years';

export type PrepaymentStrategy = 'reduce_term' | 'reduce_payment';

export type PrepaymentType = 'fixed_amount' | 'percentage';

export type FgtsUsage = 'down_payment' | 'amortization' | 'installment';

export type CorrectionIndexType = 'TR' | 'IPCA';

export interface Scenario {
  id: string;
  name: string;
  system: LoanSystem;
  loanMode?: 'standard' | 'property';
  principal: number;
  rate: number;
  rateType: RateType;
  term: number;
  termUnit: TimeUnit;
  startDate: Date;
  dueDay: number;
  prepayments?: PrepaymentEvent[];
  fgtsEvents?: FgtsEvent[];
  propertyValue?: number;
  downPayment?: number;
  includeIOF?: boolean;
  iofRate?: number;
  includeInsurance?: boolean;
  insuranceRate?: number;
  includeAdminFee?: boolean;
  adminFeeRate?: number;
  includeOpeningFee?: boolean;
  openingFee?: number;
  itbiRate?: number;
  registryFee?: number;
  indexType?: CorrectionIndexType;
  indexRate?: number;
}

export interface PrepaymentEvent {
  id: string;
  date: Date;
  amount: number;
  type: PrepaymentType;
  strategy: PrepaymentStrategy;
  description?: string;
}

export interface FgtsEvent {
  id: string;
  date: Date;
  amount: number;
  usage: FgtsUsage;
  strategy?: PrepaymentStrategy;
  description?: string;
}

export interface ScheduleRow {
  installmentNumber: number;
  date: Date;
  payment: number;
  interest: number;
  amortization: number;
  balance: number;
  prepaymentAmount?: number;
  prepaymentDescription?: string;
  insurance?: number;
  adminFee?: number;
  extraCosts?: number;
  totalCost?: number;
  fgtsAmortization?: number;
  fgtsSubsidy?: number;
  netPayment?: number;
  indexCorrection?: number;
}

export interface LoanSummary {
  totalPayment: number;
  totalInterest: number;
  firstPayment: number;
  lastPayment: number;
  averagePayment: number;
  interestPercentage: number;
  totalUpfrontCosts: number;
  totalMonthlyCosts: number;
  totalPaymentWithCosts: number;
  cetAnnualRate: number;
  financedPrincipal: number;
  propertyTotalCost: number;
  totalFgtsUsed: number;
  totalPaymentNet: number;
  totalIndexCorrection: number;
}
