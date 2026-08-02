export const IAP_PRODUCT_ID = 'remove_ads';
export const IAP_FALLBACK_PRICE = 'R$ 24,90';

interface ResolveIapPriceLabelOptions {
  connected: boolean;
  localizedStorePrice?: string | null;
}

export function resolveIapPriceLabel({
  connected,
  localizedStorePrice,
}: ResolveIapPriceLabelOptions): string | null {
  const normalizedStorePrice = localizedStorePrice?.trim();
  if (normalizedStorePrice) return normalizedStorePrice;
  return connected ? null : IAP_FALLBACK_PRICE;
}
