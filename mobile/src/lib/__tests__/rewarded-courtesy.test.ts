import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COURTESY_GRANT_LIMIT,
  COURTESY_GRANT_WINDOW_MS,
  grantRewardedCourtesyExport,
  isCourtesyEligibleRewardedFailure,
} from '../storage/rewarded-courtesy';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

describe('rewarded export courtesy grants', () => {
  beforeEach(() => storage.clear());

  it('grants no-fill and load-timeout failures, but not cancellations or other errors', () => {
    expect(isCourtesyEligibleRewardedFailure('no_fill')).toBe(true);
    expect(isCourtesyEligibleRewardedFailure('load_timeout')).toBe(true);
    expect(isCourtesyEligibleRewardedFailure('network')).toBe(false);
    expect(isCourtesyEligibleRewardedFailure('unknown')).toBe(false);
  });

  it('allows only two grants in a rolling seven-day window', async () => {
    const now = Date.UTC(2026, 7, 2);

    await expect(grantRewardedCourtesyExport(async () => true, now)).resolves.toBe('granted');
    await expect(grantRewardedCourtesyExport(async () => true, now + 1)).resolves.toBe('granted');
    const cappedExport = vi.fn(async () => true);
    await expect(grantRewardedCourtesyExport(cappedExport, now + 2)).resolves.toBe('cap_reached');
    expect(cappedExport).not.toHaveBeenCalled();
    expect(COURTESY_GRANT_LIMIT).toBe(2);

    await expect(
      grantRewardedCourtesyExport(async () => true, now + COURTESY_GRANT_WINDOW_MS + 1),
    ).resolves.toBe('granted');
  });

  it('does not consume the weekly quota when export generation fails', async () => {
    const now = Date.UTC(2026, 7, 2);

    await expect(grantRewardedCourtesyExport(async () => false, now)).resolves.toBe(
      'export_failed',
    );
    await expect(grantRewardedCourtesyExport(async () => true, now + 1)).resolves.toBe('granted');
    await expect(grantRewardedCourtesyExport(async () => true, now + 2)).resolves.toBe('granted');
  });

  it('recovers safely from malformed stored data', async () => {
    storage.set('rewarded-export:courtesy-grants:v1', '{bad json');
    await expect(grantRewardedCourtesyExport(async () => true, Date.UTC(2026, 7, 2))).resolves.toBe(
      'granted',
    );
  });
});
