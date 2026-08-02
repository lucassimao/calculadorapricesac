const EXPORT_CLICK_THRESHOLD = 100;
const ELAPSED_DAY_THRESHOLD = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExportFunnelSnapshot {
  releaseStartedAt: number;
  evaluatedAt: number;
  exportClicked: number;
  exportClickThresholdReachedAt: number | null;
  exportSheetOpened: number;
  exportSheetAbandoned: number;
  rewardedExportRequested: number;
  freeRewardedExportSuccess: number;
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
  sheetAbandonmentRate: number;
  adGateDropRate: number;
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
    snapshot.exportSheetAbandoned,
    snapshot.rewardedExportRequested,
    snapshot.freeRewardedExportSuccess,
  ];
  if (eventCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Informe contagens inteiras não negativas.');
  }
  if (
    snapshot.exportSheetAbandoned > snapshot.exportSheetOpened ||
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
  const sheetAbandonmentRate = rate(snapshot.exportSheetAbandoned, snapshot.exportSheetOpened);
  const adGateDropRate = rate(
    snapshot.rewardedExportRequested - snapshot.freeRewardedExportSuccess,
    snapshot.rewardedExportRequested,
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

  const decision =
    sheetAbandonmentRate > 0.3
      ? 'simplify_export_sheet'
      : adGateDropRate > 0.4
        ? 'revise_ad_gate_copy'
        : 'keep_current_flow';

  return {
    decision,
    thresholdReachedBy,
    elapsedDays,
    sheetAbandonmentRate,
    adGateDropRate,
  };
}
