'use client';

import { track } from '@vercel/analytics';

type AppStoreLinkProps = {
  href: string;
  /** Where on the page the button lives, e.g. "hero" or "cta". */
  location: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * App Store download button that reports a custom Vercel Analytics event on
 * click, so we can measure landing-page → store conversion by placement.
 */
export function AppStoreLink({ href, location, className, children }: AppStoreLinkProps) {
  return (
    <a
      className={className}
      href={href}
      onClick={() => track('app_store_click', { location })}
    >
      {children}
    </a>
  );
}
