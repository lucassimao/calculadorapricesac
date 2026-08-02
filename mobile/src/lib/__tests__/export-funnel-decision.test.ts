import { describe, expect, it } from 'vitest';
import { evaluateExportFunnelDecision, type ExportFunnelSnapshot } from '../export-funnel-decision';

const releaseStartedAt = Date.UTC(2026, 7, 2);

function evaluate(
  snapshot: Omit<ExportFunnelSnapshot, 'exportSheetBlocked' | 'exportSheetUpgradeSelected'> & {
    exportSheetBlocked?: number;
    exportSheetUpgradeSelected?: number;
  },
) {
  return evaluateExportFunnelDecision({
    exportSheetBlocked: 0,
    exportSheetUpgradeSelected: 0,
    ...snapshot,
  });
}

describe('export funnel decision rule', () => {
  it('waits until 100 export clicks or 60 elapsed days, whichever happens first', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 59 * 24 * 60 * 60 * 1000,
        exportClicked: 99,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 20,
        exportSheetAbandoned: 10,
        freeRewardedExportClicked: 10,
        rewardedExportRequested: 10,
        freeRewardedExportSuccess: 1,
      }),
    ).toMatchObject({ decision: 'wait', thresholdReachedBy: null });
  });

  it('simplifies the sheet when abandonment is strictly above 30 percent', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 10 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt + 10 * 24 * 60 * 60 * 1000,
        exportSheetOpened: 100,
        exportSheetAbandoned: 31,
        freeRewardedExportClicked: 50,
        rewardedExportRequested: 50,
        freeRewardedExportSuccess: 50,
      }),
    ).toMatchObject({
      decision: 'simplify_export_sheet',
      thresholdReachedBy: 'export_clicked',
      sheetAbandonmentRate: 0.31,
    });
  });

  it('revises gate copy after 60 days when abandonment is not above 30 percent and ad drop is above 40 percent', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 80,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetAbandoned: 30,
        freeRewardedExportClicked: 100,
        rewardedExportRequested: 40,
        freeRewardedExportSuccess: 40,
      }),
    ).toMatchObject({
      decision: 'revise_ad_gate_copy',
      thresholdReachedBy: 'elapsed_days',
      sheetAbandonmentRate: 0.3,
      adGateDropRate: 0.6,
    });
  });

  it('keeps the current flow at the strict boundaries or when both rates are lower', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt,
        exportSheetOpened: 10,
        exportSheetAbandoned: 3,
        freeRewardedExportClicked: 10,
        rewardedExportRequested: 10,
        freeRewardedExportSuccess: 6,
      }),
    ).toMatchObject({
      decision: 'keep_current_flow',
      sheetAbandonmentRate: 0.3,
      adGateDropRate: 0.4,
    });
  });

  it('excludes blocked sheets from the abandonment denominator', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 50,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetBlocked: 50,
        exportSheetAbandoned: 20,
        freeRewardedExportClicked: 50,
        rewardedExportRequested: 50,
        freeRewardedExportSuccess: 50,
      }),
    ).toMatchObject({ decision: 'simplify_export_sheet', sheetAbandonmentRate: 0.4 });
  });

  it('excludes explicit sheet upgrades from the abandonment denominator', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 50,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetBlocked: 0,
        exportSheetUpgradeSelected: 50,
        exportSheetAbandoned: 20,
        freeRewardedExportClicked: 50,
        rewardedExportRequested: 50,
        freeRewardedExportSuccess: 50,
      }),
    ).toMatchObject({ decision: 'simplify_export_sheet', sheetAbandonmentRate: 0.4 });
  });

  it('reports undefined rates as null while still waiting for the decision threshold', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt,
        exportClicked: 0,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetBlocked: 0,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toMatchObject({
      decision: 'wait',
      sheetAbandonmentRate: null,
      adGateDropRate: null,
    });
  });

  it('uses a decisive gate signal when all threshold clicks came from outside the sheet', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 10 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt + 10 * 24 * 60 * 60 * 1000,
        exportSheetOpened: 0,
        exportSheetBlocked: 0,
        exportSheetUpgradeSelected: 0,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 90,
        rewardedExportRequested: 80,
        freeRewardedExportSuccess: 20,
      }),
    ).toMatchObject({
      decision: 'revise_ad_gate_copy',
      sheetAbandonmentRate: null,
      adGateDropRate: 70 / 90,
    });
  });

  it('rejects a final decision when the measured funnels have no denominator', () => {
    expect(() =>
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 0,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toThrow('dados de produção insuficientes');
  });

  it('attributes a delayed evaluation to the threshold that actually happened first', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 70 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt + 65 * 24 * 60 * 60 * 1000,
        exportSheetOpened: 10,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 10,
        rewardedExportRequested: 10,
        freeRewardedExportSuccess: 10,
      }),
    ).toMatchObject({ decision: 'keep_current_flow', thresholdReachedBy: 'elapsed_days' });
  });

  it('requires the 100th-click timestamp once the click threshold is reached', () => {
    expect(() =>
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 70 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toThrow('timestamp do 100º export_clicked');
  });

  it('prioritizes simplifying the sheet when both rates breach their limits', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 50,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetAbandoned: 31,
        freeRewardedExportClicked: 100,
        rewardedExportRequested: 100,
        freeRewardedExportSuccess: 50,
      }),
    ).toMatchObject({ decision: 'simplify_export_sheet' });
  });

  it('can simplify a decisively abandoned sheet before the ad gate has a denominator', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 50,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetAbandoned: 31,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toMatchObject({ decision: 'simplify_export_sheet' });
  });

  it('keeps the flow when the rewarded gate is disabled and therefore has no denominator', () => {
    expect(
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 50,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetAbandoned: 20,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
        rewardedExportEnabled: false,
      }),
    ).toMatchObject({ decision: 'keep_current_flow', adGateDropRate: null });
  });

  it('reports a missing click-threshold timestamp field as missing, not out of range', () => {
    expect(() =>
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt,
        exportClicked: 1,
        exportSheetOpened: 1,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 1,
        rewardedExportRequested: 1,
        freeRewardedExportSuccess: 1,
      } as Parameters<typeof evaluateExportFunnelDecision>[0]),
    ).toThrow('exportClickThresholdReachedAt');
  });

  it('rejects impossible funnel counts instead of hiding tracking defects', () => {
    expect(() =>
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 10,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 1,
        exportSheetAbandoned: 2,
        freeRewardedExportClicked: 1,
        rewardedExportRequested: 1,
        freeRewardedExportSuccess: 2,
      }),
    ).toThrow('contagens inconsistentes');
  });

  it('rejects a 100th-click timestamp outside the release evaluation window', () => {
    expect(() =>
      evaluate({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 70 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt - 1,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toThrow('janela pós-release');
  });

  it.each([
    { releaseStartedAt, evaluatedAt: releaseStartedAt - 1 },
    { releaseStartedAt: Number.NaN, evaluatedAt: releaseStartedAt },
    { releaseStartedAt, evaluatedAt: Number.POSITIVE_INFINITY },
  ])('rejects an invalid release evaluation window', (timestamps) => {
    expect(() =>
      evaluate({
        ...timestamps,
        exportClicked: 0,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        freeRewardedExportClicked: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toThrow('janela de avaliação inválida');
  });
});
