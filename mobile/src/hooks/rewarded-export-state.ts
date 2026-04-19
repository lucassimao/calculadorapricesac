import type { ExportFormat } from '../lib/exports/access';

export const REWARDED_EXPORT_TIMEOUT_MS = 15_000;

export type TabActionExportPhase = 'idle' | 'rewarded' | 'exporting';

export function canUseRewardedExportPlacement({
  enabled,
  adTestLoading,
  isPremium,
  stubModeEnabled,
  rewardedUnitId,
}: {
  enabled: boolean;
  adTestLoading: boolean;
  isPremium: boolean;
  stubModeEnabled: boolean;
  rewardedUnitId: string | null;
}) {
  if (adTestLoading || isPremium) return false;
  if (stubModeEnabled) return true;
  return enabled && rewardedUnitId !== null;
}

export function shouldLoadPendingRewardedRequest({
  pendingFormat,
  canUseRealRewarded,
  isLoaded,
  isOpened,
}: {
  pendingFormat: ExportFormat | null;
  canUseRealRewarded: boolean;
  isLoaded: boolean;
  isOpened: boolean;
}) {
  return pendingFormat !== null && canUseRealRewarded && !isLoaded && !isOpened;
}

export function shouldStartRewardedTimeout({
  pendingFormat,
  canUseRealRewarded,
  isOpened,
}: {
  pendingFormat: ExportFormat | null;
  canUseRealRewarded: boolean;
  isOpened: boolean;
}) {
  return pendingFormat !== null && canUseRealRewarded && !isOpened;
}

export function isTabActionExportBusy(phase: TabActionExportPhase) {
  return phase !== 'idle';
}

export function shouldResetTabActionExportPhase({
  phase,
  rewardedExportFormat,
  exporting,
}: {
  phase: TabActionExportPhase;
  rewardedExportFormat: ExportFormat | null;
  exporting: boolean;
}) {
  return phase === 'rewarded' && rewardedExportFormat === null && !exporting;
}
