import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { PostHog } from 'posthog-react-native';
import type {
  AnalyticsEvent,
  AnalyticsEventMap,
  AnalyticsPersonProperties,
  AnalyticsProperties,
  AnalyticsSuperProperties,
  PaywallSource,
} from './analytics-events';

export type {
  AnalyticsEvent,
  AnalyticsEventMap,
  AnalyticsPersonProperties,
  AnalyticsSuperProperties,
  PaywallSource,
  RewardedFailureKind,
} from './analytics-events';

const extra = Constants.expoConfig?.extra ?? {};
const apiKey =
  typeof extra.posthogApiKey === 'string' && extra.posthogApiKey.trim().length > 0
    ? extra.posthogApiKey.trim()
    : '';
const host =
  typeof extra.posthogHost === 'string' && extra.posthogHost.trim().length > 0
    ? extra.posthogHost.trim()
    : 'https://us.i.posthog.com';
const configuredDryRun =
  process.env.EXPO_PUBLIC_ANALYTICS_DRYRUN === '1' || extra.analyticsDryRun === true;

const INSTALL_TRACKED_KEY = '@calculadora-price-sac:analytics:install_tracked:v1';
const INSTALL_DATE_KEY = '@calculadora-price-sac:analytics:install_date:v1';
const FIRST_APP_VERSION_KEY = '@calculadora-price-sac:analytics:first_app_version:v1';
const PERSON_PREMIUM_STATUS_KEY = '@calculadora-price-sac:analytics:person_premium_status:v1';
const LAST_APP_OPEN_KEY = '@calculadora-price-sac:analytics:last_app_open:v1';
const LAST_APP_BACKGROUND_KEY = '@calculadora-price-sac:analytics:last_app_background:v1';
const PAYWALL_VIEW_COUNT_KEY = '@calculadora-price-sac:analytics:paywall_view_count:v1';
const REWARDED_CHOICE_COUNT_KEY = '@calculadora-price-sac:analytics:rewarded_choice_count:v1';
const APP_OPEN_INTERVAL_MS = 30 * 60 * 1000;

const FORBIDDEN_PROPERTY_KEYS = new Set([
  'principal',
  'professional_client_name',
  'client_name',
  'name',
  'email',
  'phone',
  'registration',
  'website',
]);

export interface AnalyticsDryRunCapture {
  event: AnalyticsEvent;
  properties: AnalyticsProperties;
}

let posthogClient: PostHog | null = null;
let dryRunOverride: boolean | null = null;
let dryRunSink: AnalyticsDryRunCapture[] = [];
let coldOpenTracked = false;
let pendingPaywallSource: PaywallSource | null = null;
let superProperties: AnalyticsSuperProperties = {
  app_version: Constants.expoConfig?.version ?? 'unknown',
  app_platform: Platform.OS,
  is_premium: false,
  saved_scenario_count: 0,
};

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;
const posthogEnabled = !isDevelopment && !configuredDryRun && apiKey.length > 0;

function dryRunEnabled() {
  return dryRunOverride ?? configuredDryRun;
}

function sanitizeProperties(properties: AnalyticsProperties): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => !FORBIDDEN_PROPERTY_KEYS.has(key)),
  ) as AnalyticsProperties;
}

function registerCurrentSuperProperties() {
  posthogClient?.register(superProperties as unknown as AnalyticsProperties);
}

if (posthogEnabled) {
  posthogClient = new PostHog(apiKey, {
    host,
    captureAppLifecycleEvents: false,
  });
  registerCurrentSuperProperties();
}

export function analyticsEnabled() {
  return posthogClient !== null || dryRunEnabled();
}

export function getAnnualRateBucket(rate: number, rateType: 'monthly' | 'annual') {
  const annualRate = rateType === 'annual' ? rate : (Math.pow(1 + rate / 100, 12) - 1) * 100;
  if (annualRate < 9) return '<9' as const;
  if (annualRate < 11) return '9-11' as const;
  if (annualRate <= 13) return '11-13' as const;
  return '>13' as const;
}

type TrackEventArguments<E extends AnalyticsEvent> =
  Record<string, never> extends AnalyticsEventMap[E]
    ? [properties?: AnalyticsEventMap[E]]
    : [properties: AnalyticsEventMap[E]];

export function trackEvent<E extends AnalyticsEvent>(
  event: E,
  ...[properties]: TrackEventArguments<E>
) {
  const payload = sanitizeProperties({
    ...superProperties,
    ...((properties ?? {}) as AnalyticsProperties),
  });

  if (dryRunEnabled()) {
    const capture = { event, properties: payload };
    dryRunSink.push(capture);
    console.info('[analytics:dry-run]', JSON.stringify(capture));
  }

  posthogClient?.capture(event, payload);
}

export async function trackInstallIfNeeded(now = Date.now()) {
  if (!analyticsEnabled()) return;
  const [alreadyTracked, installDate, firstAppVersion] = await Promise.all([
    AsyncStorage.getItem(INSTALL_TRACKED_KEY),
    AsyncStorage.getItem(INSTALL_DATE_KEY),
    AsyncStorage.getItem(FIRST_APP_VERSION_KEY),
  ]);
  if (!installDate) {
    const nativeInstallDate = await Application.getInstallationTimeAsync().catch(() => null);
    await AsyncStorage.setItem(INSTALL_DATE_KEY, String(nativeInstallDate?.getTime() ?? now));
  }
  if (!firstAppVersion) {
    await AsyncStorage.setItem(FIRST_APP_VERSION_KEY, superProperties.app_version);
  }
  if (alreadyTracked === 'true') return;
  await AsyncStorage.setItem(INSTALL_TRACKED_KEY, 'true');
  trackEvent('app_installed');
}

export async function trackAppOpen(now = Date.now()) {
  if (!analyticsEnabled()) return false;
  if (coldOpenTracked) {
    const storedBackground = await AsyncStorage.getItem(LAST_APP_BACKGROUND_KEY);
    const lastBackground = storedBackground ? Number.parseInt(storedBackground, 10) : Number.NaN;
    await AsyncStorage.removeItem(LAST_APP_BACKGROUND_KEY);
    if (!Number.isFinite(lastBackground) || now - lastBackground < APP_OPEN_INTERVAL_MS) {
      return false;
    }
  }
  coldOpenTracked = true;
  await Promise.all([
    AsyncStorage.setItem(LAST_APP_OPEN_KEY, String(now)),
    AsyncStorage.removeItem(LAST_APP_BACKGROUND_KEY),
  ]);
  trackEvent('app_open');
  return true;
}

export async function markAppBackground(now = Date.now()) {
  await AsyncStorage.setItem(LAST_APP_BACKGROUND_KEY, String(now));
}

export function setPendingPaywallSource(source: PaywallSource) {
  pendingPaywallSource = source;
}

export function consumePendingPaywallSource(): PaywallSource {
  const source = pendingPaywallSource ?? 'premium_tab';
  pendingPaywallSource = null;
  return source;
}

export function registerAnalyticsProperties(properties: Partial<AnalyticsSuperProperties>) {
  superProperties = { ...superProperties, ...properties };
  registerCurrentSuperProperties();
}

export async function setAnalyticsPersonProperties(properties: AnalyticsPersonProperties) {
  if (!posthogClient) return false;
  posthogClient.identify(
    posthogClient.getDistinctId(),
    properties as unknown as AnalyticsProperties,
  );
  return true;
}

export async function syncPremiumAnalyticsStatus(isPremium: boolean) {
  registerAnalyticsProperties({ is_premium: isPremium });
  const [storedFirstVersion, storedPremiumStatus] = await Promise.all([
    AsyncStorage.getItem(FIRST_APP_VERSION_KEY),
    AsyncStorage.getItem(PERSON_PREMIUM_STATUS_KEY),
  ]);
  const firstAppVersion = storedFirstVersion ?? superProperties.app_version;
  if (!storedFirstVersion) {
    await AsyncStorage.setItem(FIRST_APP_VERSION_KEY, firstAppVersion);
  }
  if (storedPremiumStatus !== String(isPremium)) {
    const identified = await setAnalyticsPersonProperties({
      is_premium: isPremium,
      first_app_version: firstAppVersion,
    });
    if (identified) {
      await AsyncStorage.setItem(PERSON_PREMIUM_STATUS_KEY, String(isPremium));
    }
  }
}

export async function getPaywallViewContext(source: PaywallSource, now = Date.now()) {
  const [storedCount, storedInstallDate] = await Promise.all([
    AsyncStorage.getItem(PAYWALL_VIEW_COUNT_KEY),
    AsyncStorage.getItem(INSTALL_DATE_KEY),
  ]);
  const nthView = (storedCount ? Number.parseInt(storedCount, 10) : 0) + 1;
  const nativeInstallDate = storedInstallDate
    ? null
    : await Application.getInstallationTimeAsync().catch(() => null);
  const installDate = storedInstallDate
    ? Number.parseInt(storedInstallDate, 10)
    : (nativeInstallDate?.getTime() ?? now);
  await Promise.all([
    AsyncStorage.setItem(PAYWALL_VIEW_COUNT_KEY, String(nthView)),
    storedInstallDate
      ? Promise.resolve()
      : AsyncStorage.setItem(INSTALL_DATE_KEY, String(installDate)),
  ]);
  return {
    source,
    nth_view: nthView,
    days_since_install: Math.max(0, Math.floor((now - installDate) / (24 * 60 * 60 * 1000))),
  };
}

export async function getPaywallViewCount() {
  const stored = await AsyncStorage.getItem(PAYWALL_VIEW_COUNT_KEY);
  return Math.max(1, stored ? Number.parseInt(stored, 10) : 1);
}

export async function getNextRewardedChoiceCount() {
  const stored = await AsyncStorage.getItem(REWARDED_CHOICE_COUNT_KEY);
  const next = (stored ? Number.parseInt(stored, 10) : 0) + 1;
  await AsyncStorage.setItem(REWARDED_CHOICE_COUNT_KEY, String(next));
  return next;
}

export function trackScreen(screen: string, properties?: AnalyticsProperties) {
  const payload = sanitizeProperties({ ...superProperties, ...(properties ?? {}) });
  if (dryRunEnabled()) console.info('[analytics:dry-run:screen]', screen, JSON.stringify(payload));
  posthogClient?.screen(screen, payload);
}

export function resetAnalyticsIdentity() {
  if (!posthogClient) return;
  posthogClient.reset();
  registerCurrentSuperProperties();
}

export function flushAnalytics() {
  return posthogClient?.flush() ?? Promise.resolve();
}

export function setAnalyticsDryRunForTests(enabled: boolean | null) {
  dryRunOverride = enabled;
}

export function clearAnalyticsDryRunSink() {
  dryRunSink = [];
  coldOpenTracked = false;
}

export function getAnalyticsDryRunSink(): readonly AnalyticsDryRunCapture[] {
  return dryRunSink;
}
