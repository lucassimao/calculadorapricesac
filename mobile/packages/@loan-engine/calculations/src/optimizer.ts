import type {
  LoanSummary,
  PrepaymentEvent,
  PrepaymentStrategy,
  Scenario,
  ScheduleRow,
} from '@loan-engine/loan';
import { calculateLoanSummary, generateAmortizationSchedule } from './index';

export type OptimizerGoal = 'payoff_by_date' | 'minimize_interest' | 'payment_cap';

export type OptimizerPlanRequest = {
  scenario: Scenario;
  seriesId: string;
  startDate: Date;
  amount: number;
  recurrence: 'none' | 'monthly';
  strategy: PrepaymentStrategy;
  maxOccurrences?: number;
};

export type OptimizerPlanBuilder = (request: OptimizerPlanRequest) => PrepaymentEvent[];

type OptimizerBaseInput = {
  scenario: Scenario;
  buildPlan: OptimizerPlanBuilder;
  seriesIdPrefix?: string;
};

export type OptimizePrepaymentsInput =
  | (OptimizerBaseInput & {
      goal: 'payoff_by_date';
      targetDate: Date;
    })
  | (OptimizerBaseInput & {
      goal: 'minimize_interest';
      oneOffAmount?: number;
      recurringAmount?: number;
    })
  | (OptimizerBaseInput & {
      goal: 'payment_cap';
      targetPayment: number;
    });

export type OptimizerSuccess = {
  status: 'success';
  goal: OptimizerGoal;
  prepayments: PrepaymentEvent[];
  baseSummary: LoanSummary;
  optimizedSummary: LoanSummary;
  payoffDate: Date;
  interestSaved: number;
  iterations: number;
  horizonMonths: number;
  explanation: string;
  oneOffAmount?: number;
  recurringAmount?: number;
  targetPayment?: number;
  interestTradeoff?: number;
};

export type OptimizerUnreachable = {
  status: 'unreachable';
  goal: OptimizerGoal;
  prepayments: [];
  message: string;
  iterations: number;
};

export type OptimizerResult = OptimizerSuccess | OptimizerUnreachable;

type ScenarioRun = {
  schedule: ScheduleRow[];
  summary: LoanSummary;
  payoffDate: Date;
};

const MAX_ITERATIONS = 40;

function calendarStamp(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

function runScenario(
  scenario: Scenario,
  generatedPrepayments: PrepaymentEvent[],
): ScenarioRun | null {
  const plannedScenario: Scenario = {
    ...scenario,
    prepayments: [...(scenario.prepayments ?? []), ...generatedPrepayments],
  };
  const schedule = generateAmortizationSchedule(plannedScenario);
  const payoffDate = schedule.filter((row) => row.installmentNumber > 0).at(-1)?.date;
  if (!payoffDate) return null;
  return {
    schedule,
    summary: calculateLoanSummary(schedule, plannedScenario),
    payoffDate,
  };
}

function unreachable(goal: OptimizerGoal, message: string, iterations = 0): OptimizerUnreachable {
  return { status: 'unreachable', goal, prepayments: [], message, iterations };
}

function trimPlanToPayoff(prepayments: PrepaymentEvent[], payoffDate: Date) {
  const payoffStamp = calendarStamp(payoffDate);
  return prepayments.filter((event) => calendarStamp(event.date) <= payoffStamp);
}

function buildSuccess({
  goal,
  baseRun,
  optimizedRun,
  prepayments,
  iterations,
  explanation,
  ...amounts
}: {
  goal: OptimizerGoal;
  baseRun: ScenarioRun;
  optimizedRun: ScenarioRun;
  prepayments: PrepaymentEvent[];
  iterations: number;
  explanation: string;
  oneOffAmount?: number;
  recurringAmount?: number;
  targetPayment?: number;
  interestTradeoff?: number;
}): OptimizerSuccess {
  const installments = optimizedRun.schedule.filter((row) => row.installmentNumber > 0);
  return {
    status: 'success',
    goal,
    prepayments: trimPlanToPayoff(prepayments, optimizedRun.payoffDate),
    baseSummary: baseRun.summary,
    optimizedSummary: optimizedRun.summary,
    payoffDate: optimizedRun.payoffDate,
    interestSaved: roundCents(baseRun.summary.totalInterest - optimizedRun.summary.totalInterest),
    iterations,
    horizonMonths: installments.length,
    explanation,
    ...amounts,
  };
}

function isFiniteNonNegative(value: number | undefined) {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function optimizePayoffByDate(
  input: Extract<OptimizePrepaymentsInput, { goal: 'payoff_by_date' }>,
  baseRun: ScenarioRun,
): OptimizerResult {
  const targetStamp = calendarStamp(input.targetDate);
  if (Number.isNaN(input.targetDate.getTime())) {
    return unreachable(input.goal, 'Informe uma data de quitação válida.');
  }

  const installments = baseRun.schedule.filter((row) => row.installmentNumber > 0);
  const firstInstallment = installments[0];
  if (!firstInstallment || targetStamp < calendarStamp(firstInstallment.date)) {
    return unreachable(
      input.goal,
      'Não é possível quitar antes da primeira parcela. Escolha uma data posterior.',
    );
  }
  if (calendarStamp(baseRun.payoffDate) <= targetStamp) {
    return buildSuccess({
      goal: input.goal,
      baseRun,
      optimizedRun: baseRun,
      prepayments: [],
      iterations: 0,
      recurringAmount: 0,
      explanation: 'O contrato já termina até a data escolhida; não é preciso adicionar valor.',
    });
  }

  const maxOccurrences = installments.filter(
    (row) => calendarStamp(row.date) <= targetStamp,
  ).length;
  const highAmountCents = Math.max(Math.ceil(firstInstallment.balance * 100), 1);
  const createPlan = (amountCents: number) =>
    input.buildPlan({
      scenario: input.scenario,
      seriesId: `${input.seriesIdPrefix ?? 'optimizer'}-payoff-monthly`,
      startDate: firstInstallment.date,
      amount: amountCents / 100,
      recurrence: 'monthly',
      strategy: 'reduce_term',
      maxOccurrences,
    });
  const reachesTarget = (amountCents: number) => {
    const plan = createPlan(amountCents);
    const run = plan.length > 0 ? runScenario(input.scenario, plan) : null;
    return Boolean(run && calendarStamp(run.payoffDate) <= targetStamp);
  };

  if (!reachesTarget(highAmountCents)) {
    return unreachable(
      input.goal,
      'Não foi possível montar um plano para essa data com os limites do contrato.',
      1,
    );
  }

  let low = 1;
  let high = highAmountCents;
  let iterations = 1;
  while (low < high && iterations < MAX_ITERATIONS) {
    const middle = Math.floor((low + high) / 2);
    iterations += 1;
    if (reachesTarget(middle)) high = middle;
    else low = middle + 1;
  }

  const selectedAmountCents = low < high ? high : low;
  const prepayments = createPlan(selectedAmountCents);
  const optimizedRun = runScenario(input.scenario, prepayments);
  if (!optimizedRun || calendarStamp(optimizedRun.payoffDate) > targetStamp) {
    return unreachable(
      input.goal,
      'Não foi possível reproduzir a quitação prometida. Revise os dados do contrato.',
      iterations,
    );
  }
  return buildSuccess({
    goal: input.goal,
    baseRun,
    optimizedRun,
    prepayments,
    iterations,
    recurringAmount: selectedAmountCents / 100,
    explanation:
      'Este é o menor valor mensal, em centavos, que quita até a data escolhida usando redução de prazo.',
  });
}

function optimizeInterestWithBudget(
  input: Extract<OptimizePrepaymentsInput, { goal: 'minimize_interest' }>,
  baseRun: ScenarioRun,
): OptimizerResult {
  if (
    !isFiniteNonNegative(input.oneOffAmount) ||
    !isFiniteNonNegative(input.recurringAmount) ||
    (input.oneOffAmount ?? 0) + (input.recurringAmount ?? 0) <= 0
  ) {
    return unreachable(
      input.goal,
      'Informe um valor único e/ou mensal maior que zero para montar o plano.',
    );
  }
  const firstInstallment = baseRun.schedule.find((row) => row.installmentNumber > 0);
  if (!firstInstallment) {
    return unreachable(input.goal, 'O contrato não possui parcelas que possam ser amortizadas.');
  }

  const prepayments = [
    ...(input.oneOffAmount && input.oneOffAmount > 0
      ? input.buildPlan({
          scenario: input.scenario,
          seriesId: `${input.seriesIdPrefix ?? 'optimizer'}-budget-once`,
          startDate: firstInstallment.date,
          amount: input.oneOffAmount,
          recurrence: 'none' as const,
          strategy: 'reduce_term' as const,
        })
      : []),
    ...(input.recurringAmount && input.recurringAmount > 0
      ? input.buildPlan({
          scenario: input.scenario,
          seriesId: `${input.seriesIdPrefix ?? 'optimizer'}-budget-monthly`,
          startDate: firstInstallment.date,
          amount: input.recurringAmount,
          recurrence: 'monthly' as const,
          strategy: 'reduce_term' as const,
        })
      : []),
  ];
  const optimizedRun = prepayments.length > 0 ? runScenario(input.scenario, prepayments) : null;
  if (!optimizedRun) {
    return unreachable(
      input.goal,
      'Não foi possível aplicar esse orçamento às datas restantes do contrato.',
    );
  }

  return buildSuccess({
    goal: input.goal,
    baseRun,
    optimizedRun,
    prepayments,
    iterations: 0,
    oneOffAmount: input.oneOffAmount ?? 0,
    recurringAmount: input.recurringAmount ?? 0,
    explanation:
      'Para minimizar juros com o orçamento informado, amortize quanto antes e escolha reduzir prazo: o saldo fica menor por mais tempo e gera menos juros.',
  });
}

function regularPayment(row: ScheduleRow) {
  return (row.netPayment ?? row.payment) - (row.prepaymentAmount ?? 0) + (row.extraCosts ?? 0);
}

function maxPaymentAfterFirstInstallment(run: ScenarioRun): number | null {
  const laterInstallments = run.schedule.filter((row) => row.installmentNumber > 1);
  if (laterInstallments.length === 0) return null;
  return Math.max(...laterInstallments.map(regularPayment));
}

function optimizePaymentCap(
  input: Extract<OptimizePrepaymentsInput, { goal: 'payment_cap' }>,
  baseRun: ScenarioRun,
): OptimizerResult {
  if (!Number.isFinite(input.targetPayment) || input.targetPayment <= 0) {
    return unreachable(input.goal, 'Informe um teto de parcela maior que zero.');
  }
  const installments = baseRun.schedule.filter((row) => row.installmentNumber > 0);
  const firstInstallment = installments[0];
  const currentMaximum = maxPaymentAfterFirstInstallment(baseRun);
  if (!firstInstallment || currentMaximum === null) {
    return unreachable(input.goal, 'O contrato não possui parcelas futuras para reduzir.');
  }
  if (currentMaximum <= input.targetPayment + 0.005) {
    return buildSuccess({
      goal: input.goal,
      baseRun,
      optimizedRun: baseRun,
      prepayments: [],
      iterations: 0,
      oneOffAmount: 0,
      targetPayment: input.targetPayment,
      interestTradeoff: 0,
      explanation: 'As parcelas futuras já estão dentro do teto informado.',
    });
  }

  const highAmountCents = Math.floor(firstInstallment.balance * 100) - 1;
  if (highAmountCents < 1) {
    return unreachable(input.goal, 'Não há saldo suficiente para reduzir a parcela sem quitar.');
  }
  const createPlan = (amountCents: number, strategy: PrepaymentStrategy) =>
    input.buildPlan({
      scenario: input.scenario,
      seriesId: `${input.seriesIdPrefix ?? 'optimizer'}-cap-${strategy}`,
      startDate: firstInstallment.date,
      amount: amountCents / 100,
      recurrence: 'none',
      strategy,
    });
  const reachesCap = (amountCents: number) => {
    const plan = createPlan(amountCents, 'reduce_payment');
    const run = plan.length > 0 ? runScenario(input.scenario, plan) : null;
    const maximum = run ? maxPaymentAfterFirstInstallment(run) : null;
    return maximum !== null && maximum <= input.targetPayment + 0.005;
  };
  if (!reachesCap(highAmountCents)) {
    return unreachable(
      input.goal,
      'O teto não é alcançável sem quitar o contrato; seguros ou tarifas mensais podem superar o valor informado.',
      1,
    );
  }

  let low = 1;
  let high = highAmountCents;
  let iterations = 1;
  while (low < high && iterations < MAX_ITERATIONS) {
    const middle = Math.floor((low + high) / 2);
    iterations += 1;
    if (reachesCap(middle)) high = middle;
    else low = middle + 1;
  }

  const selectedAmountCents = low < high ? high : low;
  const prepayments = createPlan(selectedAmountCents, 'reduce_payment');
  const optimizedRun = runScenario(input.scenario, prepayments);
  const minimizeRun = runScenario(input.scenario, createPlan(selectedAmountCents, 'reduce_term'));
  if (!optimizedRun || !minimizeRun || !reachesCap(selectedAmountCents)) {
    return unreachable(
      input.goal,
      'Não foi possível reproduzir o teto prometido. Revise os dados do contrato.',
      iterations,
    );
  }

  return buildSuccess({
    goal: input.goal,
    baseRun,
    optimizedRun,
    prepayments,
    iterations,
    oneOffAmount: selectedAmountCents / 100,
    targetPayment: input.targetPayment,
    interestTradeoff: roundCents(
      optimizedRun.summary.totalInterest - minimizeRun.summary.totalInterest,
    ),
    explanation:
      'A amortização é feita na primeira parcela possível com redução de parcela. Isso alivia o fluxo mensal, mas cobra mais juros do que usar o mesmo valor para reduzir prazo.',
  });
}

export function optimizePrepayments(input: OptimizePrepaymentsInput): OptimizerResult {
  const baseRun = runScenario(input.scenario, []);
  if (!baseRun) {
    return unreachable(input.goal, 'O cenário não gerou parcelas válidas para otimização.');
  }
  if (input.goal === 'payoff_by_date') return optimizePayoffByDate(input, baseRun);
  if (input.goal === 'minimize_interest') return optimizeInterestWithBudget(input, baseRun);
  return optimizePaymentCap(input, baseRun);
}
