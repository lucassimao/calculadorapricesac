export const EXPORT_CLICK_THRESHOLD = 100;
export const ELAPSED_DAY_THRESHOLD = 60;
export const SHEET_ABANDONMENT_THRESHOLD = 0.3;
export const AD_GATE_DROP_THRESHOLD = 0.4;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExportFunnelSnapshot {
  releaseStartedAt: number;
  evaluatedAt: number;
  exportClicked: number;
  exportClickThresholdReachedAt: number | null;
  exportSheetOpened: number;
  exportSheetBlocked: number;
  exportSheetUpgradeSelected: number;
  exportSheetAbandoned: number;
  freeRewardedExportClicked: number;
  rewardedExportRequested: number;
  freeRewardedExportSuccess: number;
  /** Whether the rewarded placement was enabled during this evaluation window. */
  rewardedExportEnabled?: boolean;
}

export type ExportFunnelDecision =
  | 'wait'
  | 'simplify_export_sheet'
  | 'revise_ad_gate_copy'
  | 'keep_current_flow';

export interface ExportFunnelDecisionResult {
  decision: ExportFunnelDecision;
  thresholdReachedBy: 'export_clicked' | 'elapsed_days' | null;
  elapsedDays: number;
  sheetAbandonmentRate: number | null;
  adGateDropRate: number | null;
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function evaluateExportFunnelDecision(
  snapshot: ExportFunnelSnapshot,
): ExportFunnelDecisionResult {
  if (
    !Number.isFinite(snapshot.releaseStartedAt) ||
    !Number.isFinite(snapshot.evaluatedAt) ||
    snapshot.evaluatedAt < snapshot.releaseStartedAt
  ) {
    throw new Error('Informe uma janela de avaliação inválida.');
  }
  const eventCounts = [
    snapshot.exportClicked,
    snapshot.exportSheetOpened,
    snapshot.exportSheetBlocked,
    snapshot.exportSheetUpgradeSelected,
    snapshot.exportSheetAbandoned,
    snapshot.freeRewardedExportClicked,
    snapshot.rewardedExportRequested,
    snapshot.freeRewardedExportSuccess,
  ];
  if (eventCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Informe contagens inteiras não negativas.');
  }
  if (snapshot.exportClickThresholdReachedAt === undefined) {
    throw new Error('Informe exportClickThresholdReachedAt como timestamp ou null.');
  }
  if (
    snapshot.exportSheetAbandoned +
      snapshot.exportSheetBlocked +
      snapshot.exportSheetUpgradeSelected >
      snapshot.exportSheetOpened ||
    snapshot.freeRewardedExportSuccess > snapshot.freeRewardedExportClicked ||
    snapshot.freeRewardedExportSuccess > snapshot.rewardedExportRequested
  ) {
    throw new Error('Há contagens inconsistentes no snapshot do funil.');
  }
  if (
    snapshot.exportClicked >= EXPORT_CLICK_THRESHOLD &&
    snapshot.exportClickThresholdReachedAt === null
  ) {
    throw new Error('Informe o timestamp do 100º export_clicked.');
  }
  if (
    snapshot.exportClickThresholdReachedAt !== null &&
    (!Number.isFinite(snapshot.exportClickThresholdReachedAt) ||
      snapshot.exportClickThresholdReachedAt < snapshot.releaseStartedAt ||
      snapshot.exportClickThresholdReachedAt > snapshot.evaluatedAt)
  ) {
    throw new Error('O timestamp do 100º export_clicked deve estar na janela pós-release.');
  }

  const elapsedDays = Math.max(
    0,
    Math.floor((snapshot.evaluatedAt - snapshot.releaseStartedAt) / DAY_MS),
  );
  const measurableSheetOpened =
    snapshot.exportSheetOpened - snapshot.exportSheetBlocked - snapshot.exportSheetUpgradeSelected;
  const sheetAbandonmentRate =
    measurableSheetOpened === 0 ? null : rate(snapshot.exportSheetAbandoned, measurableSheetOpened);
  const adGateDropRate =
    snapshot.freeRewardedExportClicked === 0
      ? null
      : rate(
          snapshot.freeRewardedExportClicked - snapshot.freeRewardedExportSuccess,
          snapshot.freeRewardedExportClicked,
        );
  const elapsedDayThresholdAt = snapshot.releaseStartedAt + ELAPSED_DAY_THRESHOLD * DAY_MS;
  const exportClickThresholdAt =
    snapshot.exportClicked >= EXPORT_CLICK_THRESHOLD
      ? snapshot.exportClickThresholdReachedAt
      : null;
  const firstThresholdAt =
    exportClickThresholdAt === null
      ? elapsedDayThresholdAt
      : Math.min(exportClickThresholdAt, elapsedDayThresholdAt);
  const thresholdReachedBy =
    snapshot.evaluatedAt < firstThresholdAt
      ? null
      : exportClickThresholdAt !== null && exportClickThresholdAt <= elapsedDayThresholdAt
        ? ('export_clicked' as const)
        : ('elapsed_days' as const);

  if (thresholdReachedBy === null) {
    return {
      decision: 'wait',
      thresholdReachedBy,
      elapsedDays,
      sheetAbandonmentRate,
      adGateDropRate,
    };
  }

  let decision: ExportFunnelDecision;
  if (sheetAbandonmentRate !== null && sheetAbandonmentRate > SHEET_ABANDONMENT_THRESHOLD) {
    decision = 'simplify_export_sheet';
  } else {
    if (snapshot.freeRewardedExportClicked === 0) {
      if (snapshot.rewardedExportEnabled === false) {
        decision = 'keep_current_flow';
      } else {
        throw new Error(
          'Há dados de produção insuficientes para decidir: confirme os denominadores do funil.',
        );
      }
    } else {
      decision =
        adGateDropRate !== null && adGateDropRate > AD_GATE_DROP_THRESHOLD
          ? 'revise_ad_gate_copy'
          : 'keep_current_flow';
    }
  }

  return {
    decision,
    thresholdReachedBy,
    elapsedDays,
    sheetAbandonmentRate,
    adGateDropRate,
  };
}
