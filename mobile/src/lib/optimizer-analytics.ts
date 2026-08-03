import type { OptimizerGoal } from '@loan-engine/calculations/optimizer';
import { setPendingPaywallSource, trackEvent } from './analytics';

type OptimizerEntryPoint = 'prepayment_section' | 'saved_scenarios';

function getMoneyBucket(value: number) {
  if (value <= 0) return 'none';
  if (value < 1_000) return '<1k';
  if (value < 5_000) return '1-5k';
  if (value < 20_000) return '5-20k';
  return '20k+';
}

export function trackOptimizerOpened(entryPoint: OptimizerEntryPoint) {
  trackEvent('optimizer_opened', { entry_point: entryPoint });
}

export function trackOptimizerPlanGenerated({
  goal,
  budget,
  horizonMonths,
  interestSaved,
}: {
  goal: OptimizerGoal;
  budget: number;
  horizonMonths: number;
  interestSaved: number;
}) {
  trackEvent('optimizer_plan_generated', {
    goal,
    budget_bucket: getMoneyBucket(budget),
    horizon_months: horizonMonths,
    interest_saved_bucket: getMoneyBucket(interestSaved),
  });
}

export function trackOptimizerPlanSaved(goal: OptimizerGoal) {
  trackEvent('optimizer_plan_saved', { goal });
}

export function openOptimizerPremiumPaywall() {
  setPendingPaywallSource('prepayment_optimizer');
}
