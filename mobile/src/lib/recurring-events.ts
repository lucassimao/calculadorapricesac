import type {
  FgtsEvent,
  FgtsUsage,
  PrepaymentEvent,
  PrepaymentStrategy,
  PrepaymentType,
} from '@loan-engine/loan';

export type Recurrence = 'none' | 'monthly' | 'yearly' | 'biennial';
export type RecurringPrepaymentEvent = PrepaymentEvent & { recurrence: Recurrence };
export type RecurringFgtsEvent = FgtsEvent & { recurrence: Recurrence };

export const FGTS_RULES_SOURCE =
  'https://www.fgts.gov.br/Paginas/subpaginas/amortizacao_liquidacao.aspx';
// Official FGTS guidance reviewed on 2026-08-02. Keep the source and UI date together.
export const FGTS_RULES_REVIEWED_LABEL = '02/08/2026';

const RECURRENCE_MONTHS: Record<Exclude<Recurrence, 'none'>, number> = {
  monthly: 1,
  yearly: 12,
  biennial: 24,
};

function addMonthsClamped(date: Date, months: number) {
  const target = new Date(date);
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

function setDayClamped(date: Date, day: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
}

// Mirrors the new-loan due-date convention in @loan-engine/calculations without changing
// the engine contract: the first installment is on the configured due day at least 30 days out.
function getFirstDueDate(loanStartDate: Date, dueDay: number) {
  const earliestDueDate = new Date(loanStartDate);
  earliestDueDate.setDate(earliestDueDate.getDate() + 30);

  let candidate = new Date(loanStartDate);
  candidate.setDate(1);
  setDayClamped(candidate, dueDay);
  while (candidate < earliestDueDate) {
    candidate = addMonthsClamped(candidate, 1);
    setDayClamped(candidate, dueDay);
  }
  return candidate;
}

function getCalendarDayStamp(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function expandRecurringDates({
  startDate,
  loanStartDate,
  termMonths,
  dueDay,
  recurrence,
  maxOccurrences,
}: {
  startDate: Date;
  loanStartDate: Date;
  termMonths: number;
  dueDay: number;
  recurrence: Recurrence;
  maxOccurrences?: number;
}) {
  if (
    !Number.isInteger(termMonths) ||
    termMonths < 1 ||
    termMonths > 600 ||
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31 ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(loanStartDate.getTime()) ||
    getCalendarDayStamp(startDate) < getCalendarDayStamp(loanStartDate)
  ) {
    return [];
  }

  const firstDueDate = getFirstDueDate(loanStartDate, dueDay);
  let currentDate = new Date(firstDueDate);
  const installmentDates = Array.from({ length: termMonths }, () => {
    const date = new Date(currentDate);
    setDayClamped(date, dueDay);
    currentDate = addMonthsClamped(currentDate, 1);
    return date;
  });
  const contractEnd = installmentDates.at(-1)!;
  if (getCalendarDayStamp(startDate) > getCalendarDayStamp(contractEnd)) return [];
  if (recurrence === 'none') return [new Date(startDate)];

  const intervalMonths = RECURRENCE_MONTHS[recurrence];
  const occurrenceLimit = Math.min(maxOccurrences ?? Number.POSITIVE_INFINITY, 600);
  const firstInstallmentIndex = installmentDates.findIndex(
    (date) => getCalendarDayStamp(date) >= getCalendarDayStamp(startDate),
  );
  if (firstInstallmentIndex < 0) return [];

  const dates: Date[] = [];
  for (
    let index = firstInstallmentIndex;
    index < installmentDates.length && dates.length < occurrenceLimit;
    index += intervalMonths
  ) {
    dates.push(installmentDates[index]);
  }
  return dates;
}

export function getFgtsRecurrencePolicy(usage: FgtsUsage): {
  defaultRecurrence: Recurrence;
  allowedRecurrences: Recurrence[];
  maxOccurrences?: number;
} {
  if (usage === 'down_payment') {
    return { defaultRecurrence: 'none', allowedRecurrences: ['none'] };
  }
  if (usage === 'installment') {
    return {
      defaultRecurrence: 'monthly',
      allowedRecurrences: ['none', 'monthly'],
      maxOccurrences: 12,
    };
  }
  return {
    defaultRecurrence: 'biennial',
    allowedRecurrences: ['none', 'biennial'],
  };
}

type RecurringEventBase = {
  seriesId: string;
  startDate: Date;
  loanStartDate: Date;
  termMonths: number;
  dueDay: number;
  recurrence: Recurrence;
  amount: number;
  description?: string;
  maxOccurrences?: number;
};

export function buildRecurringPrepaymentEvents({
  seriesId,
  amount,
  type,
  strategy,
  description,
  recurrence,
  ...dateOptions
}: RecurringEventBase & { type: PrepaymentType; strategy: PrepaymentStrategy }) {
  return expandRecurringDates({ recurrence, ...dateOptions }).map<RecurringPrepaymentEvent>(
    (date, index) => ({
      id: `${seriesId}-${index}`,
      date,
      amount,
      type,
      strategy,
      description,
      recurrence,
    }),
  );
}

export function buildRecurringFgtsEvents({
  seriesId,
  amount,
  usage,
  strategy,
  description,
  recurrence,
  maxOccurrences,
  ...dateOptions
}: RecurringEventBase & { usage: FgtsUsage; strategy?: PrepaymentStrategy }) {
  const policy = getFgtsRecurrencePolicy(usage);
  const effectiveRecurrence = policy.allowedRecurrences.includes(recurrence)
    ? recurrence
    : policy.defaultRecurrence;
  const effectiveMaxOccurrences =
    policy.maxOccurrences === undefined
      ? maxOccurrences
      : Math.min(maxOccurrences ?? policy.maxOccurrences, policy.maxOccurrences);

  return expandRecurringDates({
    recurrence: effectiveRecurrence,
    maxOccurrences: effectiveMaxOccurrences,
    ...dateOptions,
  }).map<RecurringFgtsEvent>((date, index) => ({
    id: `${seriesId}-${index}`,
    date,
    amount,
    usage,
    strategy: usage === 'amortization' ? strategy : undefined,
    description,
    recurrence: effectiveRecurrence,
  }));
}

export function trimEventsToSchedule<T extends { date: Date }>(
  events: T[],
  schedule: { date: Date }[],
) {
  const finalRow = schedule.at(-1);
  if (!finalRow) return [];
  const finalDay = getCalendarDayStamp(finalRow.date);
  return events.filter((event) => getCalendarDayStamp(event.date) <= finalDay);
}

export function trimFgtsEventsToSchedule(events: FgtsEvent[], schedule: { date: Date }[]) {
  const finalRow = schedule.at(-1);
  if (!finalRow) return events.filter((event) => event.usage === 'down_payment');
  const finalDay = getCalendarDayStamp(finalRow.date);
  return events.filter(
    (event) => event.usage === 'down_payment' || getCalendarDayStamp(event.date) <= finalDay,
  );
}

export function canAppendFgtsInstallmentEvents(existing: FgtsEvent[], next: FgtsEvent[]) {
  const existingCount = existing.filter((event) => event.usage === 'installment').length;
  const nextCount = next.filter((event) => event.usage === 'installment').length;
  return existingCount + nextCount <= 12;
}

export function getFgtsUsageExplainer(usage: FgtsUsage) {
  if (usage === 'down_payment') {
    return 'Entrada é uso único na contratação; confirme seu enquadramento com o banco.';
  }
  if (usage === 'installment') {
    return 'Parcela: até 80% de 12 prestações consecutivas. Informe o valor aplicado em cada parcela.';
  }
  return 'Amortização/liquidação: intervalo mínimo de 2 anos entre utilizações.';
}
