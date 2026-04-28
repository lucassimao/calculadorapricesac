import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { JsonType } from '@posthog/core';
import { PostHog } from 'posthog-react-native';

type AnalyticsProperties = Record<string, JsonType>;

export interface IdentityProperties {
  email?: string;
  phone?: string;
  name?: string;
  registration?: string;
  website?: string;
}

const extra = Constants.expoConfig?.extra ?? {};
const apiKey =
  typeof extra.posthogApiKey === 'string' && extra.posthogApiKey.trim().length > 0
    ? extra.posthogApiKey.trim()
    : '';
const host =
  typeof extra.posthogHost === 'string' && extra.posthogHost.trim().length > 0
    ? extra.posthogHost.trim()
    : 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;
const posthogEnabled = !__DEV__ && apiKey.length > 0;

function getBaseAnalyticsProperties(): AnalyticsProperties {
  return {
    app_version: Constants.expoConfig?.version ?? 'unknown',
    app_platform: Platform.OS,
  };
}

function registerBaseAnalyticsProperties() {
  posthogClient?.register(getBaseAnalyticsProperties());
}

if (posthogEnabled) {
  posthogClient = new PostHog(apiKey, {
    host,
    captureAppLifecycleEvents: true,
  });

  registerBaseAnalyticsProperties();
}

export function analyticsEnabled() {
  return posthogClient !== null;
}

export function trackEvent(event: string, properties?: AnalyticsProperties) {
  posthogClient?.capture(event, properties);
}

export function registerAnalyticsProperties(properties: AnalyticsProperties) {
  posthogClient?.register(properties);
}

export function trackScreen(screen: string, properties?: AnalyticsProperties) {
  posthogClient?.screen(screen, properties);
}

function compactIdentityProperties(properties: IdentityProperties): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== ''),
  ) as AnalyticsProperties;
}

export async function identifyUser(properties: IdentityProperties) {
  if (!posthogClient) return;

  posthogClient.identify(posthogClient.getDistinctId(), compactIdentityProperties(properties));
}

export function resetAnalyticsIdentity() {
  if (!posthogClient) return;

  posthogClient.reset();
  registerBaseAnalyticsProperties();
}

export function flushAnalytics() {
  return posthogClient?.flush() ?? Promise.resolve();
}
