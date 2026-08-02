import { describe, expect, it } from 'vitest';
import { POST_EXPORT_PAYWALL_SOURCE, shouldShowPostExportPaywall } from '../post-export-paywall';

describe('post-export paywall session gate', () => {
  it('shows after the first free rewarded export in a session', () => {
    expect(
      shouldShowPostExportPaywall({
        access: 'free_rewarded',
        isPremium: false,
        hasShownThisSession: false,
      }),
    ).toBe(true);
    expect(POST_EXPORT_PAYWALL_SOURCE).toBe('post_export');
  });

  it('does not show more than once in a session', () => {
    expect(
      shouldShowPostExportPaywall({
        access: 'free_rewarded',
        isPremium: false,
        hasShownThisSession: true,
      }),
    ).toBe(false);
  });

  it('never shows for premium or non-rewarded exports', () => {
    expect(
      shouldShowPostExportPaywall({
        access: 'free_rewarded',
        isPremium: true,
        hasShownThisSession: false,
      }),
    ).toBe(false);
    expect(
      shouldShowPostExportPaywall({
        access: 'premium',
        isPremium: false,
        hasShownThisSession: false,
      }),
    ).toBe(false);
  });
});
