import AsyncStorage from '@react-native-async-storage/async-storage';

export const INVESTMENT_REFERENCE_RATE_KEY = 'investment:reference-rate:v1';
export const INVESTMENT_RATE_CHANGE_THRESHOLD_PP = 0.25;

interface StoredInvestmentReferenceRate {
  annualRate: number;
  asOf: string;
}

export interface InvestmentReferenceRateChange {
  previousAnnualRate: number;
  currentAnnualRate: number;
  direction: 'up' | 'down';
  changedByPercentagePoints: number;
  asOf: string;
}

function roundRate(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseStoredRate(value: string | null): StoredInvestmentReferenceRate | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredInvestmentReferenceRate>;
    if (!Number.isFinite(parsed.annualRate) || typeof parsed.asOf !== 'string') return null;
    return { annualRate: parsed.annualRate!, asOf: parsed.asOf };
  } catch {
    return null;
  }
}

async function storeRate(value: StoredInvestmentReferenceRate) {
  await AsyncStorage.setItem(INVESTMENT_REFERENCE_RATE_KEY, JSON.stringify(value));
}

export async function checkInvestmentReferenceRateChange({
  annualRate,
  asOf,
  thresholdPercentagePoints = INVESTMENT_RATE_CHANGE_THRESHOLD_PP,
}: {
  annualRate: number;
  asOf: string;
  thresholdPercentagePoints?: number;
}): Promise<InvestmentReferenceRateChange | null> {
  if (!Number.isFinite(annualRate) || annualRate < 0 || !asOf.trim()) {
    throw new Error('Referência de investimento inválida.');
  }

  const current = { annualRate, asOf };
  const previous = parseStoredRate(await AsyncStorage.getItem(INVESTMENT_REFERENCE_RATE_KEY));
  if (!previous) {
    await storeRate(current);
    return null;
  }

  const change = roundRate(annualRate - previous.annualRate);
  if (Math.abs(change) + Number.EPSILON < thresholdPercentagePoints) {
    return null;
  }

  await storeRate(current);
  return {
    previousAnnualRate: previous.annualRate,
    currentAnnualRate: annualRate,
    direction: change > 0 ? 'up' : 'down',
    changedByPercentagePoints: Math.abs(change),
    asOf,
  };
}

export async function seedInvestmentReferenceRateChangeForDev(currentAnnualRate: number) {
  await storeRate({
    annualRate: roundRate(currentAnnualRate - 1),
    asOf: 'dev-seed',
  });
}
