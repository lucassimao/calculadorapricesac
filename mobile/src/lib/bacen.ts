import type { CorrectionIndexType } from '@loan-engine/loan';

const BACEN_SERIES: Record<CorrectionIndexType, number> = {
  TR: 226,
  IPCA: 433,
};

const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

interface BacenRateResponse {
  data: string;
  dataFim?: string;
  valor: string;
}

export interface BacenIndexRate {
  indexType: CorrectionIndexType;
  rate: number;
  referenceDate: Date;
  endDate?: Date;
  label: string;
}

export const BACEN_INDEX_RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const BACEN_INDEX_RATE_FETCH_TIMEOUT_MS = 10_000;

interface BacenIndexRateCacheEntry {
  value: BacenIndexRate;
  fetchedAt: number;
}

const rateCache = new Map<CorrectionIndexType, BacenIndexRateCacheEntry>();

function getTimeoutSignal(timeoutMs: number): AbortSignal {
  const abortSignal = AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  };

  if (typeof abortSignal.timeout === 'function') {
    return abortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function composeSignals(signals: AbortSignal[]): AbortSignal {
  const activeSignals = signals.filter((signal) => !signal.aborted);
  if (activeSignals.length !== signals.length) {
    return AbortSignal.abort();
  }
  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const abortSignal = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };

  if (typeof abortSignal.any === 'function') {
    return abortSignal.any(activeSignals);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  activeSignals.forEach((signal) => signal.addEventListener('abort', abort, { once: true }));
  return controller.signal;
}

function parseBacenDate(value: string): Date {
  const [dayText, monthText, yearText] = value.split('/');
  const day = Number.parseInt(dayText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const year = Number.parseInt(yearText ?? '', 10);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    throw new Error('BACEN returned an invalid reference date.');
  }

  return new Date(year, month - 1, day);
}

function formatBacenDateLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function parseBacenRate(indexType: CorrectionIndexType, payload: unknown): BacenIndexRate {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('BACEN returned no rate data.');
  }

  const [latest] = payload as Partial<BacenRateResponse>[];
  if (typeof latest.data !== 'string' || typeof latest.valor !== 'string') {
    throw new Error('BACEN returned malformed rate data.');
  }

  const referenceDate = parseBacenDate(latest.data);
  const endDate = typeof latest.dataFim === 'string' ? parseBacenDate(latest.dataFim) : undefined;
  const rate = Number.parseFloat(latest.valor.replace(',', '.'));
  if (!Number.isFinite(rate)) {
    throw new Error('BACEN returned an invalid rate.');
  }

  const monthLabel = MONTH_LABELS[referenceDate.getMonth()];
  const label =
    endDate !== undefined
      ? `${indexType} (${formatBacenDateLabel(referenceDate)} a ${formatBacenDateLabel(endDate)})`
      : `${indexType} (${monthLabel}/${referenceDate.getFullYear()})`;

  return {
    indexType,
    rate,
    referenceDate,
    endDate,
    label,
  };
}

export function clearBacenIndexRateCache() {
  rateCache.clear();
}

export async function fetchLatestIndexRate(
  indexType: CorrectionIndexType,
  options?: { signal?: AbortSignal; forceRefresh?: boolean },
): Promise<BacenIndexRate> {
  const cached = rateCache.get(indexType);
  if (!options?.forceRefresh) {
    if (cached && Date.now() - cached.fetchedAt < BACEN_INDEX_RATE_CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const series = BACEN_SERIES[indexType];
  const signal = composeSignals([
    ...(options?.signal ? [options.signal] : []),
    getTimeoutSignal(BACEN_INDEX_RATE_FETCH_TIMEOUT_MS),
  ]);

  try {
    const response = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`,
      { signal },
    );

    if (!response.ok) {
      throw new Error(`BACEN request failed with status ${response.status}.`);
    }

    const result = parseBacenRate(indexType, await response.json());
    rateCache.set(indexType, { value: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    if (cached && !options?.forceRefresh) {
      return cached.value;
    }
    throw error;
  }
}

export function fetchLatestTR(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
  return fetchLatestIndexRate('TR', options);
}

export function fetchLatestIPCA(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
  return fetchLatestIndexRate('IPCA', options);
}
