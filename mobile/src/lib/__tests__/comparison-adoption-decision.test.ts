import { describe, expect, it } from 'vitest';
import {
  evaluateComparisonAdoptionDecision,
  type ComparisonAdoptionSnapshot,
} from '../comparison-adoption-decision';

const DAY_MS = 24 * 60 * 60 * 1000;
const releaseStartedAt = Date.UTC(2026, 7, 10);

function snapshot(overrides: Partial<ComparisonAdoptionSnapshot> = {}): ComparisonAdoptionSnapshot {
  return {
    releaseStartedAt,
    evaluatedAt: releaseStartedAt + 30 * DAY_MS,
    savedScenarioUsers: 50,
    savedScenarioThresholdReachedAt: null,
    comparisonStartedAmongSavedUsers: 8,
    ...overrides,
  };
}

describe('comparison adoption decision', () => {
  it('waits before both the 100-user and 90-day thresholds', () => {
    expect(evaluateComparisonAdoptionDecision(snapshot())).toEqual({
      decision: 'wait',
      thresholdReachedBy: null,
      elapsedDays: 30,
      adoptionRate: null,
    });
  });

  it('folds comparison into the calculator when adoption is below 10%', () => {
    expect(
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 20 * DAY_MS,
          savedScenarioUsers: 100,
          comparisonStartedAmongSavedUsers: 9,
          savedScenarioThresholdReachedAt: releaseStartedAt + 20 * DAY_MS,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'fold_into_calculator',
        thresholdReachedBy: 'saved_scenario_users',
        adoptionRate: 0.09,
      }),
    );
  });

  it('keeps comparison at exactly 10% adoption', () => {
    expect(
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 20 * DAY_MS,
          savedScenarioUsers: 100,
          comparisonStartedAmongSavedUsers: 10,
          savedScenarioThresholdReachedAt: releaseStartedAt + 20 * DAY_MS,
        }),
      ).decision,
    ).toBe('keep_comparison');
  });

  it('decides after 90 days even below 100 saved-scenario users', () => {
    expect(
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 90 * DAY_MS,
          savedScenarioUsers: 40,
          comparisonStartedAmongSavedUsers: 3,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        decision: 'fold_into_calculator',
        thresholdReachedBy: 'elapsed_days',
        adoptionRate: 0.075,
      }),
    );
  });

  it('does not retire comparison without any saved-scenario users', () => {
    expect(
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 90 * DAY_MS,
          savedScenarioUsers: 0,
          comparisonStartedAmongSavedUsers: 0,
        }),
      ),
    ).toEqual({
      decision: 'wait',
      thresholdReachedBy: 'elapsed_days',
      elapsedDays: 90,
      adoptionRate: null,
    });
  });

  it('requires counts to stop at the first threshold', () => {
    expect(() =>
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 30 * DAY_MS,
          savedScenarioUsers: 100,
          savedScenarioThresholdReachedAt: releaseStartedAt + 20 * DAY_MS,
          comparisonStartedAmongSavedUsers: 9,
        }),
      ),
    ).toThrow(/primeiro limiar/i);

    expect(() =>
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 20 * DAY_MS,
          savedScenarioUsers: 101,
          savedScenarioThresholdReachedAt: releaseStartedAt + 20 * DAY_MS,
          comparisonStartedAmongSavedUsers: 9,
        }),
      ),
    ).toThrow(/exatamente 100/i);
  });

  it('rejects a 100-user timestamp before the threshold exists', () => {
    expect(() =>
      evaluateComparisonAdoptionDecision(
        snapshot({ savedScenarioThresholdReachedAt: releaseStartedAt + 20 * DAY_MS }),
      ),
    ).toThrow(/antes de 100/i);
  });

  it('requires the 100th-user timestamp and keeps it inside the release window', () => {
    expect(() =>
      evaluateComparisonAdoptionDecision(
        snapshot({ savedScenarioUsers: 100, comparisonStartedAmongSavedUsers: 9 }),
      ),
    ).toThrow(/100.*usu.rio/i);

    expect(() =>
      evaluateComparisonAdoptionDecision(
        snapshot({
          evaluatedAt: releaseStartedAt + 20 * DAY_MS,
          savedScenarioUsers: 100,
          savedScenarioThresholdReachedAt: releaseStartedAt - 1,
          comparisonStartedAmongSavedUsers: 9,
        }),
      ),
    ).toThrow(/janela p.s-release/i);
  });

  it('rejects impossible distinct-user snapshots', () => {
    expect(() =>
      evaluateComparisonAdoptionDecision(
        snapshot({ savedScenarioUsers: 5, comparisonStartedAmongSavedUsers: 6 }),
      ),
    ).toThrow(/contagens/i);
  });
});
