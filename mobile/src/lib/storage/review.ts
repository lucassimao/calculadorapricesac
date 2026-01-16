import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_REQUESTED_KEY = 'app:review_requested:v1';
const APP_OPENS_KEY = 'app:opens_count:v1';

/**
 * Track app opens and determine if we should request a review.
 * We ask for review after 5 app opens, and only once ever.
 */
const MIN_OPENS_BEFORE_REVIEW = 5;

export async function hasRequestedReview(): Promise<boolean> {
  const value = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
  return value === 'true';
}

export async function markReviewRequested(): Promise<void> {
  await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
}

export async function getAppOpensCount(): Promise<number> {
  const value = await AsyncStorage.getItem(APP_OPENS_KEY);
  return value ? parseInt(value, 10) : 0;
}

export async function incrementAppOpens(): Promise<number> {
  const current = await getAppOpensCount();
  const newCount = current + 1;
  await AsyncStorage.setItem(APP_OPENS_KEY, String(newCount));
  return newCount;
}

export async function shouldRequestReview(): Promise<boolean> {
  const [alreadyRequested, opens] = await Promise.all([
    hasRequestedReview(),
    getAppOpensCount(),
  ]);

  // Don't request if already requested or not enough app opens
  if (alreadyRequested) return false;
  if (opens < MIN_OPENS_BEFORE_REVIEW) return false;

  return true;
}
