'use client';

import posthog from 'posthog-js';

type MarketingEventMap = {
  $pageview: undefined;
  simulator_interacted: undefined;
  app_store_click: { location: string };
};

let initialized = false;

function getPostHogKey() {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function isConfigured() {
  return Boolean(getPostHogKey());
}

export function initializeMarketingAnalytics() {
  const key = getPostHogKey();
  if (!key || initialized || typeof window === 'undefined') return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,
    autocapture: false,
  });
  initialized = true;
}

export function captureMarketingEvent<Event extends keyof MarketingEventMap>(
  event: Event,
  properties?: MarketingEventMap[Event],
) {
  if (!isConfigured()) return;
  if (properties === undefined) {
    posthog.capture(event);
    return;
  }
  posthog.capture(event, properties);
}

export function capturePageView() {
  captureMarketingEvent('$pageview');
}
