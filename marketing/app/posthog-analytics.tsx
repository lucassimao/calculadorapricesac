'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capturePageView, initializeMarketingAnalytics } from './lib/analytics';

export function PostHogAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams?.toString() ?? ''}`;
  const lastTrackedRoute = useRef<string | null>(null);

  useEffect(() => {
    initializeMarketingAnalytics();
  }, []);

  useEffect(() => {
    if (lastTrackedRoute.current === route) return;
    lastTrackedRoute.current = route;
    capturePageView();
  }, [route]);

  return null;
}
