import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAnalyticsDryRunSink,
  consumePendingPaywallSource,
  getAnalyticsDryRunPersonPropertiesSink,
  getAnalyticsDryRunSink,
  getAnnualRateBucket,
  markAppBackground,
  registerAnalyticsProperties,
  setAnalyticsDryRunForTests,
  setAnalyticsProfessionalPersonProperties,
  setPendingPaywallSource,
  trackAppOpen,
  trackEvent,
} from '../analytics';
import { recordReviewPositiveAction, resetReviewSessionStateForTests } from '../storage/review';
import { syncBrandProfileAnalyticsIdentity } from '../brand-profile-analytics';
import type { Scenario } from '@loan-engine/loan';
import { trackCalculationPerformed, trackPortabilityCompared } from '../scenario-analytics';
import {
  openOptimizerPremiumPaywall,
  trackOptimizerOpened,
  trackOptimizerPlanGenerated,
  trackOptimizerPlanSaved,
} from '../optimizer-analytics';
import { resetComparisonStartedForTests, trackComparisonStartedOnce } from '../comparison-adoption';

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
    resetReviewSessionStateForTests();
    setAnalyticsDryRunForTests(true);
    clearAnalyticsDryRunSink();
    resetComparisonStartedForTests();
  });

  it.each(['rewarded_export_ad_failed', 'purchase_failed'] as const)(
    'blocks review requests in the session after %s',
    async (event) => {
      await expect(recordReviewPositiveAction('export_success')).resolves.toBe(false);

      if (event === 'rewarded_export_ad_failed') {
        trackEvent(event, { error_kind: 'no_fill', format: 'pdf', source: 'export_sheet' });
      } else {
        trackEvent(event, {
          error_code: 'store_unavailable',
          attempt_id: 'attempt-1',
          source: 'premium_tab',
          flow: 'purchase',
          connected: false,
          store_ready: false,
          product_loaded: false,
          is_premium: false,
        });
      }

      await expect(recordReviewPositiveAction('export_success')).resolves.toBe(false);
      resetReviewSessionStateForTests();
      await expect(recordReviewPositiveAction('export_success')).resolves.toBe(true);
    },
  );

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

  it('allows app-user profile fields only through typed person properties', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await setAnalyticsProfessionalPersonProperties({
      name: 'Prime Credito',
      email: 'contato@prime.example',
      phone: '11999990000',
      registration: 'CRECI 123',
      website: 'prime.example',
    });

    expect(getAnalyticsDryRunPersonPropertiesSink()).toEqual([
      {
        name: 'Prime Credito',
        email: 'contato@prime.example',
        phone: '11999990000',
        registration: 'CRECI 123',
        website: 'prime.example',
      },
    ]);
    expect(getAnalyticsDryRunSink()).toEqual([]);
    expect(JSON.stringify(info.mock.calls)).not.toContain('Prime Credito');
    expect(JSON.stringify(info.mock.calls)).not.toContain('contato@prime.example');
    info.mockRestore();
  });

  it('does not add person properties to sinks when analytics is disabled', () => {
    setAnalyticsDryRunForTests(false);

    expect(
      setAnalyticsProfessionalPersonProperties({
        name: 'Prime Credito',
        email: '',
        phone: '11999990000',
        registration: '',
        website: '',
      }),
    ).toBe(false);
    expect(getAnalyticsDryRunPersonPropertiesSink()).toEqual([]);
    setAnalyticsDryRunForTests(true);
  });

  it('does not persist the network migration latch from dry-run captures', async () => {
    setAnalyticsDryRunForTests(true);
    const profile = { nameOrCompany: 'Prime Credito', phone: '11999990000' };

    await expect(syncBrandProfileAnalyticsIdentity(profile)).resolves.toBe(false);
    await expect(syncBrandProfileAnalyticsIdentity(profile)).resolves.toBe(false);

    expect(getAnalyticsDryRunPersonPropertiesSink()).toHaveLength(2);
    expect(await AsyncStorage.getItem('brand-profile:analytics-identity-enqueued:v1')).toBeNull();
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

  it('captures existing-contract calculation entry mode in the dry-run sink', () => {
    const scenario: Scenario = {
      id: 'existing',
      name: 'Contrato atual',
      system: 'SAC',
      loanMode: 'standard',
      principal: 180_000,
      rate: 11.5,
      rateType: 'annual',
      term: 120,
      termUnit: 'months',
      startDate: new Date(2026, 8, 10),
      nextDueDate: new Date(2026, 9, 10),
      dueDay: 10,
      entryMode: 'existing_contract',
      prepayments: [],
      fgtsEvents: [],
    };

    trackCalculationPerformed(scenario, 121);

    expect(getAnalyticsDryRunSink()).toContainEqual(
      expect.objectContaining({
        event: 'calculation_performed',
        properties: expect.objectContaining({
          entry_mode: 'existing_contract',
          principal_bucket: '100-300k',
          term_months: 120,
        }),
      }),
    );
  });

  it('captures a portability comparison without raw financial values', () => {
    trackPortabilityCompared(8);

    expect(getAnalyticsDryRunSink()).toContainEqual(
      expect.objectContaining({
        event: 'portability_compared',
        properties: expect.objectContaining({
          has_break_even: true,
          break_even_month: 8,
        }),
      }),
    );
  });

  it('carries the amortize-or-invest gate source into the paywall event', () => {
    setPendingPaywallSource('amortizar_investir');
    const source = consumePendingPaywallSource();
    trackEvent('premium_paywall_viewed', {
      source,
      nth_view: 1,
      iap_availability: 'supported',
      store_connected: true,
      store_ready: true,
      purchased_product_count: 0,
    });

    expect(getAnalyticsDryRunSink()).toContainEqual(
      expect.objectContaining({
        event: 'premium_paywall_viewed',
        properties: expect.objectContaining({ source: 'amortizar_investir' }),
      }),
    );
  });

  it('carries the optimizer gate source into the paywall event', () => {
    openOptimizerPremiumPaywall();
    const source = consumePendingPaywallSource();
    trackEvent('premium_paywall_viewed', {
      source,
      nth_view: 1,
      iap_availability: 'supported',
      store_connected: true,
      store_ready: true,
      purchased_product_count: 0,
    });

    expect(getAnalyticsDryRunSink()).toContainEqual(
      expect.objectContaining({
        event: 'premium_paywall_viewed',
        properties: expect.objectContaining({ source: 'prepayment_optimizer' }),
      }),
    );
  });

  it('captures optimizer outcomes with buckets instead of raw financial values', () => {
    trackOptimizerOpened('prepayment_section');
    trackOptimizerPlanGenerated({
      goal: 'payoff_by_date',
      budget: 2_000,
      horizonMonths: 60,
      interestSaved: 25_000,
    });
    trackOptimizerPlanSaved('payoff_by_date');

    const events = getAnalyticsDryRunSink();
    expect(events.map(({ event }) => event)).toEqual([
      'optimizer_opened',
      'optimizer_plan_generated',
      'optimizer_plan_saved',
    ]);
    expect(JSON.stringify(events)).not.toContain('amount');
    expect(JSON.stringify(events)).not.toContain('interest_saved":');
  });

  it('emits comparison_started only on the first comparison interaction of the session', () => {
    expect(trackComparisonStartedOnce()).toBe(true);
    expect(trackComparisonStartedOnce()).toBe(false);
    expect(getAnalyticsDryRunSink().map(({ event }) => event)).toEqual(['comparison_started']);
  });

  it('allows comparison_started again after a qualified app session begins', async () => {
    expect(trackComparisonStartedOnce()).toBe(true);
    await trackAppOpen(1_000);
    expect(trackComparisonStartedOnce()).toBe(true);

    expect(getAnalyticsDryRunSink().map(({ event }) => event)).toEqual([
      'comparison_started',
      'app_open',
      'comparison_started',
    ]);
  });

  it('omits the break-even month when a portability comparison has no break-even', () => {
    trackPortabilityCompared(null);

    const event = getAnalyticsDryRunSink().find(
      (candidate) => candidate.event === 'portability_compared',
    );
    expect(event?.properties).toEqual(
      expect.objectContaining({
        has_break_even: false,
      }),
    );
    expect(event?.properties).not.toHaveProperty('break_even_month');
  });
});

// Negative type-test: undeclared names and undeclared fields must fail compilation.
if (false) {
  // @ts-expect-error analytics event is not declared
  trackEvent('made_up_event');
  // @ts-expect-error raw principal is not an allowed scenario property
  trackEvent('scenario_saved', { principal: 300_000 });
  // @ts-expect-error person properties must be one complete supported shape
  setAnalyticsProfessionalPersonProperties({});
  setAnalyticsProfessionalPersonProperties({
    name: 'Prime Credito',
    email: '',
    phone: '',
    registration: '',
    website: '',
    // @ts-expect-error premium person properties cannot leak into the professional shape
    is_premium: true,
  });
}
