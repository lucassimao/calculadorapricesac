import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INVESTMENT_REFERENCE_RATE_KEY,
  checkInvestmentReferenceRateChange,
  seedInvestmentReferenceRateChangeForDev,
} from '../investment-rate-change';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => storage.set(key, value),
    removeItem: async (key: string) => storage.delete(key),
    clear: async () => storage.clear(),
  },
}));

describe('investment reference rate change', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('stores the first seen rate without showing a banner', async () => {
    await expect(
      checkInvestmentReferenceRateChange({ annualRate: 14.15, asOf: '2026-07-06' }),
    ).resolves.toBeNull();

    expect(JSON.parse((await AsyncStorage.getItem(INVESTMENT_REFERENCE_RATE_KEY))!)).toEqual({
      annualRate: 14.15,
      asOf: '2026-07-06',
    });
  });

  it('shows a change only when the stored anchor differs by the threshold', async () => {
    await AsyncStorage.setItem(
      INVESTMENT_REFERENCE_RATE_KEY,
      JSON.stringify({ annualRate: 13.9, asOf: '2026-06-01' }),
    );

    await expect(
      checkInvestmentReferenceRateChange({
        annualRate: 14.1,
        asOf: '2026-07-01',
        thresholdPercentagePoints: 0.25,
      }),
    ).resolves.toBeNull();
    await expect(
      checkInvestmentReferenceRateChange({
        annualRate: 14.15,
        asOf: '2026-07-06',
        thresholdPercentagePoints: 0.25,
      }),
    ).resolves.toEqual({
      previousAnnualRate: 13.9,
      currentAnnualRate: 14.15,
      direction: 'up',
      changedByPercentagePoints: 0.25,
      asOf: '2026-07-06',
    });
  });

  it('updates the anchor after reporting so the banner is not repeated next foreground', async () => {
    await AsyncStorage.setItem(
      INVESTMENT_REFERENCE_RATE_KEY,
      JSON.stringify({ annualRate: 15, asOf: '2026-01-01' }),
    );

    const input = { annualRate: 14.15, asOf: '2026-07-06' };
    await expect(checkInvestmentReferenceRateChange(input)).resolves.toMatchObject({
      direction: 'down',
    });
    await expect(checkInvestmentReferenceRateChange(input)).resolves.toBeNull();
  });

  it('recovers from malformed storage and offers a deterministic dev seed', async () => {
    await AsyncStorage.setItem(INVESTMENT_REFERENCE_RATE_KEY, '{broken');
    await expect(
      checkInvestmentReferenceRateChange({ annualRate: 14.15, asOf: '2026-07-06' }),
    ).resolves.toBeNull();

    await seedInvestmentReferenceRateChangeForDev(14.15);
    expect(JSON.parse((await AsyncStorage.getItem(INVESTMENT_REFERENCE_RATE_KEY))!)).toMatchObject({
      annualRate: 13.15,
      asOf: 'dev-seed',
    });
  });
});
