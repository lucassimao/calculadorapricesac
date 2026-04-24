import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { JsonType } from '@posthog/core';
import { PostHog } from 'posthog-react-native';

type AnalyticsProperties = Record<string, JsonType>;

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

if (posthogEnabled) {
  posthogClient = new PostHog(apiKey, {
    host,
    captureAppLifecycleEvents: true,
    disabled: false,
  });

  posthogClient.register({
    app_version: Constants.expoConfig?.version ?? 'unknown',
    app_platform: Platform.OS,
  });
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

export function identifyUser(distinctId: string, properties?: AnalyticsProperties) {
  posthogClient?.identify(distinctId, properties);
}

export function flushAnalytics() {
  return posthogClient?.flush() ?? Promise.resolve();
}
