import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaywallSource } from './analytics-events';

const PURCHASE_ATTEMPT_KEY = '@calculadora-price-sac:analytics:purchase_attempt:v1';
export const PURCHASE_ATTEMPT_STALE_MS = 30 * 60 * 1000;
const completedAttemptIds = new Set<string>();

export type PurchaseTerminalEvent = 'purchase_success' | 'purchase_cancelled' | 'purchase_failed';

export interface PurchaseAttempt {
  id: string;
  source: PaywallSource;
  nthView: number;
  startedAt: number;
  status: 'pending';
}

export interface CreatedPurchaseAttempt extends PurchaseAttempt {
  supersededAttempt?: PurchaseAttempt;
}

function createAttemptId(now: number) {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function createPurchaseAttempt(
  source: PaywallSource,
  nthView: number,
  now = Date.now(),
): Promise<CreatedPurchaseAttempt> {
  const supersededAttempt = await getPendingPurchaseAttempt();
  if (supersededAttempt) {
    await completePurchaseAttempt(supersededAttempt.id, 'purchase_failed');
  }
  const attempt: PurchaseAttempt = {
    id: createAttemptId(now),
    source,
    nthView,
    startedAt: now,
    status: 'pending',
  };
  await AsyncStorage.setItem(PURCHASE_ATTEMPT_KEY, JSON.stringify(attempt));
  return supersededAttempt ? { ...attempt, supersededAttempt } : attempt;
}

export async function getPendingPurchaseAttempt(): Promise<PurchaseAttempt | null> {
  const stored = await AsyncStorage.getItem(PURCHASE_ATTEMPT_KEY);
  if (!stored) return null;
  try {
    const attempt = JSON.parse(stored) as PurchaseAttempt;
    return attempt.status === 'pending' ? attempt : null;
  } catch {
    await AsyncStorage.removeItem(PURCHASE_ATTEMPT_KEY);
    return null;
  }
}

export async function completePurchaseAttempt(
  attemptId: string,
  _terminalEvent: PurchaseTerminalEvent,
): Promise<boolean> {
  const pending = await getPendingPurchaseAttempt();
  if (!pending || pending.id !== attemptId) return false;
  if (completedAttemptIds.has(attemptId)) return false;
  completedAttemptIds.add(attemptId);
  await AsyncStorage.removeItem(PURCHASE_ATTEMPT_KEY);
  return true;
}

export async function reconcileStalePurchaseAttempt(now = Date.now()) {
  const pending = await getPendingPurchaseAttempt();
  if (!pending || now - pending.startedAt <= PURCHASE_ATTEMPT_STALE_MS) return null;
  const completed = await completePurchaseAttempt(pending.id, 'purchase_failed');
  if (!completed) return null;
  return {
    ...pending,
    terminalEvent: 'purchase_failed' as const,
    errorCode: 'stale_unresolved' as const,
  };
}
