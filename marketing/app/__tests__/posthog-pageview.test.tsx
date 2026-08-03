import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capturePageView, initializeMarketingAnalytics } = vi.hoisted(() => ({
  capturePageView: vi.fn(),
  initializeMarketingAnalytics: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({ capturePageView, initializeMarketingAnalytics }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/guias',
  useSearchParams: () => new URLSearchParams('page=1'),
}));

import { PostHogAnalytics } from '../posthog-analytics';

describe('PostHog pageview tracker', () => {
  beforeEach(() => {
    capturePageView.mockClear();
    initializeMarketingAnalytics.mockClear();
  });

  it('initializes and captures a pageview for the current route', () => {
    render(<PostHogAnalytics />);

    expect(initializeMarketingAnalytics).toHaveBeenCalledOnce();
    expect(capturePageView).toHaveBeenCalledOnce();
  });
});
