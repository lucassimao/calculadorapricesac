import type { JsonType } from '@posthog/core';

export type AnalyticsProperties = Record<string, JsonType>;

export type PaywallSource =
  | 'premium_tab'
  | 'scenario_limit'
  | 'post_export'
  | 'export_upgrade'
  | 'amortizar_investir'
  | 'prepayment_optimizer'
  | 'onboarding';

export type RewardedFailureKind = 'no_fill' | 'load_timeout' | 'network' | 'unknown';

type ScenarioContext = {
  system?: 'SAC' | 'PRICE';
  loan_mode?: 'standard' | 'property';
  rate_type?: 'monthly' | 'annual';
  rate_bucket?: '<9' | '9-11' | '11-13' | '>13';
  index_type?: 'none' | 'TR' | 'IPCA';
  term_unit?: 'months' | 'years';
  term_value?: number;
  term_months?: number;
  principal_bucket?: '<100k' | '100-300k' | '300-500k' | '500k-1M' | '>1M';
  has_prepayments?: boolean;
  prepayment_count?: number;
  has_fgts?: boolean;
  fgts_event_count?: number;
  has_insurance?: boolean;
  has_admin_fee?: boolean;
  has_iof?: boolean;
  effective_installments?: number;
  entry_mode?: 'new_loan' | 'existing_contract';
};

type ProfessionalProfileContext = {
  professional_profile_complete?: boolean;
  professional_profile_has_name?: boolean;
  professional_profile_has_contact?: boolean;
  professional_profile_has_phone?: boolean;
  professional_profile_has_email?: boolean;
  professional_profile_has_website?: boolean;
  professional_profile_has_registration?: boolean;
  professional_profile_has_logo?: boolean;
  professional_profile_has_custom_accent_color?: boolean;
  professional_profile_contact_field_count?: number;
};

type ExportContext = ScenarioContext & {
  format: 'pdf' | 'xlsx' | 'csv';
  source: string;
  access?: 'premium' | 'free_rewarded';
  table_only?: boolean;
  professional?: boolean;
  is_premium?: boolean;
  rewarded_available?: boolean;
  has_client_name?: boolean;
};

type PurchaseContext = {
  source: string;
  flow: 'purchase' | 'restore';
  connected: boolean;
  store_ready: boolean;
  product_loaded: boolean;
  is_premium: boolean;
  price_label?: string;
};

type RewardedContext = {
  format: 'pdf' | 'xlsx' | 'csv';
  source: string;
  stub?: boolean;
};

export interface AnalyticsEventMap {
  app_open: Record<never, never>;
  app_installed: Record<never, never>;
  calculation_performed: Required<
    Pick<
      ScenarioContext,
      | 'system'
      | 'loan_mode'
      | 'rate_type'
      | 'rate_bucket'
      | 'term_months'
      | 'principal_bucket'
      | 'prepayment_count'
      | 'fgts_event_count'
      | 'index_type'
      | 'has_insurance'
      | 'has_admin_fee'
      | 'has_iof'
      | 'entry_mode'
    >
  >;
  feedback_email_clicked: Record<never, never>;
  feedback_email_failed: { reason: 'cannot_open_url' | string };
  feedback_email_opened: Record<never, never>;
  feedback_email_copied: Record<never, never>;
  feedback_whatsapp_clicked: Record<never, never>;
  feedback_whatsapp_failed: { reason: 'cannot_open_url' | string };
  feedback_whatsapp_opened: Record<never, never>;
  scenario_save_blocked_free_limit: { scenario_count: number };
  scenario_limit_upgrade_clicked: { source: 'save_scenario' };
  scenario_saved: ScenarioContext & {
    is_update: boolean;
    is_premium: boolean;
    scenario_count: number;
  };
  scenario_loaded: ScenarioContext;
  scenario_deleted: { remaining_scenarios: number };
  scenario_new_started: ScenarioContext & { source: string; scenario_count: number };
  prepayment_added: ScenarioContext & {
    type: 'fixed_amount' | 'percentage';
    strategy: 'reduce_term' | 'reduce_payment';
    recurrence: 'none' | 'monthly' | 'yearly' | 'biennial';
    months_from_start: string;
    prepayment_count_after: number;
  };
  prepayment_removed: ScenarioContext & { remaining_prepayments: number };
  fgts_added: ScenarioContext & {
    usage: 'down_payment' | 'amortization' | 'installment';
    strategy: 'reduce_term' | 'reduce_payment' | null;
    recurrence: 'none' | 'monthly' | 'yearly' | 'biennial';
    months_from_start: string;
    fgts_event_count_after: number;
  };
  fgts_removed: ScenarioContext & { remaining_fgts_events: number };
  export_clicked: ExportContext;
  export_success: ExportContext;
  export_failed: ExportContext;
  export_blocked_premium: ExportContext;
  export_sheet_opened: {
    is_premium: boolean;
    rewarded_available: boolean;
    platform: string;
  };
  export_sheet_abandoned: { is_premium: boolean; platform: string };
  export_upgrade_clicked: { source: string; placement?: string; platform?: string };
  professional_export_profile_incomplete: ScenarioContext &
    ProfessionalProfileContext & { source: string };
  professional_export_profile_ready: ScenarioContext &
    ProfessionalProfileContext & { source: string };
  professional_export_client_modal_opened: ScenarioContext &
    ProfessionalProfileContext & { source: string };
  professional_export_client_modal_cancelled: ScenarioContext &
    ProfessionalProfileContext & { source: string };
  professional_export_started: ExportContext & ProfessionalProfileContext;
  professional_profile_logo_selected: ProfessionalProfileContext & {
    professional_profile_logo_mime_type: string;
  };
  professional_profile_logo_removed: ProfessionalProfileContext & {
    professional_profile_had_logo: boolean;
  };
  professional_profile_save_blocked_incomplete: ProfessionalProfileContext;
  professional_profile_saved: ProfessionalProfileContext;
  professional_profile_save_failed: ProfessionalProfileContext;
  professional_profile_cleared: ProfessionalProfileContext;
  professional_profile_clear_failed: Record<never, never>;
  premium_entry_clicked: { source: string; from_tab_layout?: boolean };
  premium_paywall_viewed: {
    source: PaywallSource;
    nth_view: number;
    iap_availability?: string;
    store_connected?: boolean;
    store_ready?: boolean;
    price_label?: string;
    purchased_product_count?: number;
  };
  premium_status_viewed: {
    iap_availability: string;
    store_connected: boolean;
    store_ready: boolean;
    price_label?: string;
    purchased_product_count: number;
  };
  premium_status_sync_requested: {
    store_connected: boolean;
    store_ready: boolean;
    purchased_product_count: number;
  };
  paywall_dismissed: {
    source: PaywallSource;
    time_on_paywall_ms: number;
    nth_view: number;
    days_since_install: number;
  };
  paywall_purchase_cta_clicked: { source: PaywallSource; nth_view: number };
  purchase_started: PurchaseContext & { attempt_id: string; nth_view: number };
  purchase_success: PurchaseContext & { attempt_id: string };
  purchase_cancelled: PurchaseContext & { attempt_id: string };
  purchase_failed: PurchaseContext & { attempt_id: string; error_code: string };
  purchase_store_unavailable: PurchaseContext;
  purchase_restore_started: PurchaseContext;
  purchase_restore_success: PurchaseContext;
  purchase_restore_empty: PurchaseContext;
  purchase_restore_failed: PurchaseContext & { error_code?: string };
  premium_status_lost: { days_since_purchase: number };
  rewarded_ad_chosen_over_premium: { source: string; nth_time: number };
  rewarded_export_requested: RewardedContext & { export_type: string };
  rewarded_export_ad_opened: RewardedContext;
  rewarded_export_ad_reward_earned: RewardedContext;
  rewarded_export_ad_cancelled: RewardedContext;
  rewarded_export_ad_failed: RewardedContext & {
    error_kind: RewardedFailureKind;
    error_code?: string;
    error_message?: string;
  };
  rewarded_export_unlocked: RewardedContext;
  interstitial_shown: { source: string; stub?: boolean };
  app_open_ad_shown: { stub?: boolean };
  comparison_configuration_updated: {
    rate_bucket: string;
    term: number;
    base_system: 'SAC' | 'PRICE';
    loan_mode: 'standard' | 'property';
    is_premium: boolean;
    quick_case_count: number;
  };
  comparison_started: Record<never, never>;
  validation_warning_shown: { warning_code: string };
  chart_viewed: { chart_type: string };
  table_expanded: Record<never, never>;
  bacen_rate_fetch_failed: { series: 'TR' | 'IPCA'; error_kind: string };
  review_prompt_requested: { trigger: 'export_success' | 'scenario_saved' | 'dev_force' };
  notification_optin_changed: { enabled: boolean; source: string };
  portability_compared: { has_break_even: boolean; break_even_month?: number };
  optimizer_opened: { entry_point: string };
  optimizer_plan_generated: {
    goal: string;
    budget_bucket: string;
    horizon_months: number;
    interest_saved_bucket: string;
  };
  optimizer_plan_saved: { goal: string };
}

export type AnalyticsEvent = keyof AnalyticsEventMap;
export type AnalyticsEventProperties<E extends AnalyticsEvent> = AnalyticsEventMap[E];

export interface AnalyticsSuperProperties {
  app_platform: string;
  app_version: string;
  is_premium: boolean;
  saved_scenario_count: number;
  has_brand_profile?: boolean;
}

export interface AnalyticsPersonProperties {
  is_premium: boolean;
  first_app_version: string;
}
