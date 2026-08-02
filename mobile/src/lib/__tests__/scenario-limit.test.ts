import { describe, expect, it } from 'vitest';
import {
  FREE_SCENARIO_LIMIT,
  SCENARIO_LIMIT_PAYWALL_SOURCE,
  getScenarioSaveGate,
} from '../scenario-limit';

describe('scenario save gate', () => {
  it('opens the scenario-limit paywall when a free user tries to add beyond the cap', () => {
    expect(
      getScenarioSaveGate({
        isPremium: false,
        isExistingScenario: false,
        savedScenarioCount: FREE_SCENARIO_LIMIT,
      }),
    ).toBe('scenario_limit_paywall');
    expect(SCENARIO_LIMIT_PAYWALL_SOURCE).toBe('scenario_limit');
  });

  it('allows premium users and updates to existing free scenarios', () => {
    expect(
      getScenarioSaveGate({
        isPremium: true,
        isExistingScenario: false,
        savedScenarioCount: FREE_SCENARIO_LIMIT,
      }),
    ).toBe('allow');
    expect(
      getScenarioSaveGate({
        isPremium: false,
        isExistingScenario: true,
        savedScenarioCount: FREE_SCENARIO_LIMIT,
      }),
    ).toBe('allow');
  });

  it('allows a free user to save up to the cap', () => {
    expect(
      getScenarioSaveGate({
        isPremium: false,
        isExistingScenario: false,
        savedScenarioCount: FREE_SCENARIO_LIMIT - 1,
      }),
    ).toBe('allow');
  });
});
