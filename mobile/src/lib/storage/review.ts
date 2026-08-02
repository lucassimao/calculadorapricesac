import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_REQUESTED_KEY = 'app:review_requested:v1';
const EXPORT_SUCCESS_COUNT_KEY = 'app:review_export_success_count:v1';
const SCENARIO_SAVE_COUNT_KEY = 'app:review_scenario_save_count:v1';
const MIN_POSITIVE_ACTIONS_BEFORE_REVIEW = 2;

export type ReviewTrigger = 'export_success' | 'scenario_saved';

let reviewBlockedThisSession = false;
let positiveActionQueue = Promise.resolve();

export async function hasRequestedReview(): Promise<boolean> {
  const value = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
  return value === 'true';
}

export async function markReviewRequested(): Promise<void> {
  await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
}

export function markReviewSessionBlocked() {
  reviewBlockedThisSession = true;
}

export function isReviewSessionBlocked() {
  return reviewBlockedThisSession;
}

export function resetReviewSessionStateForTests() {
  reviewBlockedThisSession = false;
  positiveActionQueue = Promise.resolve();
}

async function getPositiveActionCount(key: string) {
  const stored = await AsyncStorage.getItem(key);
  const count = stored ? Number.parseInt(stored, 10) : 0;
  return Number.isFinite(count) && count > 0 ? count : 0;
}

async function recordReviewPositiveActionNow(trigger: ReviewTrigger) {
  if (await hasRequestedReview()) return false;

  const triggerKey =
    trigger === 'export_success' ? EXPORT_SUCCESS_COUNT_KEY : SCENARIO_SAVE_COUNT_KEY;
  const otherKey =
    trigger === 'export_success' ? SCENARIO_SAVE_COUNT_KEY : EXPORT_SUCCESS_COUNT_KEY;
  const [currentTriggerCount, otherCount] = await Promise.all([
    getPositiveActionCount(triggerKey),
    getPositiveActionCount(otherKey),
  ]);
  const nextTriggerCount = currentTriggerCount + 1;
  await AsyncStorage.setItem(triggerKey, String(nextTriggerCount));

  if (reviewBlockedThisSession) return false;
  return Math.max(nextTriggerCount, otherCount) >= MIN_POSITIVE_ACTIONS_BEFORE_REVIEW;
}

export function recordReviewPositiveAction(trigger: ReviewTrigger) {
  const result = positiveActionQueue.then(() => recordReviewPositiveActionNow(trigger));
  positiveActionQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
