import type { PaywallSource } from './analytics';
import type { ExportAccess } from './exports/access';

export const POST_EXPORT_PAYWALL_SOURCE: PaywallSource = 'post_export';

interface PostExportPaywallGateInput {
  access: ExportAccess;
  hasShownThisSession: boolean;
  isPremium: boolean;
}

export function shouldShowPostExportPaywall({
  access,
  hasShownThisSession,
  isPremium,
}: PostExportPaywallGateInput) {
  return access === 'free_rewarded' && !isPremium && !hasShownThisSession;
}
