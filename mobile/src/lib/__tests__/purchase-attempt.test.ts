import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completePurchaseAttempt,
  createPurchaseAttempt,
  getPendingPurchaseAttempt,
  reconcileStalePurchaseAttempt,
} from '../purchase-attempt';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    clear: async () => storage.clear(),
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => storage.set(key, value),
    removeItem: async (key: string) => storage.delete(key),
  },
}));

describe('purchase attempt state machine', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists one pending attempt and accepts exactly one terminal transition', async () => {
    const attempt = await createPurchaseAttempt('premium_tab', 3, 1_000);

    expect(await getPendingPurchaseAttempt()).toEqual(attempt);
    expect(await completePurchaseAttempt(attempt.id, 'purchase_success')).toBe(true);
    expect(await completePurchaseAttempt(attempt.id, 'purchase_failed')).toBe(false);
    expect(await getPendingPurchaseAttempt()).toBeNull();
  });

  it('reconciles a stale pending attempt as stale_unresolved exactly once', async () => {
    const attempt = await createPurchaseAttempt('premium_tab', 1, 1_000);

    expect(await reconcileStalePurchaseAttempt(1_000 + 31 * 60 * 1000)).toEqual({
      ...attempt,
      terminalEvent: 'purchase_failed',
      errorCode: 'stale_unresolved',
    });
    expect(await reconcileStalePurchaseAttempt(1_000 + 32 * 60 * 1000)).toBeNull();
  });

  it('allows only one winner when terminal callbacks race', async () => {
    const attempt = await createPurchaseAttempt('premium_tab', 1, 1_000);

    const results = await Promise.all([
      completePurchaseAttempt(attempt.id, 'purchase_success'),
      completePurchaseAttempt(attempt.id, 'purchase_failed'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('returns and terminates the pending attempt when a new attempt supersedes it', async () => {
    const first = await createPurchaseAttempt('premium_tab', 1, 1_000);
    const second = await createPurchaseAttempt('premium_tab', 2, 2_000);

    expect(second.supersededAttempt).toEqual(first);
    expect((await getPendingPurchaseAttempt())?.id).toBe(second.id);
    expect(await completePurchaseAttempt(first.id, 'purchase_success')).toBe(false);
  });
});
