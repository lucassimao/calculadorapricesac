import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BrandProfile } from '../../types/brand-profile';
import { EMPTY_BRAND_PROFILE, normalizeBrandProfile } from '../../types/brand-profile';

const STORAGE_KEY = 'brand-profile:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function parseStoredProfile(value: unknown): BrandProfile {
  if (!isRecord(value)) return EMPTY_BRAND_PROFILE;

  return normalizeBrandProfile({
    nameOrCompany: readString(value.nameOrCompany),
    registration: readString(value.registration),
    phone: readString(value.phone),
    email: readString(value.email),
    website: readString(value.website),
    accentColor: readString(value.accentColor),
    logoDataUri: readString(value.logoDataUri),
  });
}

export async function loadBrandProfile(): Promise<BrandProfile> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return EMPTY_BRAND_PROFILE;

  try {
    return parseStoredProfile(JSON.parse(stored));
  } catch {
    return EMPTY_BRAND_PROFILE;
  }
}

export async function saveBrandProfile(profile: BrandProfile): Promise<BrandProfile> {
  const normalized = normalizeBrandProfile(profile);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function clearBrandProfile(): Promise<BrandProfile> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return EMPTY_BRAND_PROFILE;
}
