import type { CorrectionIndexType, Scenario } from '@loan-engine/loan';
import { getAnnualRateBucket, trackEvent } from './analytics';
import { getScenarioEntryMode } from './existing-contract';

export function getScenarioAnalyticsContext(scenario: Scenario, scheduleLength?: number) {
  const termMonths = scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term;
  const prepaymentCount = scenario.prepayments?.length ?? 0;
  const fgtsEventCount = scenario.fgtsEvents?.length ?? 0;
  const rateBucket = getAnnualRateBucket(scenario.rate, scenario.rateType);
  const principalBucket =
    scenario.principal < 100_000
      ? '<100k'
      : scenario.principal < 300_000
        ? '100-300k'
        : scenario.principal < 500_000
          ? '300-500k'
          : scenario.principal < 1_000_000
            ? '500k-1M'
            : '>1M';

  return {
    system: scenario.system,
    loan_mode: scenario.loanMode ?? 'standard',
    rate_type: scenario.rateType,
    rate_bucket: rateBucket,
    index_type: (scenario.indexType ?? 'none') as 'none' | CorrectionIndexType,
    term_unit: scenario.termUnit,
    term_value: scenario.term,
    term_months: termMonths,
    principal_bucket: principalBucket as '<100k' | '100-300k' | '300-500k' | '500k-1M' | '>1M',
    has_prepayments: prepaymentCount > 0,
    prepayment_count: prepaymentCount,
    has_fgts: fgtsEventCount > 0,
    fgts_event_count: fgtsEventCount,
    has_insurance: Boolean(
      scenario.includeInsurance &&
      ((scenario.mipRate ?? scenario.insuranceRate ?? 0) > 0 || (scenario.dfiRate ?? 0) > 0),
    ),
    has_admin_fee: Boolean(
      scenario.includeAdminFee &&
      ((scenario.adminFee ?? 0) > 0 || (scenario.adminFeeRate ?? 0) > 0),
    ),
    has_iof: Boolean(scenario.includeIOF && (scenario.iofRate ?? 0) > 0),
    entry_mode: getScenarioEntryMode(scenario),
    effective_installments:
      typeof scheduleLength === 'number' ? Math.max(scheduleLength - 1, 0) : termMonths,
  };
}

export function trackCalculationPerformed(scenario: Scenario, scheduleLength: number) {
  const context = getScenarioAnalyticsContext(scenario, scheduleLength);
  trackEvent('calculation_performed', {
    system: context.system,
    loan_mode: context.loan_mode,
    rate_type: context.rate_type,
    rate_bucket: context.rate_bucket,
    term_months: context.term_months,
    principal_bucket: context.principal_bucket,
    prepayment_count: context.prepayment_count,
    fgts_event_count: context.fgts_event_count,
    index_type: context.index_type,
    has_insurance: context.has_insurance,
    has_admin_fee: context.has_admin_fee,
    has_iof: context.has_iof,
    entry_mode: context.entry_mode,
  });
}

export function trackPortabilityCompared(breakEvenMonth: number | null) {
  trackEvent('portability_compared', {
    has_break_even: breakEvenMonth !== null,
    ...(breakEvenMonth === null ? {} : { break_even_month: breakEvenMonth }),
  });
}
