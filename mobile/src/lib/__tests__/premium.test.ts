import { describe, expect, it } from 'vitest';
import { shouldShowAds } from '../premium';

describe('shouldShowAds', () => {
  it('hides ads while premium status is loading', () => {
    expect(shouldShowAds(false, true)).toBe(false);
  });

  it('hides ads for premium users', () => {
    expect(shouldShowAds(true, false)).toBe(false);
  });

  it('shows ads only for non-premium users after loading completes', () => {
    expect(shouldShowAds(false, false)).toBe(true);
  });
});
