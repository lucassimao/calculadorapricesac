import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'premium:remove_ads:v1';
const listeners = new Set<(value: boolean) => void>();

export async function loadPremiumStatus(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value === 'true';
}

export async function savePremiumStatus(isPremium: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, String(isPremium));
  listeners.forEach((listener) => listener(isPremium));
}

export function subscribePremiumStatus(listener: (value: boolean) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
