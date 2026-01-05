export type LoanSystem = 'SAC' | 'PRICE';

export type RateType = 'monthly' | 'annual';

export type TimeUnit = 'months' | 'years';

export type PrepaymentStrategy = 'reduce_term' | 'reduce_payment';

export type PrepaymentType = 'fixed_amount' | 'percentage' | 'available_monthly' | 'one_time';

export interface Scenario {
  id: string;
  name: string;
  system: LoanSystem;
  principal: number;
  rate: number;
  rateType: RateType;
  term: number;
  termUnit: TimeUnit;
  startDate: Date;
  dueDay: number;
  prepayments?: PrepaymentEvent[];
}

export interface PrepaymentEvent {
  id: string;
  date: Date;
  amount: number;
  type: PrepaymentType;
  strategy: PrepaymentStrategy;
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
}

export interface LoanSummary {
  totalPayment: number;
  totalInterest: number;
  firstPayment: number;
  lastPayment: number;
  averagePayment: number;
  interestPercentage: number;
}
