import type { Scenario } from '../types/loan';

export function buildQuickComparisonScenario(baseAmount: number, scenario: Scenario): Scenario {
  const downPayment = scenario.downPayment ?? 0;
  return {
    ...scenario,
    loanMode: 'property',
    propertyValue: baseAmount,
    principal: Math.max(baseAmount - downPayment, 0),
  };
}
