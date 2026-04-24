import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isBrandProfileComplete } from '../../types/brand-profile';
import { loadBrandProfile, saveBrandProfile } from '../storage/brand-profile';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

describe('brand profile storage', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('returns an incomplete empty profile when storage is empty', async () => {
    const profile = await loadBrandProfile();

    expect(profile.nameOrCompany).toBe('');
    expect(profile.accentColor).toBe('#2563EB');
    expect(isBrandProfileComplete(profile)).toBe(false);
  });

  it('round-trips and normalizes a complete profile', async () => {
    await saveBrandProfile({
      nameOrCompany: '  Prime Credito  ',
      registration: ' CRECI 123 ',
      phone: ' 11999990000 ',
      email: '',
      website: ' prime.example ',
      accentColor: '#047857',
      logoDataUri: 'data:image/png;base64,abc',
    });

    const profile = await loadBrandProfile();

    expect(profile).toMatchObject({
      nameOrCompany: 'Prime Credito',
      registration: 'CRECI 123',
      phone: '11999990000',
      website: 'prime.example',
      accentColor: '#047857',
      logoDataUri: 'data:image/png;base64,abc',
    });
    expect(isBrandProfileComplete(profile)).toBe(true);
  });

  it('falls back safely for malformed stored data', async () => {
    storage.set('brand-profile:v1', '{invalid-json');

    const profile = await loadBrandProfile();

    expect(profile.nameOrCompany).toBe('');
    expect(profile.accentColor).toBe('#2563EB');
    expect(isBrandProfileComplete(profile)).toBe(false);
  });

  it('requires name or company plus at least one contact field', () => {
    expect(
      isBrandProfileComplete({
        nameOrCompany: 'Prime Credito',
        accentColor: '#2563EB',
      }),
    ).toBe(false);
    expect(
      isBrandProfileComplete({
        nameOrCompany: 'Prime Credito',
        phone: '11999990000',
        accentColor: '#2563EB',
      }),
    ).toBe(true);
  });
});
