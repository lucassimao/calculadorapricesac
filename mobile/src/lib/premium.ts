export function shouldShowAds(isPremium: boolean, loading = false) {
  return !loading && !isPremium;
}
