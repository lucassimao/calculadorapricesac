import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'premium:remove_ads:v1';

export async function loadPremiumStatus(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value === 'true';
}

export async function savePremiumStatus(isPremium: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, String(isPremium));
}
