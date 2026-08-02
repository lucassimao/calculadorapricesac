import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBrandProfileAnalyticsIdentity,
  saveBrandProfileAnalyticsIdentity,
  syncBrandProfileAnalyticsIdentity,
} from '../brand-profile-analytics';

const storage = vi.hoisted(() => new Map<string, string>());
const setProfessionalProperties = vi.hoisted(() => vi.fn());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn(async (key: string) => storage.delete(key)),
  },
}));

vi.mock('../analytics', () => ({
  setAnalyticsProfessionalPersonProperties: setProfessionalProperties,
}));

const completeProfile = {
  nameOrCompany: ' Prime Credito ',
  registration: ' CRECI 123 ',
  phone: ' 11999990000 ',
  email: '',
  website: '',
};

describe('brand profile analytics identity migration', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    setProfessionalProperties.mockReturnValue(true);
  });

  it('identifies an existing complete profile once', async () => {
    await expect(syncBrandProfileAnalyticsIdentity(completeProfile)).resolves.toBe(true);
    await expect(syncBrandProfileAnalyticsIdentity(completeProfile)).resolves.toBe(false);

    expect(setProfessionalProperties).toHaveBeenCalledTimes(1);
    expect(setProfessionalProperties).toHaveBeenCalledWith({
      name: 'Prime Credito',
      registration: 'CRECI 123',
      phone: '11999990000',
      email: '',
      website: '',
    });
  });

  it('retries later when analytics is not enabled', async () => {
    setProfessionalProperties.mockReturnValue(false);

    await expect(syncBrandProfileAnalyticsIdentity(completeProfile)).resolves.toBe(false);
    await expect(syncBrandProfileAnalyticsIdentity(completeProfile)).resolves.toBe(false);

    expect(setProfessionalProperties).toHaveBeenCalledTimes(2);
  });

  it('always updates identity after an explicit profile save', async () => {
    await AsyncStorage.setItem('brand-profile:analytics-identity-enqueued:v1', 'true');
    await AsyncStorage.setItem('brand-profile:analytics-clear-pending:v1', 'true');

    await expect(saveBrandProfileAnalyticsIdentity(completeProfile)).resolves.toBe(true);

    expect(setProfessionalProperties).toHaveBeenCalledWith({
      name: 'Prime Credito',
      registration: 'CRECI 123',
      phone: '11999990000',
      email: '',
      website: '',
    });
    expect(await AsyncStorage.getItem('brand-profile:analytics-clear-pending:v1')).toBeNull();
  });

  it('does not identify an incomplete explicit save', async () => {
    await expect(
      saveBrandProfileAnalyticsIdentity({ nameOrCompany: 'Prime Credito' }),
    ).resolves.toBe(false);

    expect(setProfessionalProperties).not.toHaveBeenCalled();
  });

  it('does not identify an incomplete profile', async () => {
    await expect(
      syncBrandProfileAnalyticsIdentity({ nameOrCompany: 'Prime Credito' }),
    ).resolves.toBe(false);

    expect(setProfessionalProperties).not.toHaveBeenCalled();
  });

  it('clears the migration latch and overwrites all profile properties', async () => {
    await AsyncStorage.setItem('brand-profile:analytics-identity-enqueued:v1', 'true');

    await expect(clearBrandProfileAnalyticsIdentity()).resolves.toBe(true);

    expect(setProfessionalProperties).toHaveBeenCalledWith({
      name: '',
      registration: '',
      phone: '',
      email: '',
      website: '',
    });
    expect(await AsyncStorage.getItem('brand-profile:analytics-identity-enqueued:v1')).toBeNull();
    expect(await AsyncStorage.getItem('brand-profile:analytics-clear-pending:v1')).toBeNull();
  });

  it('retries a pending identity clear when analytics becomes available', async () => {
    setProfessionalProperties.mockReturnValueOnce(false).mockReturnValueOnce(true);

    await expect(clearBrandProfileAnalyticsIdentity()).resolves.toBe(false);
    expect(await AsyncStorage.getItem('brand-profile:analytics-clear-pending:v1')).toBe('true');

    await expect(syncBrandProfileAnalyticsIdentity({ nameOrCompany: '' })).resolves.toBe(true);

    expect(setProfessionalProperties).toHaveBeenCalledTimes(2);
    expect(setProfessionalProperties).toHaveBeenLastCalledWith({
      name: '',
      registration: '',
      phone: '',
      email: '',
      website: '',
    });
    expect(await AsyncStorage.getItem('brand-profile:analytics-clear-pending:v1')).toBeNull();
  });
});
