import AsyncStorage from '@react-native-async-storage/async-storage';

const INTERSTITIAL_LAST_SHOWN_KEY = 'ads:interstitial:last_shown_at:v1';
const APP_OPEN_LAST_SHOWN_KEY = 'ads:app_open:last_shown_at:v1';

async function loadTimestamp(key: string): Promise<number | null> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function saveTimestamp(key: string, value: number) {
  await AsyncStorage.setItem(key, String(value));
}

export function loadLastInterstitialShownAt() {
  return loadTimestamp(INTERSTITIAL_LAST_SHOWN_KEY);
}

export function saveLastInterstitialShownAt(value: number) {
  return saveTimestamp(INTERSTITIAL_LAST_SHOWN_KEY, value);
}

export function loadLastAppOpenShownAt() {
  return loadTimestamp(APP_OPEN_LAST_SHOWN_KEY);
}

export function saveLastAppOpenShownAt(value: number) {
  return saveTimestamp(APP_OPEN_LAST_SHOWN_KEY, value);
}

export async function resetAdMonetizationTimestamps() {
  await AsyncStorage.multiRemove([INTERSTITIAL_LAST_SHOWN_KEY, APP_OPEN_LAST_SHOWN_KEY]);
}
