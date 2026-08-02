import type { PaywallSource } from './analytics';

export const FREE_SCENARIO_LIMIT = 1;
export const SCENARIO_LIMIT_PAYWALL_SOURCE: PaywallSource = 'scenario_limit';

interface ScenarioSaveGateInput {
  isPremium: boolean;
  isExistingScenario: boolean;
  savedScenarioCount: number;
}

export function getScenarioSaveGate({
  isPremium,
  isExistingScenario,
  savedScenarioCount,
}: ScenarioSaveGateInput): 'allow' | 'scenario_limit_paywall' {
  if (!isPremium && !isExistingScenario && savedScenarioCount >= FREE_SCENARIO_LIMIT) {
    return 'scenario_limit_paywall';
  }
  return 'allow';
}
