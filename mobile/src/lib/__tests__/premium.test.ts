import { describe, expect, it } from 'vitest';
import { IAP_FALLBACK_PRICE, resolveIapPriceLabel } from '../iap';
import { shouldShowAds } from '../premium';

describe('resolveIapPriceLabel', () => {
  it('uses the localized store product price when it is available', () => {
    expect(
      resolveIapPriceLabel({
        connected: true,
        localizedStorePrice: '  US$ 4.99  ',
      }),
    ).toBe('US$ 4.99');
  });

  it('does not invent a price while a connected store has not returned the product', () => {
    expect(
      resolveIapPriceLabel({
        connected: true,
        localizedStorePrice: undefined,
      }),
    ).toBeNull();
  });

  it('uses the fallback only when the store is unreachable', () => {
    expect(
      resolveIapPriceLabel({
        connected: false,
        localizedStorePrice: undefined,
      }),
    ).toBe(IAP_FALLBACK_PRICE);
  });
});

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
