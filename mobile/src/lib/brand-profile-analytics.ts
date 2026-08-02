import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_BRAND_PROFILE,
  getBrandProfileIdentityProperties,
  isBrandProfileComplete,
} from '../types/brand-profile';
import type { BrandProfile } from '../types/brand-profile';
import { setAnalyticsProfessionalPersonProperties } from './analytics';

const IDENTITY_ENQUEUED_KEY = 'brand-profile:analytics-identity-enqueued:v1';
const IDENTITY_CLEAR_PENDING_KEY = 'brand-profile:analytics-clear-pending:v1';

async function retryPendingIdentityClear() {
  const cleared = setAnalyticsProfessionalPersonProperties(
    getBrandProfileIdentityProperties(EMPTY_BRAND_PROFILE),
  );
  if (cleared) {
    await Promise.all([
      AsyncStorage.removeItem(IDENTITY_CLEAR_PENDING_KEY).catch(() => undefined),
      AsyncStorage.removeItem(IDENTITY_ENQUEUED_KEY).catch(() => undefined),
    ]);
  }
  return cleared;
}

export async function syncBrandProfileAnalyticsIdentity(profile: BrandProfile) {
  const clearPending = await AsyncStorage.getItem(IDENTITY_CLEAR_PENDING_KEY).catch(() => null);
  if (clearPending === 'true') return retryPendingIdentityClear();
  if (!isBrandProfileComplete(profile)) return false;

  const alreadyEnqueued = await AsyncStorage.getItem(IDENTITY_ENQUEUED_KEY).catch(() => null);
  if (alreadyEnqueued === 'true') return false;

  const identified = setAnalyticsProfessionalPersonProperties(
    getBrandProfileIdentityProperties(profile),
  );
  if (identified) {
    await AsyncStorage.setItem(IDENTITY_ENQUEUED_KEY, 'true').catch(() => undefined);
  }
  return identified;
}

export async function saveBrandProfileAnalyticsIdentity(profile: BrandProfile) {
  if (!isBrandProfileComplete(profile)) return false;
  await AsyncStorage.removeItem(IDENTITY_CLEAR_PENDING_KEY).catch(() => undefined);

  const identified = setAnalyticsProfessionalPersonProperties(
    getBrandProfileIdentityProperties(profile),
  );
  if (identified) {
    await AsyncStorage.setItem(IDENTITY_ENQUEUED_KEY, 'true').catch(() => undefined);
  }
  return identified;
}

export async function clearBrandProfileAnalyticsIdentity() {
  await AsyncStorage.setItem(IDENTITY_CLEAR_PENDING_KEY, 'true').catch(() => undefined);
  return retryPendingIdentityClear();
}
