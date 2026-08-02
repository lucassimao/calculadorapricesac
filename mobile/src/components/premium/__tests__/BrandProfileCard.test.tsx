import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrandProfile } from '../../../types/brand-profile';
import { BrandProfileCard } from '../BrandProfileCard';

const mocks = vi.hoisted(() => ({
  clearBrandProfile: vi.fn(),
  clearBrandProfileAnalyticsIdentity: vi.fn(),
  loadBrandProfile: vi.fn(),
  registerAnalyticsProperties: vi.fn(),
  saveBrandProfile: vi.fn(),
  saveBrandProfileAnalyticsIdentity: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('../../../lib/storage/brand-profile', () => ({
  clearBrandProfile: mocks.clearBrandProfile,
  loadBrandProfile: mocks.loadBrandProfile,
  saveBrandProfile: mocks.saveBrandProfile,
}));

vi.mock('../../../lib/analytics', () => ({
  registerAnalyticsProperties: mocks.registerAnalyticsProperties,
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../../lib/brand-profile-analytics', () => ({
  clearBrandProfileAnalyticsIdentity: mocks.clearBrandProfileAnalyticsIdentity,
  saveBrandProfileAnalyticsIdentity: mocks.saveBrandProfileAnalyticsIdentity,
}));

const storedProfile: BrandProfile = {
  nameOrCompany: 'Prime Credito',
  registration: 'CRECI 123',
  phone: '11999990000',
  email: '',
  website: '',
  accentColor: '#2563EB',
};

async function renderCard() {
  let renderer: ReactTestRenderer;

  await act(async () => {
    renderer = create(<BrandProfileCard isPremium />);
    await Promise.resolve();
  });

  return renderer!;
}

describe('BrandProfileCard analytics identity lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadBrandProfile.mockResolvedValue(storedProfile);
    mocks.saveBrandProfile.mockImplementation(async (profile: BrandProfile) => profile);
    mocks.clearBrandProfile.mockResolvedValue({
      nameOrCompany: '',
      registration: '',
      phone: '',
      email: '',
      website: '',
      accentColor: '#2563EB',
    });
    mocks.clearBrandProfileAnalyticsIdentity.mockResolvedValue(true);
    mocks.saveBrandProfileAnalyticsIdentity.mockResolvedValue(true);
  });

  it('identifies the app user on save and opens the privacy policy', async () => {
    const renderer = await renderCard();

    const notice = renderer.root.findByProps({ testID: 'professional-profile-analytics-notice' });
    expect(notice.props.children[0]).toContain('PostHog');
    const openUrl = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await act(async () => {
      await renderer.root
        .findByProps({ testID: 'professional-profile-privacy-link' })
        .props.onPress();
    });

    expect(openUrl).toHaveBeenCalledWith('https://www.calculadorapricesac.com.br/privacidade');
    openUrl.mockRestore();

    await act(async () => {
      await renderer.root.findByProps({ testID: 'professional-profile-save' }).props.onPress();
    });

    expect(mocks.saveBrandProfileAnalyticsIdentity).toHaveBeenCalledWith(storedProfile);
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'professional_profile_saved',
      expect.objectContaining({ professional_profile_complete: true }),
    );
  });

  it('clears profile PII while preserving the same analytics distinct ID', async () => {
    const alert = vi.spyOn(Alert, 'alert');
    const renderer = await renderCard();

    await act(async () => {
      renderer.root.findByProps({ testID: 'professional-profile-clear' }).props.onPress();
    });
    const actions = alert.mock.calls[0]?.[2];

    await act(async () => {
      await actions?.[1]?.onPress?.();
    });

    expect(mocks.clearBrandProfile).toHaveBeenCalledTimes(1);
    expect(mocks.clearBrandProfileAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'professional_profile_cleared',
      expect.objectContaining({ professional_profile_complete: true }),
    );
    alert.mockRestore();
  });
});
