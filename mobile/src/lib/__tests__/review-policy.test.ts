import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markReviewRequested,
  markReviewSessionBlocked,
  recordReviewPositiveAction,
  resetReviewSessionStateForTests,
} from '../storage/review';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

describe('store review policy', () => {
  beforeEach(() => {
    storage.clear();
    resetReviewSessionStateForTests();
  });

  it('becomes eligible on the second export success', async () => {
    await expect(recordReviewPositiveAction('export_success')).resolves.toBe(false);
    await expect(recordReviewPositiveAction('export_success')).resolves.toBe(true);
  });

  it('serializes simultaneous positive actions without losing an increment', async () => {
    const [first, second] = await Promise.all([
      recordReviewPositiveAction('export_success'),
      recordReviewPositiveAction('export_success'),
    ]);

    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it('becomes eligible on the second scenario save, whichever trigger wins first', async () => {
    await expect(recordReviewPositiveAction('export_success')).resolves.toBe(false);
    await expect(recordReviewPositiveAction('scenario_saved')).resolves.toBe(false);
    await expect(recordReviewPositiveAction('scenario_saved')).resolves.toBe(true);
  });

  it('never becomes eligible again after the install was already prompted', async () => {
    await markReviewRequested();
    await expect(recordReviewPositiveAction('export_success')).resolves.toBe(false);
    await expect(recordReviewPositiveAction('scenario_saved')).resolves.toBe(false);
  });

  it('defers an eligible prompt after an ad or purchase failure until a later session', async () => {
    await recordReviewPositiveAction('export_success');
    markReviewSessionBlocked();
    await expect(recordReviewPositiveAction('export_success')).resolves.toBe(false);

    resetReviewSessionStateForTests();
    await expect(recordReviewPositiveAction('export_success')).resolves.toBe(true);
  });
});
