import { describe, expect, it } from 'vitest';
import { evaluateExportFunnelDecision } from '../export-funnel-decision';

const releaseStartedAt = Date.UTC(2026, 7, 2);

describe('export funnel decision rule', () => {
  it('waits until 100 export clicks or 60 elapsed days, whichever happens first', () => {
    expect(
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 59 * 24 * 60 * 60 * 1000,
        exportClicked: 99,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 20,
        exportSheetAbandoned: 10,
        rewardedExportRequested: 10,
        freeRewardedExportSuccess: 1,
      }),
    ).toMatchObject({ decision: 'wait', thresholdReachedBy: null });
  });

  it('simplifies the sheet when abandonment is strictly above 30 percent', () => {
    expect(
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 10 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt + 10 * 24 * 60 * 60 * 1000,
        exportSheetOpened: 100,
        exportSheetAbandoned: 31,
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
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 80,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetAbandoned: 30,
        rewardedExportRequested: 100,
        freeRewardedExportSuccess: 59,
      }),
    ).toMatchObject({
      decision: 'revise_ad_gate_copy',
      thresholdReachedBy: 'elapsed_days',
      sheetAbandonmentRate: 0.3,
      adGateDropRate: 0.41,
    });
  });

  it('keeps the current flow at the strict boundaries or when both rates are lower', () => {
    expect(
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt,
        exportSheetOpened: 10,
        exportSheetAbandoned: 3,
        rewardedExportRequested: 10,
        freeRewardedExportSuccess: 6,
      }),
    ).toMatchObject({
      decision: 'keep_current_flow',
      sheetAbandonmentRate: 0.3,
      adGateDropRate: 0.4,
    });
  });

  it('uses zero rates when a denominator has no events', () => {
    expect(
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 0,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toMatchObject({
      decision: 'keep_current_flow',
      thresholdReachedBy: 'elapsed_days',
      sheetAbandonmentRate: 0,
      adGateDropRate: 0,
    });
  });

  it('attributes a delayed evaluation to the threshold that actually happened first', () => {
    expect(
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 70 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt + 65 * 24 * 60 * 60 * 1000,
        exportSheetOpened: 10,
        exportSheetAbandoned: 0,
        rewardedExportRequested: 10,
        freeRewardedExportSuccess: 10,
      }),
    ).toMatchObject({ decision: 'keep_current_flow', thresholdReachedBy: 'elapsed_days' });
  });

  it('requires the 100th-click timestamp once the click threshold is reached', () => {
    expect(() =>
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 70 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toThrow('timestamp do 100º export_clicked');
  });

  it('prioritizes simplifying the sheet when both rates breach their limits', () => {
    expect(
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 50,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 100,
        exportSheetAbandoned: 31,
        rewardedExportRequested: 100,
        freeRewardedExportSuccess: 50,
      }),
    ).toMatchObject({ decision: 'simplify_export_sheet' });
  });

  it('rejects impossible funnel counts instead of hiding tracking defects', () => {
    expect(() =>
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 60 * 24 * 60 * 60 * 1000,
        exportClicked: 10,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 1,
        exportSheetAbandoned: 2,
        rewardedExportRequested: 1,
        freeRewardedExportSuccess: 2,
      }),
    ).toThrow('contagens inconsistentes');
  });

  it('rejects a 100th-click timestamp outside the release evaluation window', () => {
    expect(() =>
      evaluateExportFunnelDecision({
        releaseStartedAt,
        evaluatedAt: releaseStartedAt + 70 * 24 * 60 * 60 * 1000,
        exportClicked: 100,
        exportClickThresholdReachedAt: releaseStartedAt - 1,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
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
      evaluateExportFunnelDecision({
        ...timestamps,
        exportClicked: 0,
        exportClickThresholdReachedAt: null,
        exportSheetOpened: 0,
        exportSheetAbandoned: 0,
        rewardedExportRequested: 0,
        freeRewardedExportSuccess: 0,
      }),
    ).toThrow('janela de avaliação inválida');
  });
});
