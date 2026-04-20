import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadLastAppOpenShownAt,
  loadLastInterstitialShownAt,
  resetAdMonetizationTimestamps,
  saveLastAppOpenShownAt,
  saveLastInterstitialShownAt,
} from '../storage/ad-monetization';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => storage.delete(key));
    }),
  },
}));

describe('ad monetization storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('round-trips interstitial and app-open timestamps', async () => {
    await saveLastInterstitialShownAt(123456);
    await saveLastAppOpenShownAt(789012);

    await expect(loadLastInterstitialShownAt()).resolves.toBe(123456);
    await expect(loadLastAppOpenShownAt()).resolves.toBe(789012);
  });

  it('clears stored monetization timestamps', async () => {
    await saveLastInterstitialShownAt(123456);
    await saveLastAppOpenShownAt(789012);

    await resetAdMonetizationTimestamps();

    await expect(loadLastInterstitialShownAt()).resolves.toBeNull();
    await expect(loadLastAppOpenShownAt()).resolves.toBeNull();
  });
});
