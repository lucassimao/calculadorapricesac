import { describe, expect, it } from 'vitest';

import {
  canStartExportAttempt,
  claimExportClick,
  resolveIosExportSheetOutcome,
  shouldTrackExportSheetAbandoned,
} from '../export-sheet-outcome';

describe('export sheet outcomes', () => {
  it.each([
    ['blocked_busy', false],
    ['blocked_unavailable', false],
    ['blocked_validation', false],
    ['cancel', true],
    ['dismiss', true],
    ['export', false],
    ['upgrade', false],
  ] as const)(
    'classifies %s without treating Premium intent as abandonment',
    (outcome, expected) => {
      expect(shouldTrackExportSheetAbandoned(outcome)).toBe(expected);
    },
  );

  it('does not mistake the Premium CSV index for an upgrade button', () => {
    expect(
      resolveIosExportSheetOutcome({
        buttonIndex: 3,
        cancelButtonIndex: 4,
        premiumButtonIndex: 3,
        hasPremiumOption: false,
        optionCount: 5,
      }),
    ).toBe('export');
    expect(
      resolveIosExportSheetOutcome({
        buttonIndex: 3,
        cancelButtonIndex: 4,
        premiumButtonIndex: 3,
        hasPremiumOption: true,
        optionCount: 5,
      }),
    ).toBe('upgrade');
  });

  it.each([-1, 5, Number.NaN])('treats an invalid iOS button index as a dismiss', (buttonIndex) => {
    expect(
      resolveIosExportSheetOutcome({
        buttonIndex,
        cancelButtonIndex: 4,
        premiumButtonIndex: 3,
        hasPremiumOption: true,
        optionCount: 5,
      }),
    ).toBe('dismiss');
  });

  it('claims an export click synchronously before React state can update', () => {
    const lock = { current: false };

    expect(claimExportClick(lock, false)).toBe(true);
    expect(claimExportClick(lock, false)).toBe(false);
    expect(lock.current).toBe(true);
  });

  it('rejects an export attempt before the gate when scenario validation has errors', () => {
    expect(canStartExportAttempt(1)).toBe(false);
    expect(canStartExportAttempt(0)).toBe(true);
  });
});
