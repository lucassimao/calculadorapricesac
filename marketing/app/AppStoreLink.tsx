'use client';

import { track } from '@vercel/analytics';

type AppStoreLinkProps = {
  href: string;
  /** Where on the page the button lives, e.g. "hero", "cta", "simulator". */
  location: string;
  className?: string;
  children: React.ReactNode;
};

// Google Ads conversion target, e.g. "AW-XXXXXXXXX/abcdEFGhij". No-op until set.
const GADS_CONVERSION = process.env.NEXT_PUBLIC_GADS_CONVERSION;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * App Store download button. Fires a Vercel Analytics event and (when configured)
 * a Google Ads conversion on click, so the Search campaign can optimize on installs.
 */
export function AppStoreLink({ href, location, className, children }: AppStoreLinkProps) {
  const handleClick = () => {
    track('app_store_click', { location });
    if (GADS_CONVERSION && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', { send_to: GADS_CONVERSION });
    }
  };
  return (
    <a className={className} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
