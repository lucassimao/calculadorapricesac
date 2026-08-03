import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    init: vi.fn(),
  },
}));

import posthog from 'posthog-js';
import {
  captureMarketingEvent,
  capturePageView,
  initializeMarketingAnalytics,
} from '../lib/analytics';

describe('marketing PostHog analytics', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
    vi.clearAllMocks();
  });

  it('initializes without automatic pageviews and captures the canonical pageview event', () => {
    initializeMarketingAnalytics();
    capturePageView();

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ capture_pageview: false }),
    );
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('captures only declared funnel events with their allowed properties', () => {
    captureMarketingEvent('simulator_interacted');
    captureMarketingEvent('app_store_click', { location: 'hero' });

    expect(posthog.capture).toHaveBeenNthCalledWith(1, 'simulator_interacted');
    expect(posthog.capture).toHaveBeenNthCalledWith(2, 'app_store_click', { location: 'hero' });
  });

  it('does not send events when the public key is not configured', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    initializeMarketingAnalytics();
    capturePageView();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
