import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAnalyticsDryRunSink,
  getAnalyticsDryRunSink,
  getAnnualRateBucket,
  markAppBackground,
  registerAnalyticsProperties,
  setAnalyticsDryRunForTests,
  trackAppOpen,
  trackEvent,
} from '../analytics';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    clear: async () => storage.clear(),
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => storage.set(key, value),
    removeItem: async (key: string) => storage.delete(key),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '1.2.0', extra: {} },
  },
}));

vi.mock('expo-application', () => ({
  getInstallationTimeAsync: async () => new Date(0),
}));

vi.mock('posthog-react-native', () => ({
  PostHog: class {},
}));

describe('typed analytics runtime', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setAnalyticsDryRunForTests(true);
    clearAnalyticsDryRunSink();
  });

  it('adds the complete super-property contract to every dry-run event', () => {
    registerAnalyticsProperties({ is_premium: false, saved_scenario_count: 2 });

    trackEvent('feedback_email_clicked');

    expect(getAnalyticsDryRunSink()).toEqual([
      expect.objectContaining({
        event: 'feedback_email_clicked',
        properties: expect.objectContaining({
          app_platform: expect.any(String),
          app_version: expect.any(String),
          is_premium: false,
          saved_scenario_count: 2,
        }),
      }),
    ]);
  });

  it('never captures forbidden raw financial or identity properties', () => {
    registerAnalyticsProperties({ is_premium: false, saved_scenario_count: 0 });

    trackEvent('scenario_saved', {
      is_update: false,
      is_premium: false,
      scenario_count: 1,
      principal_bucket: '300-500k',
    });
    const unsafeTrackEvent = trackEvent as unknown as (
      event: 'feedback_email_clicked',
      properties: Record<string, string | number>,
    ) => void;
    unsafeTrackEvent('feedback_email_clicked', {
      principal: 300_000,
      client_name: 'Pessoa Teste',
      email: 'pessoa@example.com',
    });

    const payload = JSON.stringify(getAnalyticsDryRunSink().map(({ properties }) => properties));
    expect(payload).not.toContain('principal":');
    expect(payload).not.toContain('client_name');
    expect(payload).not.toContain('email');
    expect(payload).not.toContain('phone');
    expect(payload).not.toContain('registration');
  });

  it('emits one canonical app_open per cold open and qualified foreground', async () => {
    await trackAppOpen(1_000);
    await trackAppOpen(60 * 60 * 1000);
    await markAppBackground(60 * 60 * 1000 + 1_000);
    await trackAppOpen(60 * 60 * 1000 + 2_000);
    await trackAppOpen(60 * 60 * 1000 + 31 * 60 * 1000);
    await markAppBackground(2 * 60 * 60 * 1000);
    await trackAppOpen(2 * 60 * 60 * 1000 + 30 * 60 * 1000);

    expect(getAnalyticsDryRunSink().map(({ event }) => event)).toEqual(['app_open', 'app_open']);
  });

  it('buckets monthly rates after annualizing them', () => {
    expect(getAnnualRateBucket(1.2, 'monthly')).toBe('>13');
    expect(getAnnualRateBucket(10, 'annual')).toBe('9-11');
    expect(getAnnualRateBucket(13, 'annual')).toBe('11-13');
  });
});

// Negative type-test: undeclared names and undeclared fields must fail compilation.
if (false) {
  // @ts-expect-error analytics event is not declared
  trackEvent('made_up_event');
  // @ts-expect-error raw principal is not an allowed scenario property
  trackEvent('scenario_saved', { principal: 300_000 });
}
