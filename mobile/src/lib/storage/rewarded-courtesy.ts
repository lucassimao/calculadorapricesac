import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RewardedFailureKind } from '../analytics';

const COURTESY_GRANT_STORAGE_KEY = 'rewarded-export:courtesy-grants:v1';

export const COURTESY_GRANT_LIMIT = 2;
export const COURTESY_GRANT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isCourtesyEligibleRewardedFailure(errorKind: RewardedFailureKind) {
  return errorKind === 'no_fill' || errorKind === 'load_timeout';
}

function parseGrantTimestamps(stored: string | null) {
  if (!stored) return [];
  try {
    const value = JSON.parse(stored);
    if (!Array.isArray(value)) return [];
    return value.filter((timestamp): timestamp is number => Number.isFinite(timestamp));
  } catch {
    return [];
  }
}

export type RewardedCourtesyResult = 'granted' | 'cap_reached' | 'export_failed';

export async function grantRewardedCourtesyExport(
  exportCourtesy: () => Promise<boolean>,
  now = Date.now(),
): Promise<RewardedCourtesyResult> {
  try {
    const stored = await AsyncStorage.getItem(COURTESY_GRANT_STORAGE_KEY);
    const cutoff = now - COURTESY_GRANT_WINDOW_MS;
    const activeGrants = parseGrantTimestamps(stored).filter(
      (timestamp) => timestamp > cutoff && timestamp <= now,
    );
    if (activeGrants.length >= COURTESY_GRANT_LIMIT) return 'cap_reached';
    if (!(await exportCourtesy())) return 'export_failed';
    await AsyncStorage.setItem(COURTESY_GRANT_STORAGE_KEY, JSON.stringify([...activeGrants, now]));
    return 'granted';
  } catch {
    return 'export_failed';
  }
}
