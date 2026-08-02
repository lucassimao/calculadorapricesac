import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import type { CorrectionIndexType, FgtsEvent, PrepaymentEvent, Scenario } from '@loan-engine/loan';
import {
  calculateLoanSummary,
  formatCurrency,
  generateAmortizationSchedule,
  MIXED_PREPAYMENT_STRATEGIES_WARNING,
  OUT_OF_TERM_EVENT_WARNING_FRAGMENT,
  validateScenario,
} from '@loan-engine/calculations';
import { fetchLatestIndexRate } from '../../src/lib/bacen';
import { formatDateBR, maskCurrencyInput, parseNumberInput } from '../../src/lib/utils';
import { AmortizationTable } from '../../src/components/AmortizationTable';
import { LoanCharts } from '../../src/components/LoanCharts';
import {
  IndexSelector,
  ScenarioSection,
  SummarySection,
  SystemSelector,
  ValidationSection,
} from '../../src/components/calculator';
import { loadScenarios, saveScenarios } from '../../src/lib/storage/scenarios';
import { AdBanner } from '../../src/components/AdBanner';
import { PremiumPill } from '../../src/components/PremiumPill';
import { usePremiumContext } from '../../src/contexts/PremiumContext';
import { exportCsv } from '../../src/lib/exports/csv';
import { exportPdf } from '../../src/lib/exports/pdf';
import { exportXlsx } from '../../src/lib/exports/xlsx';
import type { ExportAccess, ExportFormat } from '../../src/lib/exports/access';
import { IAP_FALLBACK_PRICE } from '../../src/lib/iap';
import { useIapAvailability } from '../../src/hooks/useIapAvailability';
import { useTheme } from '../../src/lib/theme';
import { useExport } from '../../src/contexts/ExportContext';
import type { ExportTriggerOptions } from '../../src/contexts/ExportContext';
import { useStoreReview } from '../../src/hooks/useStoreReview';
import {
  getPaywallViewContext,
  getAnnualRateBucket,
  registerAnalyticsProperties,
  setPendingPaywallSource,
  trackEvent,
  trackScreen,
} from '../../src/lib/analytics';
import { useIapPurchase } from '../../src/hooks/useIapPurchase';
import { shouldShowAds } from '../../src/lib/premium';
import { useRewardedExport } from '../../src/hooks/useRewardedExport';
import { useInterstitialGate } from '../../src/hooks/useInterstitialGate';
import {
  isTabActionExportBusy,
  shouldResetTabActionExportPhase,
  type TabActionExportPhase,
} from '../../src/hooks/rewarded-export-state';
import type { BrandProfile } from '../../src/types/brand-profile';
import { getBrandProfileCompletion, isBrandProfileComplete } from '../../src/types/brand-profile';
import { loadBrandProfile } from '../../src/lib/storage/brand-profile';
import { ScenarioLimitPaywall } from '../../src/components/premium/scenario-limit-paywall';
import { SCENARIO_LIMIT_PAYWALL_SOURCE, getScenarioSaveGate } from '../../src/lib/scenario-limit';
import { PostExportPaywall } from '../../src/components/premium/post-export-paywall';
import { shouldShowPostExportPaywall } from '../../src/lib/post-export-paywall';

const DEFAULT_SCENARIO: Scenario = {
  id: 'default',
  name: 'Cenário Principal',
  system: 'PRICE',
  loanMode: 'standard',
  principal: 300000,
  rate: 1.2,
  rateType: 'monthly',
  term: 360,
  termUnit: 'months',
  startDate: new Date(),
  dueDay: 5,
  prepayments: [],
};

const MAX_TABLE_ROWS = 10;
interface PendingProfessionalExport {
  source: string;
  brandProfile: BrandProfile;
}

function getScenarioAnalyticsContext(scenario: Scenario, scheduleLength?: number) {
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
    has_insurance: Boolean(scenario.includeInsurance && (scenario.insuranceRate ?? 0) > 0),
    has_admin_fee: Boolean(scenario.includeAdminFee && (scenario.adminFeeRate ?? 0) > 0),
    has_iof: Boolean(scenario.includeIOF && (scenario.iofRate ?? 0) > 0),
    entry_mode: 'new_loan' as const,
    effective_installments:
      typeof scheduleLength === 'number' ? Math.max(scheduleLength - 1, 0) : termMonths,
  };
}

function getExportProgressText({
  exporting,
  rewardedExportFormat,
}: {
  exporting: boolean;
  rewardedExportFormat: ExportFormat | null;
}) {
  if (exporting) return 'Gerando arquivo...';
  if (rewardedExportFormat !== null) return 'Abrindo anúncio...';
  return '';
}

function getExportProgressTitle(format: ExportFormat | null) {
  if (format === 'pdf') return 'Gerando PDF...';
  if (format === 'xlsx') return 'Gerando XLSX...';
  if (format === 'csv') return 'Gerando CSV...';
  return 'Gerando arquivo...';
}

function getProfessionalExportAnalytics({ clientName }: { clientName?: string }): {
  has_client_name?: boolean;
} {
  const trimmedClientName = clientName?.trim() ?? '';
  if (trimmedClientName.length === 0) return {};

  return {
    has_client_name: true,
  };
}

function getMonthsFromStartBucket(startDate: Date, eventDate: Date) {
  const months = Math.max(
    0,
    (eventDate.getFullYear() - startDate.getFullYear()) * 12 +
      eventDate.getMonth() -
      startDate.getMonth(),
  );
  if (months < 12) return '0-11';
  if (months < 24) return '12-23';
  if (months < 60) return '24-59';
  return '60+';
}

function getProfessionalProfileSnapshot(profile: BrandProfile) {
  const completion = getBrandProfileCompletion(profile);

  return {
    professional_profile_complete: completion.isComplete,
    professional_profile_has_name: completion.hasName,
    professional_profile_has_contact: completion.hasContact,
    professional_profile_has_phone: completion.hasPhone,
    professional_profile_has_email: completion.hasEmail,
    professional_profile_has_website: completion.hasWebsite,
    professional_profile_has_registration: completion.hasRegistration,
    professional_profile_has_logo: completion.hasLogo,
    professional_profile_has_custom_accent_color: completion.hasCustomAccentColor,
    professional_profile_contact_field_count: completion.contactFieldCount,
  };
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    const scheduleFrame =
      typeof globalThis.requestAnimationFrame === 'function'
        ? (callback: () => void) => globalThis.requestAnimationFrame(() => callback())
        : (callback: () => void) => setTimeout(callback, 16);

    scheduleFrame(() => scheduleFrame(resolve));
  });
}

function PremiumSectionIap({
  isPremium,
  markPremium,
  sectionRef,
}: {
  isPremium: boolean;
  markPremium: (value: boolean) => Promise<void>;
  sectionRef: RefObject<View | null>;
}) {
  const {
    connected,
    priceLabel,
    purchaseInProgress,
    restoreInProgress,
    handlePurchase,
    handleRestore,
  } = useIapPurchase({
    isPremium,
    markPremium,
    source: 'export_upgrade',
  });
  return (
    <View ref={sectionRef} style={styles.section}>
      <Text style={styles.sectionTitle}>Plano Premium</Text>
      <Text style={styles.label}>
        {priceLabel
          ? `Desbloqueie recursos premium por ${priceLabel} (pagamento único).`
          : 'Desbloqueie recursos premium (pagamento único). Preço indisponível no momento.'}
      </Text>
      <View style={styles.rowWrap}>
        <Pressable
          style={[
            styles.primaryButton,
            (isPremium || purchaseInProgress) && styles.primaryButtonDisabled,
          ]}
          onPress={() => void handlePurchase()}
          accessibilityRole="button"
          accessibilityLabel="Assinar Premium"
        >
          <Text style={styles.primaryButtonText}>
            {isPremium
              ? 'Premium ativo'
              : purchaseInProgress
                ? 'Processando...'
                : 'Assinar premium'}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.secondaryButton,
            (!connected || restoreInProgress) && styles.primaryButtonDisabled,
          ]}
          onPress={handleRestore}
          accessibilityRole="button"
          accessibilityLabel="Restaurar compra"
        >
          <Text style={styles.secondaryButtonText}>
            {restoreInProgress ? 'Restaurando...' : 'Restaurar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PremiumSectionUnsupported() {
  const handleUnavailable = () => {
    Alert.alert(
      'Compras indisponíveis',
      'As compras no app não estão disponíveis neste dispositivo. Use uma build instalada com loja compatível.',
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Plano Premium</Text>
      <View style={styles.bannerWarning}>
        <Text style={styles.bannerWarningText}>
          Compras no app indisponíveis neste dispositivo.
        </Text>
      </View>
      <Text style={styles.label}>
        Remova anúncios e libere exportações por {IAP_FALLBACK_PRICE} (pagamento único).
      </Text>
      <View style={styles.rowWrap}>
        <Pressable
          style={styles.primaryButton}
          onPress={handleUnavailable}
          accessibilityRole="button"
          accessibilityLabel="Remover anúncios"
        >
          <Text style={styles.primaryButtonText}>Remover anúncios</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={handleUnavailable}
          accessibilityRole="button"
          accessibilityLabel="Restaurar compra"
        >
          <Text style={styles.secondaryButtonText}>Restaurar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CalculatorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  // 768px = iPad Mini/iPad portrait, 1024px = iPad landscape
  const isTablet = width >= 768;
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [principalText, setPrincipalText] = useState('R$ 300.000');
  const [propertyValueText, setPropertyValueText] = useState('');
  const [downPaymentText, setDownPaymentText] = useState('');
  const [rateText, setRateText] = useState('1,2');
  const [indexRateText, setIndexRateText] = useState('');
  const [indexRateLabel, setIndexRateLabel] = useState<string | null>(null);
  const [indexRateHelper, setIndexRateHelper] = useState<string | null>(null);
  const [indexRateLoading, setIndexRateLoading] = useState(false);
  const lastAutoFetchIndexType = useRef<CorrectionIndexType | null>(null);
  const manualIndexRateEdited = useRef(false);
  const [termText, setTermText] = useState('360');
  const [startDateText, setStartDateText] = useState(formatDateBR(new Date()));
  const [dueDayText, setDueDayText] = useState('5');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [insuranceRateText, setInsuranceRateText] = useState('0');
  const [adminFeeRateText, setAdminFeeRateText] = useState('0');
  const [iofRateText, setIofRateText] = useState('0');
  const [openingFeeText, setOpeningFeeText] = useState('0');
  const [itbiRateText, setItbiRateText] = useState('0');
  const [registryFeeText, setRegistryFeeText] = useState('0');
  const isPropertyMode = scenario.loanMode === 'property';
  const [tabActionExportPhase, setTabActionExportPhase] = useState<TabActionExportPhase>('idle');
  const [newFgts, setNewFgts] = useState<Partial<FgtsEvent>>({
    amount: 0,
    usage: 'amortization',
    strategy: 'reduce_term',
    date: new Date(),
  });
  const { isPremium, loading: premiumLoading, markPremium } = usePremiumContext();
  const showAds = shouldShowAds(isPremium, premiumLoading);
  const iapAvailability = useIapAvailability();
  const { registerExportHandler, unregisterExportHandler, setIsExporting } = useExport();
  const { requestReviewIfAppropriate } = useStoreReview();
  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'xlsx' | 'csv' | null>(null);
  const [pendingProfessionalExport, setPendingProfessionalExport] =
    useState<PendingProfessionalExport | null>(null);
  const [scenarioLimitPaywallVisible, setScenarioLimitPaywallVisible] = useState(false);
  const [postExportPaywallVisible, setPostExportPaywallVisible] = useState(false);
  const [professionalClientName, setProfessionalClientName] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const { canUseRewardedExport, requestRewardedExport, rewardedExportFormat } =
    useRewardedExport(isPremium);
  const { maybeShowInterstitial } = useInterstitialGate(isPremium);
  const [newPrepayment, setNewPrepayment] = useState<Partial<PrepaymentEvent>>({
    amount: 0,
    type: 'fixed_amount',
    strategy: 'reduce_term',
    date: new Date(),
  });
  const [showPrepaymentDatePicker, setShowPrepaymentDatePicker] = useState(false);
  const [showFgtsDatePicker, setShowFgtsDatePicker] = useState(false);
  const hasSkippedInitialCalculation = useRef(false);
  const mixedStrategyWarningShown = useRef(false);
  const outOfTermWarningShown = useRef(false);
  const inlinePaywallRef = useRef<View>(null);
  const balanceChartRef = useRef<View>(null);
  const paymentChartRef = useRef<View>(null);
  const compositionChartRef = useRef<View>(null);
  const screenHeightRef = useRef(height);
  const isPremiumRef = useRef(isPremium);
  const viewedChartTypesRef = useRef(new Set<string>());
  const inlinePaywallTrackingRef = useRef<{
    pending: boolean;
    viewedAt: number | null;
    blurredAt: number | null;
    context: Awaited<ReturnType<typeof getPaywallViewContext>> | null;
    dismissed: boolean;
  }>({ pending: false, viewedAt: null, blurredAt: null, context: null, dismissed: false });
  const scenarioLimitPaywallTrackingRef = useRef<{
    viewedAt: number;
    closedAt: number | null;
    context: Awaited<ReturnType<typeof getPaywallViewContext>> | null;
    dismissed: boolean;
  } | null>(null);
  const postExportPaywallShownRef = useRef(false);

  useEffect(() => {
    screenHeightRef.current = height;
  }, [height]);

  useEffect(() => {
    isPremiumRef.current = isPremium;
  }, [isPremium]);

  const trackInlinePaywallDismissal = useCallback(() => {
    const state = inlinePaywallTrackingRef.current;
    if (
      state.dismissed ||
      state.viewedAt === null ||
      state.blurredAt === null ||
      !state.context ||
      isPremiumRef.current
    ) {
      return;
    }
    state.dismissed = true;
    trackEvent('paywall_dismissed', {
      source: 'export_upgrade',
      time_on_paywall_ms: state.blurredAt - state.viewedAt,
      nth_view: state.context.nth_view,
      days_since_install: state.context.days_since_install,
    });
  }, []);

  const trackScenarioLimitPaywallDismissal = useCallback(() => {
    const state = scenarioLimitPaywallTrackingRef.current;
    if (state?.dismissed || state?.closedAt === null || !state?.context) return;
    state.dismissed = true;
    trackEvent('paywall_dismissed', {
      source: SCENARIO_LIMIT_PAYWALL_SOURCE,
      time_on_paywall_ms: Math.max(0, state.closedAt - state.viewedAt),
      nth_view: state.context.nth_view,
      days_since_install: state.context.days_since_install,
    });
    scenarioLimitPaywallTrackingRef.current = null;
  }, []);

  const closeScenarioLimitPaywall = useCallback(
    (reason: 'dismissed' | 'converted' = 'dismissed') => {
      const state = scenarioLimitPaywallTrackingRef.current;
      if (state) {
        if (reason === 'converted') {
          state.dismissed = true;
          scenarioLimitPaywallTrackingRef.current = null;
        } else {
          state.closedAt = Date.now();
          trackScenarioLimitPaywallDismissal();
        }
      }
      setScenarioLimitPaywallVisible(false);
    },
    [trackScenarioLimitPaywallDismissal],
  );

  const checkInlinePaywallVisibility = useCallback(() => {
    const state = inlinePaywallTrackingRef.current;
    if (state.pending || state.context || isPremiumRef.current) return;
    inlinePaywallRef.current?.measureInWindow((_x, y, _width, measuredHeight) => {
      if (y >= screenHeightRef.current || y + measuredHeight <= 0) return;
      const current = inlinePaywallTrackingRef.current;
      if (current.pending || current.context) return;
      current.pending = true;
      current.viewedAt = Date.now();
      void getPaywallViewContext('export_upgrade').then((context) => {
        current.context = context;
        current.pending = false;
        trackEvent('premium_paywall_viewed', {
          source: 'export_upgrade',
          nth_view: context.nth_view,
          iap_availability: 'supported',
        });
        trackInlinePaywallDismissal();
      });
    });
  }, [trackInlinePaywallDismissal]);

  const checkChartVisibility = useCallback(() => {
    const charts = [
      ['balance', balanceChartRef],
      ['payment', paymentChartRef],
      ['composition', compositionChartRef],
    ] as const;
    for (const [chartType, chartRef] of charts) {
      if (viewedChartTypesRef.current.has(chartType)) continue;
      chartRef.current?.measureInWindow((_x, y, _width, measuredHeight) => {
        if (
          viewedChartTypesRef.current.has(chartType) ||
          y >= screenHeightRef.current ||
          y + measuredHeight <= 0
        ) {
          return;
        }
        viewedChartTypesRef.current.add(chartType);
        trackEvent('chart_viewed', { chart_type: chartType });
      });
    }
  }, []);

  const checkTrackedViewportElements = useCallback(() => {
    checkInlinePaywallVisibility();
    checkChartVisibility();
  }, [checkChartVisibility, checkInlinePaywallVisibility]);

  useFocusEffect(
    useCallback(() => {
      if (!inlinePaywallTrackingRef.current.pending) {
        inlinePaywallTrackingRef.current = {
          pending: false,
          viewedAt: null,
          blurredAt: null,
          context: null,
          dismissed: false,
        };
      }
      const timeout = setTimeout(checkTrackedViewportElements, 250);
      return () => {
        clearTimeout(timeout);
        inlinePaywallTrackingRef.current.blurredAt = Date.now();
        trackInlinePaywallDismissal();
      };
    }, [checkTrackedViewportElements, trackInlinePaywallDismissal]),
  );

  useEffect(() => {
    trackScreen('calculator');
  }, []);

  useEffect(() => {
    loadScenarios()
      .then((loaded) => setScenarios(loaded))
      .catch(() => {});
  }, []);

  // Sync principal display when in property mode
  useEffect(() => {
    if (isPropertyMode && scenario.propertyValue && scenario.downPayment !== undefined) {
      const computed = Math.max(scenario.propertyValue - (scenario.downPayment ?? 0), 0);
      const formatted =
        computed > 0
          ? `R$ ${computed.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
          : '';
      setPrincipalText(formatted);
      setScenario((prev) => ({ ...prev, principal: computed }));
    }
  }, [isPropertyMode, scenario.propertyValue, scenario.downPayment]);

  const activeIndexType = scenario.indexType;
  const activeIndexRate = scenario.indexRate;

  useEffect(() => {
    if (!activeIndexType) {
      setIndexRateLabel(null);
      setIndexRateHelper(null);
      setIndexRateLoading(false);
      lastAutoFetchIndexType.current = null;
      manualIndexRateEdited.current = false;
      return;
    }

    if (typeof activeIndexRate === 'number' && Number.isFinite(activeIndexRate)) {
      if (!manualIndexRateEdited.current) {
        setIndexRateHelper('Taxa salva ou informada manualmente.');
      }
      setIndexRateLoading(false);
      return;
    }

    if (lastAutoFetchIndexType.current === activeIndexType) {
      return;
    }

    const controller = new AbortController();
    let didCancel = false;
    lastAutoFetchIndexType.current = activeIndexType;
    setIndexRateLoading(true);
    setIndexRateLabel(null);
    setIndexRateHelper(null);

    fetchLatestIndexRate(activeIndexType, { signal: controller.signal })
      .then(({ rate, label }) => {
        if (didCancel || manualIndexRateEdited.current) {
          return;
        }
        setScenario((prev) =>
          prev.indexType === activeIndexType && prev.indexRate === undefined
            ? { ...prev, indexRate: rate }
            : prev,
        );
        setIndexRateText(String(rate).replace('.', ','));
        setIndexRateLabel(label);
      })
      .catch((error) => {
        if (didCancel || (error instanceof Error && error.name === 'AbortError')) return;
        trackEvent('bacen_rate_fetch_failed', {
          series: activeIndexType,
          error_kind: error instanceof Error ? error.name || 'unknown' : 'unknown',
        });
        setIndexRateHelper('Não foi possível buscar no BACEN. Informe a taxa mensal manualmente.');
      })
      .finally(() => {
        if (!didCancel) {
          setIndexRateLoading(false);
        }
      });

    return () => {
      didCancel = true;
      controller.abort();
    };
  }, [activeIndexRate, activeIndexType]);

  const schedule = useMemo(() => generateAmortizationSchedule(scenario), [scenario]);
  const scheduleForTable = useMemo(() => schedule.slice(0, MAX_TABLE_ROWS + 1), [schedule]);
  const summary = useMemo(() => calculateLoanSummary(schedule, scenario), [schedule, scenario]);
  const validation = useMemo(() => validateScenario(scenario, schedule), [scenario, schedule]);
  const hasMixedStrategyWarning = validation.warnings.includes(MIXED_PREPAYMENT_STRATEGIES_WARNING);
  const hasOutOfTermWarning = validation.warnings.some((warning) =>
    warning.includes(OUT_OF_TERM_EVENT_WARNING_FRAGMENT),
  );
  const totalInstallments = Math.max(schedule.length - 1, 0);
  const exportFlowBusy = exporting || rewardedExportFormat !== null;

  useEffect(() => {
    if (hasMixedStrategyWarning && !mixedStrategyWarningShown.current) {
      trackEvent('validation_warning_shown', {
        warning_code: 'mixed_prepayment_strategies',
      });
    }
    mixedStrategyWarningShown.current = hasMixedStrategyWarning;
  }, [hasMixedStrategyWarning]);

  useEffect(() => {
    if (hasOutOfTermWarning && !outOfTermWarningShown.current) {
      trackEvent('validation_warning_shown', {
        warning_code: 'event_out_of_term',
      });
    }
    outOfTermWarningShown.current = hasOutOfTermWarning;
  }, [hasOutOfTermWarning]);

  useEffect(() => {
    if (!hasSkippedInitialCalculation.current) {
      hasSkippedInitialCalculation.current = true;
      return;
    }
    if (validation.errors.length > 0) return;
    const timeout = setTimeout(() => {
      const context = getScenarioAnalyticsContext(scenario, schedule.length);
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
        entry_mode: 'new_loan',
      });
    }, 2_000);
    return () => clearTimeout(timeout);
  }, [scenario, schedule.length, validation.errors.length]);

  // Dynamic themed styles
  const themedStyles = useMemo(
    () => ({
      container: { backgroundColor: colors.background },
      section: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      title: { color: colors.text },
      sectionTitle: { color: colors.text },
      label: { color: colors.textSecondary },
      input: { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
      summaryRow: { borderBottomColor: colors.borderLight },
      summaryLabel: { color: colors.textSecondary },
      summaryValue: { color: colors.text },
      chip: { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
      chipText: { color: colors.textSecondary },
      chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
      chipActiveText: { color: colors.primary },
      rowAlt: { backgroundColor: colors.rowAlt },
    }),
    [colors],
  );

  // Brief loading indicator when scenario changes
  useEffect(() => {
    setIsCalculating(true);
    const timeout = setTimeout(() => setIsCalculating(false), 150);
    return () => clearTimeout(timeout);
  }, [scenario]);

  const persistScenarios = async (nextScenarios: Scenario[]) => {
    setScenarios(nextScenarios);
    await saveScenarios(nextScenarios);
  };

  const handleSaveScenario = async () => {
    if (!scenario.name.trim()) {
      Alert.alert('Nome obrigatório', 'Informe um nome para o cenário.');
      return;
    }
    const existingIndex = scenarios.findIndex((item) => item.id === scenario.id);
    if (
      getScenarioSaveGate({
        isPremium,
        isExistingScenario: existingIndex >= 0,
        savedScenarioCount: scenarios.length,
      }) === 'scenario_limit_paywall'
    ) {
      if (scenarioLimitPaywallTrackingRef.current) return;
      trackEvent('scenario_save_blocked_free_limit', {
        scenario_count: scenarios.length,
      });
      const viewedAt = Date.now();
      scenarioLimitPaywallTrackingRef.current = {
        viewedAt,
        closedAt: null,
        context: null,
        dismissed: false,
      };
      setScenarioLimitPaywallVisible(true);
      void getPaywallViewContext(SCENARIO_LIMIT_PAYWALL_SOURCE)
        .then((context) => {
          const state = scenarioLimitPaywallTrackingRef.current;
          if (!state || state.viewedAt !== viewedAt) return;
          state.context = context;
          trackEvent('premium_paywall_viewed', {
            source: SCENARIO_LIMIT_PAYWALL_SOURCE,
            nth_view: context.nth_view,
            iap_availability: iapAvailability,
          });
          trackScenarioLimitPaywallDismissal();
        })
        .catch(() => {
          const state = scenarioLimitPaywallTrackingRef.current;
          if (state?.viewedAt === viewedAt) {
            scenarioLimitPaywallTrackingRef.current = null;
          }
        });
      return;
    }
    const nextList = [...scenarios];
    if (existingIndex >= 0) {
      nextList[existingIndex] = scenario;
    } else {
      const newId = Date.now().toString();
      nextList.unshift({ ...scenario, id: newId });
      setScenario((prev) => ({ ...prev, id: newId }));
    }
    await persistScenarios(nextList);
    registerAnalyticsProperties({ saved_scenario_count: nextList.length });
    trackEvent('scenario_saved', {
      is_update: existingIndex >= 0,
      is_premium: isPremium,
      scenario_count: nextList.length,
      ...getScenarioAnalyticsContext(scenario, schedule.length),
    });
    const interstitialShown = await maybeShowInterstitial(
      existingIndex >= 0 ? 'scenario_updated' : 'scenario_saved',
    ).catch(() => false);
    requestReviewIfAppropriate('scenario_saved', {
      suppressPrompt: interstitialShown,
    }).catch(() => {});
  };

  const formatCurrencyValue = (value: number | undefined): string => {
    if (!value) return '';
    const formatted = value.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `R$ ${formatted}`;
  };

  const handleLoadScenario = (target: Scenario) => {
    const targetScheduleLength = generateAmortizationSchedule(target).length;

    trackEvent('scenario_loaded', {
      ...getScenarioAnalyticsContext(target, targetScheduleLength),
    });
    setScenario(target);
    setPrincipalText(formatCurrencyValue(target.principal));
    setPropertyValueText(formatCurrencyValue(target.propertyValue));
    setDownPaymentText(formatCurrencyValue(target.downPayment));
    setRateText(String(target.rate).replace('.', ','));
    setIndexRateText(
      target.indexRate !== undefined ? String(target.indexRate).replace('.', ',') : '',
    );
    setIndexRateLabel(null);
    setIndexRateHelper(target.indexType ? 'Taxa salva ou informada manualmente.' : null);
    manualIndexRateEdited.current = Boolean(target.indexType && target.indexRate !== undefined);
    setTermText(String(target.term));
    setStartDateText(formatDateBR(target.startDate));
    setDueDayText(String(target.dueDay));
    setInsuranceRateText(
      target.insuranceRate ? String(target.insuranceRate).replace('.', ',') : '0',
    );
    setAdminFeeRateText(target.adminFeeRate ? String(target.adminFeeRate).replace('.', ',') : '0');
    setIofRateText(target.iofRate ? String(target.iofRate).replace('.', ',') : '0');
    setOpeningFeeText(formatCurrencyValue(target.openingFee));
    setItbiRateText(target.itbiRate ? String(target.itbiRate).replace('.', ',') : '0');
    setRegistryFeeText(formatCurrencyValue(target.registryFee));
  };

  const handleDeleteScenario = (id: string, name: string) => {
    Alert.alert('Excluir cenário', `Tem certeza que deseja excluir "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const nextList = scenarios.filter((s) => s.id !== id);
          await persistScenarios(nextList);
          registerAnalyticsProperties({ saved_scenario_count: nextList.length });
          trackEvent('scenario_deleted', {
            remaining_scenarios: nextList.length,
          });
        },
      },
    ]);
  };

  const handleAddPrepayment = () => {
    if (!newPrepayment.amount || !newPrepayment.date) {
      Alert.alert('Amortização incompleta', 'Informe data e valor.');
      return;
    }
    const next: PrepaymentEvent = {
      id: Date.now().toString(),
      amount: newPrepayment.amount,
      date: new Date(newPrepayment.date),
      type: newPrepayment.type as PrepaymentEvent['type'],
      strategy: newPrepayment.strategy as PrepaymentEvent['strategy'],
      description: newPrepayment.description,
    };
    setScenario((prev) => ({
      ...prev,
      prepayments: [...(prev.prepayments ?? []), next],
    }));
    setNewPrepayment({
      amount: 0,
      type: 'fixed_amount',
      strategy: 'reduce_term',
      date: new Date(),
    });
    trackEvent('prepayment_added', {
      type: next.type,
      strategy: next.strategy,
      recurrence: 'none',
      months_from_start: getMonthsFromStartBucket(scenario.startDate, next.date),
      ...getScenarioAnalyticsContext(scenario, schedule.length),
      prepayment_count_after: (scenario.prepayments?.length ?? 0) + 1,
    });
  };

  const handleRemovePrepayment = (id: string) => {
    const nextPrepayments = (scenario.prepayments ?? []).filter((p) => p.id !== id);
    setScenario((prev) => ({
      ...prev,
      prepayments: nextPrepayments,
    }));
    trackEvent('prepayment_removed', {
      remaining_prepayments: nextPrepayments.length,
      ...getScenarioAnalyticsContext(scenario, schedule.length),
    });
  };

  const handleAddFgts = () => {
    if (!newFgts.amount || !newFgts.date) {
      Alert.alert('FGTS incompleto', 'Informe data e valor.');
      return;
    }
    const next: FgtsEvent = {
      id: Date.now().toString(),
      amount: newFgts.amount,
      date: new Date(newFgts.date),
      usage: newFgts.usage as FgtsEvent['usage'],
      strategy: newFgts.strategy,
      description: newFgts.description,
    };
    setScenario((prev) => ({
      ...prev,
      fgtsEvents: [...(prev.fgtsEvents ?? []), next],
    }));
    setNewFgts({
      amount: 0,
      usage: 'amortization',
      strategy: 'reduce_term',
      date: new Date(),
    });
    trackEvent('fgts_added', {
      usage: next.usage,
      strategy: next.strategy ?? null,
      recurrence: 'none',
      months_from_start: getMonthsFromStartBucket(scenario.startDate, next.date),
      ...getScenarioAnalyticsContext(scenario, schedule.length),
      fgts_event_count_after: (scenario.fgtsEvents?.length ?? 0) + 1,
    });
  };

  const handleRemoveFgts = (id: string) => {
    const nextFgtsEvents = (scenario.fgtsEvents ?? []).filter((event) => event.id !== id);
    setScenario((prev) => ({
      ...prev,
      fgtsEvents: nextFgtsEvents,
    }));
    trackEvent('fgts_removed', {
      remaining_fgts_events: nextFgtsEvents.length,
      ...getScenarioAnalyticsContext(scenario, schedule.length),
    });
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Close picker on Android always, on iOS only when date is set
    if (Platform.OS === 'android' || event.type === 'set') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    setScenario((prev) => ({ ...prev, startDate: selectedDate }));
    setStartDateText(formatDateBR(selectedDate));
  };

  const handlePrepaymentDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Close picker on Android always, on iOS only when date is set
    if (Platform.OS === 'android' || event.type === 'set') {
      setShowPrepaymentDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    setNewPrepayment((prev) => ({ ...prev, date: selectedDate }));
  };

  const handleFgtsDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Close picker on Android always, on iOS only when date is set
    if (Platform.OS === 'android' || event.type === 'set') {
      setShowFgtsDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    setNewFgts((prev) => ({ ...prev, date: selectedDate }));
  };

  const runExport = useCallback(
    async ({
      format,
      source,
      tableOnly = false,
      access = 'premium',
      professional = false,
      brandProfile,
      clientName,
    }: {
      format: ExportFormat;
      source: string;
      tableOnly?: boolean;
      access?: ExportAccess;
      professional?: boolean;
      brandProfile?: BrandProfile;
      clientName?: string;
    }) => {
      if (exporting) return false;
      if (validation.errors.length > 0) {
        Alert.alert('Revise os dados', 'Corrija os erros do cenário antes de exportar.');
        return false;
      }

      setExporting(true);
      setExportingFormat(format);

      if (source === 'tab_action') {
        setTabActionExportPhase('exporting');
      }

      await waitForNextPaint();

      try {
        if (format === 'pdf') {
          await exportPdf(scenario, summary, schedule, {
            tableOnly: professional ? false : tableOnly,
            access,
            professional,
            brandProfile,
            clientName,
          });
        } else if (format === 'xlsx') {
          await exportXlsx(schedule, scenario, summary, {
            tableOnly,
            access,
          });
        } else {
          await exportCsv(schedule, scenario, summary, {
            tableOnly,
            access,
          });
        }

        trackEvent('export_success', {
          format,
          source,
          access,
          table_only: professional ? false : tableOnly,
          professional,
          is_premium: isPremium,
          ...getProfessionalExportAnalytics({
            clientName: professional ? clientName : undefined,
          }),
          ...getScenarioAnalyticsContext(scenario, schedule.length),
        });
        const showPostExportPaywall = shouldShowPostExportPaywall({
          access,
          isPremium,
          hasShownThisSession: postExportPaywallShownRef.current,
        });
        if (showPostExportPaywall) {
          postExportPaywallShownRef.current = true;
          setPostExportPaywallVisible(true);
        }
        requestReviewIfAppropriate('export_success', {
          suppressPrompt: showPostExportPaywall,
        }).catch(() => {});
        return true;
      } catch {
        trackEvent('export_failed', {
          format,
          source,
          access,
          table_only: professional ? false : tableOnly,
          professional,
          is_premium: isPremium,
          ...getProfessionalExportAnalytics({
            clientName: professional ? clientName : undefined,
          }),
          ...getScenarioAnalyticsContext(scenario, schedule.length),
        });
        Alert.alert('Erro', 'Não foi possível exportar o arquivo.');
        return false;
      } finally {
        setExporting(false);
        setExportingFormat(null);

        if (source === 'tab_action') {
          setTabActionExportPhase('idle');
        }
      }
    },
    [
      exporting,
      isPremium,
      requestReviewIfAppropriate,
      scenario,
      schedule,
      summary,
      validation.errors.length,
    ],
  );

  const startRewardedExportFlow = useCallback(
    async ({
      format,
      source,
      tableOnly = false,
      access = 'free_rewarded',
    }: {
      format: ExportFormat;
      source: string;
      tableOnly?: boolean;
      access?: ExportAccess;
    }) => {
      if (!canUseRewardedExport) return false;

      if (source === 'tab_action') {
        setTabActionExportPhase('rewarded');
      }

      const started = await requestRewardedExport({
        format,
        source,
        onUnlocked: () => runExport({ format, source, tableOnly, access }),
      });

      if (!started) {
        if (source === 'tab_action') {
          setTabActionExportPhase('idle');
        }
      }

      return started;
    },
    [canUseRewardedExport, requestRewardedExport, runExport],
  );

  const promptUpgradeForExport = useCallback(
    (format: ExportFormat, source: string, tableOnly = false) => {
      Alert.alert(
        'Exportação grátis com anúncio',
        'Assista a um anúncio para liberar esta exportação ou assine o Premium para exportar sem limites e sem anúncios.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ver Premium',
            onPress: () => {
              trackEvent('export_upgrade_clicked', {
                source,
                placement: tableOnly ? 'table_only_rewarded_prompt' : 'rewarded_prompt',
              });
              setPendingPaywallSource('export_upgrade');
              router.push('/(tabs)/premium');
            },
          },
          {
            text: 'Assistir anúncio',
            onPress: () => {
              void startRewardedExportFlow({ format, source, tableOnly });
            },
          },
        ],
      );
    },
    [router, startRewardedExportFlow],
  );

  const handleExportTableOnly = useCallback(
    async (format: ExportFormat) => {
      trackEvent('export_clicked', {
        format,
        source: 'table_only',
        table_only: true,
        is_premium: isPremium,
        rewarded_available: canUseRewardedExport,
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });

      if (exporting || rewardedExportFormat !== null) return;

      if (!isPremium) {
        if (canUseRewardedExport) {
          promptUpgradeForExport(format, 'table_only', true);
          return;
        }

        trackEvent('export_blocked_premium', {
          format,
          source: 'table_only',
          rewarded_available: canUseRewardedExport,
          ...getScenarioAnalyticsContext(scenario, schedule.length),
        });
        Alert.alert(
          'Premium',
          'Exportação disponível apenas para assinantes. Assine o Premium para liberar exportações ilimitadas.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ver Premium',
              onPress: () => {
                trackEvent('export_upgrade_clicked', {
                  source: 'table_only',
                  placement: 'blocked_alert',
                });
                setPendingPaywallSource('export_upgrade');
                router.push('/(tabs)/premium');
              },
            },
          ],
        );
        return;
      }

      await runExport({ format, source: 'table_only', tableOnly: true });
    },
    [
      canUseRewardedExport,
      exporting,
      isPremium,
      promptUpgradeForExport,
      rewardedExportFormat,
      router,
      runExport,
      scenario,
      schedule.length,
    ],
  );

  const seedExportExtrasForDev = () => {
    const fixedDate = new Date(2026, 0, 1);
    const firstDueDate = new Date(2026, 1, 5);
    setScenario((prev) => ({
      ...prev,
      name: 'Teste Exportacao',
      system: 'PRICE',
      loanMode: 'standard',
      principal: 300000,
      rate: 1.2,
      rateType: 'monthly',
      term: 360,
      termUnit: 'months',
      startDate: fixedDate,
      dueDay: 5,
      prepayments: [
        {
          id: 'dev-prepayment',
          amount: 1000,
          date: firstDueDate,
          type: 'fixed_amount',
          strategy: 'reduce_term',
          description: 'Dev prepayment',
        },
      ],
      fgtsEvents: [
        {
          id: 'dev-fgts',
          amount: 800,
          date: firstDueDate,
          usage: 'amortization',
          strategy: 'reduce_term',
          description: 'Dev FGTS',
        },
      ],
    }));
  };

  const seedMixedStrategiesForDev = () => {
    const fixedDate = new Date(2026, 0, 1);
    const firstDueDate = new Date(2026, 1, 5);
    setScenario((prev) => ({
      ...prev,
      startDate: fixedDate,
      dueDay: 5,
      prepayments: [
        {
          id: 'dev-reduce-payment',
          amount: 1000,
          date: firstDueDate,
          type: 'fixed_amount',
          strategy: 'reduce_payment',
          description: 'Dev reduzir parcela',
        },
      ],
      fgtsEvents: [
        {
          id: 'dev-reduce-term',
          amount: 1000,
          date: firstDueDate,
          usage: 'amortization',
          strategy: 'reduce_term',
          description: 'Dev reduzir prazo',
        },
      ],
    }));
  };

  const seedOutOfTermWarningForDev = () => {
    setScenario((prev) => ({
      ...prev,
      startDate: new Date(2026, 0, 1),
      dueDay: 5,
      term: 1,
      termUnit: 'months',
      prepayments: [
        {
          id: 'dev-out-of-term',
          amount: 1000,
          date: new Date(2026, 2, 1),
          type: 'fixed_amount',
          strategy: 'reduce_term',
          description: 'Dev fora do prazo',
        },
      ],
      fgtsEvents: [],
    }));
  };

  const hasDevSeedExtras =
    (scenario.prepayments?.length ?? 0) > 0 && (scenario.fgtsEvents?.length ?? 0) > 0;

  const startProfessionalExportFlow = useCallback(
    async (source: string) => {
      let brandProfile: BrandProfile;

      try {
        brandProfile = await loadBrandProfile();
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar o perfil profissional.');
        return;
      }

      if (!isBrandProfileComplete(brandProfile)) {
        trackEvent('professional_export_profile_incomplete', {
          source,
          ...getProfessionalProfileSnapshot(brandProfile),
          ...getScenarioAnalyticsContext(scenario, schedule.length),
        });
        Alert.alert(
          'Complete o perfil profissional',
          'Preencha nome ou empresa e pelo menos um contato para gerar o PDF Profissional.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Completar perfil',
              onPress: () => {
                setPendingPaywallSource('export_upgrade');
                router.push('/(tabs)/premium');
              },
            },
          ],
        );
        return;
      }

      trackEvent('professional_export_profile_ready', {
        source,
        ...getProfessionalProfileSnapshot(brandProfile),
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });
      trackEvent('professional_export_client_modal_opened', {
        source,
        ...getProfessionalProfileSnapshot(brandProfile),
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });
      setProfessionalClientName('');
      setPendingProfessionalExport({ source, brandProfile });
    },
    [router, scenario, schedule.length],
  );

  // Callback for the export context (used by tab bar action sheet)
  const handleExportFromContext = useCallback(
    async (format: ExportFormat, options?: ExportTriggerOptions) => {
      const professional = Boolean(options?.professional);
      trackEvent('export_clicked', {
        format,
        source: 'tab_action',
        table_only: false,
        professional,
        is_premium: isPremium,
        rewarded_available: canUseRewardedExport,
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });

      if (exporting || rewardedExportFormat !== null) return;

      if (professional && !isPremium) {
        Alert.alert('Premium', 'PDF Profissional disponível apenas para assinantes.');
        setPendingPaywallSource('export_upgrade');
        router.push('/(tabs)/premium');
        return;
      }

      if (!isPremium) {
        if (canUseRewardedExport) {
          await startRewardedExportFlow({ format, source: 'tab_action' });
          return;
        }

        trackEvent('export_blocked_premium', {
          format,
          source: 'tab_action',
          rewarded_available: canUseRewardedExport,
          ...getScenarioAnalyticsContext(scenario, schedule.length),
        });
        Alert.alert('Premium', 'Exportação disponível apenas para assinantes.');
        trackEvent('export_upgrade_clicked', {
          source: 'tab_action',
          placement: 'blocked_redirect',
        });
        setPendingPaywallSource('export_upgrade');
        router.push('/(tabs)/premium');
        return;
      }

      if (professional) {
        await startProfessionalExportFlow('tab_action');
        return;
      }

      await runExport({ format, source: 'tab_action' });
    },
    [
      canUseRewardedExport,
      exporting,
      isPremium,
      rewardedExportFormat,
      router,
      runExport,
      scenario,
      schedule.length,
      startProfessionalExportFlow,
      startRewardedExportFlow,
    ],
  );

  const cancelProfessionalExport = useCallback(() => {
    if (pendingProfessionalExport) {
      trackEvent('professional_export_client_modal_cancelled', {
        source: pendingProfessionalExport.source,
        ...getProfessionalProfileSnapshot(pendingProfessionalExport.brandProfile),
        ...getProfessionalExportAnalytics({
          clientName: professionalClientName,
        }),
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });
    }
    setPendingProfessionalExport(null);
    setProfessionalClientName('');
  }, [pendingProfessionalExport, professionalClientName, scenario, schedule.length]);

  const confirmProfessionalExport = useCallback(async () => {
    if (!pendingProfessionalExport) return;
    const pending = pendingProfessionalExport;
    const clientName = professionalClientName.trim();
    trackEvent('professional_export_started', {
      format: 'pdf',
      source: pending.source,
      professional: true,
      is_premium: isPremium,
      ...getProfessionalProfileSnapshot(pending.brandProfile),
      ...getProfessionalExportAnalytics({
        clientName,
      }),
      ...getScenarioAnalyticsContext(scenario, schedule.length),
    });
    setPendingProfessionalExport(null);
    await runExport({
      format: 'pdf',
      source: pending.source,
      professional: true,
      brandProfile: pending.brandProfile,
      clientName,
    });
    setProfessionalClientName('');
  }, [
    isPremium,
    pendingProfessionalExport,
    professionalClientName,
    runExport,
    scenario,
    schedule.length,
  ]);

  const handleNewScenario = () => {
    trackEvent('scenario_new_started', {
      source: 'calculator',
      scenario_count: scenarios.length,
      ...getScenarioAnalyticsContext(DEFAULT_SCENARIO),
    });
    handleLoadScenario({ ...DEFAULT_SCENARIO, id: Date.now().toString() });
  };

  useEffect(() => {
    if (
      !shouldResetTabActionExportPhase({
        phase: tabActionExportPhase,
        rewardedExportFormat,
        exporting,
      })
    )
      return;

    // The tab action keeps its modal open across the rewarded ad round-trip. If the ad
    // closes or fails before an export starts, reset the phase here so the modal can close.
    setTabActionExportPhase('idle');
  }, [tabActionExportPhase, rewardedExportFormat, exporting]);

  useEffect(() => {
    setIsExporting(isTabActionExportBusy(tabActionExportPhase));
  }, [tabActionExportPhase, setIsExporting]);

  useEffect(() => {
    return () => setIsExporting(false);
  }, [setIsExporting]);

  // Register the export handler with the context so the tab bar can trigger exports
  useEffect(() => {
    registerExportHandler(handleExportFromContext, {
      isPremium,
      canUseRewardedExport,
    });
    return () => unregisterExportHandler();
  }, [
    registerExportHandler,
    unregisterExportHandler,
    handleExportFromContext,
    isPremium,
    canUseRewardedExport,
  ]);

  return (
    <ScrollView
      testID="screen-calculator"
      contentContainerStyle={[
        styles.container,
        themedStyles.container,
        isTablet && styles.containerTablet,
      ]}
      keyboardShouldPersistTaps="handled"
      onScroll={checkTrackedViewportElements}
      scrollEventThrottle={200}
    >
      <AdBanner enabled={showAds} />

      <View style={[styles.columns, isTablet && styles.columnsTablet]}>
        {/* Column 1: Input Forms */}
        <View style={[styles.column, isTablet && styles.columnTablet]}>
          <ScenarioSection
            scenario={scenario}
            scenarios={scenarios}
            onNameChange={(name) => setScenario((prev) => ({ ...prev, name }))}
            onSave={handleSaveScenario}
            onNew={handleNewScenario}
            onLoad={handleLoadScenario}
            onDelete={handleDeleteScenario}
          />

          {__DEV__ ? (
            <View style={{ gap: 8, marginBottom: 16 }}>
              <Pressable
                style={styles.secondaryButton}
                onPress={seedExportExtrasForDev}
                accessibilityRole="button"
                accessibilityLabel="Popular extras para exportação (dev)"
                testID="btn-seed-export-extras-dev"
              >
                <Text style={styles.secondaryButtonText} testID="label-seed-export-extras-dev">
                  {hasDevSeedExtras ? 'Extras prontos (dev)' : 'Popular extras (dev)'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={seedMixedStrategiesForDev}
                accessibilityRole="button"
                accessibilityLabel="Popular estratégias mistas (dev)"
                testID="btn-seed-mixed-strategies-dev"
              >
                <Text style={styles.secondaryButtonText}>Estratégias mistas (dev)</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={seedOutOfTermWarningForDev}
                accessibilityRole="button"
                accessibilityLabel="Popular amortização fora do prazo (dev)"
                testID="btn-seed-out-of-term-warning-dev"
              >
                <Text style={styles.secondaryButtonText}>Fora do prazo (dev)</Text>
              </Pressable>
            </View>
          ) : null}

          <SystemSelector
            system={scenario.system}
            loanMode={scenario.loanMode ?? 'standard'}
            onSystemChange={(system) => setScenario((prev) => ({ ...prev, system }))}
            onLoanModeChange={(mode) => {
              if (mode === 'standard') {
                setPropertyValueText('');
                setDownPaymentText('');
                setScenario((prev) => ({
                  ...prev,
                  loanMode: 'standard',
                  propertyValue: undefined,
                  downPayment: undefined,
                  itbiRate: undefined,
                  registryFee: undefined,
                }));
              } else {
                setScenario((prev) => ({ ...prev, loanMode: 'property' }));
              }
            }}
          />

          <View style={[styles.section, themedStyles.section]} testID="section-parameters">
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Parâmetros</Text>

            <Text style={[styles.label, themedStyles.label]}>Valor do Financiamento (R$)</Text>
            <TextInput
              value={principalText}
              onChangeText={(text) => {
                const { display, value } = maskCurrencyInput(text);
                setPrincipalText(display);
                setScenario((prev) => ({ ...prev, principal: value }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="R$ 300.000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Valor do financiamento"
              testID="input-principal"
            />

            {isPropertyMode && (
              <>
                <Text style={[styles.label, themedStyles.label]}>Valor do Imóvel (R$)</Text>
                <TextInput
                  value={propertyValueText}
                  onChangeText={(text) => {
                    const { display, value } = maskCurrencyInput(text);
                    setPropertyValueText(display);
                    setScenario((prev) => ({ ...prev, propertyValue: value }));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholder="R$ 500.000"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Valor do imóvel"
                />

                <Text style={[styles.label, themedStyles.label]}>Entrada (R$)</Text>
                <TextInput
                  value={downPaymentText}
                  onChangeText={(text) => {
                    const { display, value } = maskCurrencyInput(text);
                    setDownPaymentText(display);
                    setScenario((prev) => ({ ...prev, downPayment: value }));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholder="R$ 100.000"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Entrada"
                />
              </>
            )}

            <Text style={[styles.label, themedStyles.label]}>Taxa de Juros</Text>
            <View style={styles.rowWrap}>
              <TextInput
                value={rateText}
                onChangeText={(text) => {
                  setRateText(text);
                  setScenario((prev) => ({ ...prev, rate: parseNumberInput(text) }));
                }}
                keyboardType="numeric"
                style={[styles.input, styles.inputFlex, themedStyles.input]}
                placeholder="1,2"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Taxa de juros"
                testID="input-rate"
              />
              <View style={styles.toggleRow}>
                {(['monthly', 'annual'] as const).map((rateType) => (
                  <Pressable
                    key={rateType}
                    onPress={() => setScenario((prev) => ({ ...prev, rateType }))}
                    style={[
                      styles.chip,
                      themedStyles.chip,
                      scenario.rateType === rateType && themedStyles.chipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: scenario.rateType === rateType }}
                    accessibilityLabel={`Taxa ${rateType === 'monthly' ? 'ao mês' : 'ao ano'}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        themedStyles.chipText,
                        scenario.rateType === rateType && themedStyles.chipActiveText,
                      ]}
                    >
                      {rateType === 'monthly' ? 'a.m.' : 'a.a.'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <IndexSelector
              indexType={scenario.indexType}
              indexRateText={indexRateText}
              referenceLabel={indexRateLabel}
              helperText={indexRateHelper}
              loading={indexRateLoading}
              onIndexTypeChange={(type) => {
                lastAutoFetchIndexType.current = null;
                manualIndexRateEdited.current = false;
                setIndexRateText('');
                setIndexRateLabel(null);
                setIndexRateHelper(null);
                setScenario((prev) => ({
                  ...prev,
                  indexType: type,
                  indexRate: undefined,
                }));
              }}
              onIndexRateTextChange={(text) => {
                manualIndexRateEdited.current = true;
                setIndexRateText(text);
                setIndexRateLabel(null);
                setIndexRateHelper(text.trim() ? 'Taxa informada manualmente.' : null);
                const normalized = text.trim().replace(',', '.');
                const value = Number.parseFloat(normalized);
                setScenario((prev) => ({
                  ...prev,
                  indexRate: normalized === '' || Number.isNaN(value) ? undefined : value,
                }));
              }}
            />

            <Text style={[styles.label, themedStyles.label]}>Prazo</Text>
            <View style={styles.rowWrap}>
              <TextInput
                value={termText}
                onChangeText={(text) => {
                  setTermText(text);
                  const parsed = Number.parseInt(text || '0', 10);
                  setScenario((prev) => ({ ...prev, term: Number.isNaN(parsed) ? 0 : parsed }));
                }}
                keyboardType="numeric"
                style={[styles.input, styles.inputFlex, themedStyles.input]}
                placeholder="360"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Prazo"
                testID="input-term"
              />
              <View style={styles.toggleRow}>
                {(['months', 'years'] as const).map((termUnit) => (
                  <Pressable
                    key={termUnit}
                    onPress={() => setScenario((prev) => ({ ...prev, termUnit }))}
                    style={[
                      styles.chip,
                      themedStyles.chip,
                      scenario.termUnit === termUnit && themedStyles.chipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: scenario.termUnit === termUnit }}
                    accessibilityLabel={`Prazo em ${termUnit === 'months' ? 'meses' : 'anos'}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        themedStyles.chipText,
                        scenario.termUnit === termUnit && themedStyles.chipActiveText,
                      ]}
                    >
                      {termUnit === 'months' ? 'Meses' : 'Anos'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={[styles.label, themedStyles.label]}>Data de Início</Text>
            <Pressable
              style={[styles.input, styles.inputPressable, themedStyles.input]}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Selecionar data de início"
            >
              <Text style={[styles.inputText, { color: colors.text }]}>{startDateText}</Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={scenario.startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
              />
            ) : null}

            <Text style={[styles.label, themedStyles.label]}>Dia de Vencimento</Text>
            <TextInput
              value={dueDayText}
              onChangeText={(text) => {
                setDueDayText(text);
                const parsed = Number.parseInt(text || '0', 10);
                if (!Number.isNaN(parsed)) {
                  setScenario((prev) => ({ ...prev, dueDay: parsed }));
                }
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="5"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Dia de vencimento"
              testID="input-due-day"
            />
          </View>

          {/* Custos e Taxas - moved to column 1 for better balance */}
          <View style={[styles.section, themedStyles.section]}>
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Custos e Taxas</Text>
            <Text style={[styles.helperText, { color: colors.textTertiary }]}>
              Use taxas mensais (%) sobre o saldo devedor. Custos iniciais são cobrados na
              assinatura.
            </Text>
            <Text style={[styles.label, themedStyles.label]}>IOF (% do financiado)</Text>
            <TextInput
              value={iofRateText}
              onChangeText={(text) => {
                setIofRateText(text);
                setScenario((prev) => ({
                  ...prev,
                  iofRate: parseNumberInput(text),
                  includeIOF: parseNumberInput(text) > 0,
                }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Taxa de IOF"
            />

            <Text style={[styles.label, themedStyles.label]}>Seguro (% do saldo ao mês)</Text>
            <TextInput
              value={insuranceRateText}
              onChangeText={(text) => {
                setInsuranceRateText(text);
                setScenario((prev) => ({
                  ...prev,
                  insuranceRate: parseNumberInput(text),
                  includeInsurance: parseNumberInput(text) > 0,
                }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Taxa de seguro"
            />

            <Text style={[styles.label, themedStyles.label]}>
              Tarifa administrativa (% do saldo ao mês)
            </Text>
            <TextInput
              value={adminFeeRateText}
              onChangeText={(text) => {
                setAdminFeeRateText(text);
                setScenario((prev) => ({
                  ...prev,
                  adminFeeRate: parseNumberInput(text),
                  includeAdminFee: parseNumberInput(text) > 0,
                }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Taxa administrativa"
            />

            <Text style={[styles.label, themedStyles.label]}>Taxa de abertura (R$)</Text>
            <TextInput
              value={openingFeeText}
              onChangeText={(text) => {
                const { display, value } = maskCurrencyInput(text);
                setOpeningFeeText(display);
                setScenario((prev) => ({
                  ...prev,
                  openingFee: value,
                  includeOpeningFee: value > 0,
                }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="R$ 1.000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Taxa de abertura"
              testID="input-opening-fee"
            />

            {isPropertyMode && (
              <>
                <Text style={[styles.label, themedStyles.label]}>ITBI (% do imóvel)</Text>
                <TextInput
                  value={itbiRateText}
                  onChangeText={(text) => {
                    setItbiRateText(text);
                    setScenario((prev) => ({ ...prev, itbiRate: parseNumberInput(text) }));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Taxa de ITBI"
                />

                <Text style={[styles.label, themedStyles.label]}>Cartório (R$)</Text>
                <TextInput
                  value={registryFeeText}
                  onChangeText={(text) => {
                    const { display, value } = maskCurrencyInput(text);
                    setRegistryFeeText(display);
                    setScenario((prev) => ({ ...prev, registryFee: value }));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholder="R$ 5.000"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Taxa de cartório"
                />
              </>
            )}
          </View>

          <ValidationSection errors={validation.errors} warnings={validation.warnings} />

          {!isPremium ? (
            iapAvailability === 'supported' ? (
              <PremiumSectionIap
                isPremium={isPremium}
                markPremium={markPremium}
                sectionRef={inlinePaywallRef}
              />
            ) : (
              <PremiumSectionUnsupported />
            )
          ) : null}
        </View>

        {/* Column 2: Results & Outputs */}
        <View style={[styles.column, isTablet && styles.columnTablet]}>
          <SummarySection
            summary={summary}
            principal={scenario.principal}
            isPremium={isPremium}
            isCalculating={isCalculating}
            indexType={scenario.indexType}
            indexRate={scenario.indexRate}
          />

          <AdBanner enabled={showAds} />

          {/* On mobile, show charts and table here; on tablet, they go below columns */}
          {!isTablet && (
            <>
              <View style={[styles.section, themedStyles.section]}>
                <LoanCharts
                  schedule={schedule}
                  visibilityRefs={{
                    balance: balanceChartRef,
                    payment: paymentChartRef,
                    composition: compositionChartRef,
                  }}
                />
              </View>

              <View style={[styles.section, themedStyles.section]}>
                <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>
                  Tabela de Amortização
                </Text>
                {totalInstallments > 0 && (
                  <View style={styles.tableMetaRow} testID={`table-meta-row-${totalInstallments}`}>
                    <Text
                      style={[styles.tableMetaText, { color: colors.textTertiary }]}
                      testID="text-table-visible-range"
                    >
                      Mostrando {Math.min(MAX_TABLE_ROWS, totalInstallments)} de {totalInstallments}{' '}
                      parcelas
                    </Text>
                  </View>
                )}
                <AmortizationTable
                  schedule={scheduleForTable}
                  totalSchedule={schedule}
                  showExtras
                />
                <View style={styles.subsectionTitleRow}>
                  <Text style={[styles.subsectionTitle, { color: colors.textSecondary }]}>
                    Gerar tabela completa
                  </Text>
                  <PremiumPill hidden={isPremium} />
                </View>
                {!isPremium ? (
                  <Text style={[styles.exportHint, { color: colors.textTertiary }]}>
                    {canUseRewardedExport
                      ? 'Grátis com anúncio por exportação, ou Premium para liberar tudo sem espera.'
                      : 'Disponível no Premium para liberar exportações ilimitadas.'}
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <Pressable
                    style={[styles.exportButton, exportFlowBusy && styles.primaryButtonDisabled]}
                    onPress={() => handleExportTableOnly('pdf')}
                    disabled={exportFlowBusy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: exportFlowBusy }}
                    accessibilityLabel="Gerar tabela completa em PDF"
                    testID="btn-export-table-pdf"
                  >
                    <View style={styles.buttonContent}>
                      {exportFlowBusy &&
                      (exportingFormat === 'pdf' || rewardedExportFormat === 'pdf') ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {exportFlowBusy &&
                        (exportingFormat === 'pdf' || rewardedExportFormat === 'pdf')
                          ? 'Preparando...'
                          : 'PDF'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.exportButton, exportFlowBusy && styles.primaryButtonDisabled]}
                    onPress={() => handleExportTableOnly('xlsx')}
                    disabled={exportFlowBusy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: exportFlowBusy }}
                    accessibilityLabel="Gerar tabela completa em XLSX"
                    testID="btn-export-table-xlsx"
                  >
                    <View style={styles.buttonContent}>
                      {exportFlowBusy &&
                      (exportingFormat === 'xlsx' || rewardedExportFormat === 'xlsx') ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {exportFlowBusy &&
                        (exportingFormat === 'xlsx' || rewardedExportFormat === 'xlsx')
                          ? 'Preparando...'
                          : 'XLSX'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.exportButton, exportFlowBusy && styles.primaryButtonDisabled]}
                    onPress={() => handleExportTableOnly('csv')}
                    disabled={exportFlowBusy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: exportFlowBusy }}
                    accessibilityLabel="Gerar tabela completa em CSV"
                    testID="btn-export-table-csv"
                  >
                    <View style={styles.buttonContent}>
                      {exportFlowBusy &&
                      (exportingFormat === 'csv' || rewardedExportFormat === 'csv') ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {exportFlowBusy &&
                        (exportingFormat === 'csv' || rewardedExportFormat === 'csv')
                          ? 'Preparando...'
                          : 'CSV'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
                {exportFlowBusy ? (
                  <View style={styles.exportingRow} accessibilityLiveRegion="polite">
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.exportingText, { color: colors.textTertiary }]}>
                      {getExportProgressText({ exporting, rewardedExportFormat })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          )}

          <View style={[styles.section, themedStyles.section]}>
            <Text
              style={[styles.sectionTitle, themedStyles.sectionTitle]}
              testID="section-prepayments"
            >
              Amortizações Extras
            </Text>
            <Text style={[styles.label, themedStyles.label]}>Data</Text>
            <Pressable
              style={[styles.input, styles.inputPressable, themedStyles.input]}
              onPress={() => setShowPrepaymentDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Selecionar data da amortização extra"
              testID="input-prepayment-date"
            >
              <Text style={[styles.inputText, { color: colors.text }]}>
                {newPrepayment.date ? formatDateBR(newPrepayment.date) : ''}
              </Text>
            </Pressable>
            {showPrepaymentDatePicker ? (
              <DateTimePicker
                value={newPrepayment.date ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handlePrepaymentDateChange}
              />
            ) : null}
            <Text style={[styles.label, themedStyles.label]}>Valor (R$)</Text>
            <TextInput
              value={
                newPrepayment.amount
                  ? `R$ ${newPrepayment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                  : ''
              }
              onChangeText={(text) => {
                const { value } = maskCurrencyInput(text);
                setNewPrepayment((prev) => ({ ...prev, amount: value }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="R$ 10.000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Valor da amortização extra"
              testID="input-prepayment-amount"
            />
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newPrepayment.type === 'fixed_amount' && themedStyles.chipActive,
                ]}
                onPress={() => setNewPrepayment((prev) => ({ ...prev, type: 'fixed_amount' }))}
                accessibilityRole="button"
                accessibilityState={{ selected: newPrepayment.type === 'fixed_amount' }}
                accessibilityLabel="Amortização por valor fixo"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newPrepayment.type === 'fixed_amount' && themedStyles.chipActiveText,
                  ]}
                >
                  Valor fixo
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newPrepayment.type === 'percentage' && themedStyles.chipActive,
                ]}
                onPress={() => setNewPrepayment((prev) => ({ ...prev, type: 'percentage' }))}
                accessibilityRole="button"
                accessibilityState={{ selected: newPrepayment.type === 'percentage' }}
                accessibilityLabel="Amortização por porcentagem do saldo"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newPrepayment.type === 'percentage' && themedStyles.chipActiveText,
                  ]}
                >
                  % do saldo
                </Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newPrepayment.strategy === 'reduce_term' && themedStyles.chipActive,
                ]}
                onPress={() => setNewPrepayment((prev) => ({ ...prev, strategy: 'reduce_term' }))}
                accessibilityRole="button"
                accessibilityState={{ selected: newPrepayment.strategy === 'reduce_term' }}
                accessibilityLabel="Reduzir prazo"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newPrepayment.strategy === 'reduce_term' && themedStyles.chipActiveText,
                  ]}
                >
                  Reduzir prazo
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newPrepayment.strategy === 'reduce_payment' && themedStyles.chipActive,
                ]}
                onPress={() =>
                  setNewPrepayment((prev) => ({ ...prev, strategy: 'reduce_payment' }))
                }
                accessibilityRole="button"
                accessibilityState={{ selected: newPrepayment.strategy === 'reduce_payment' }}
                accessibilityLabel="Reduzir parcela"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newPrepayment.strategy === 'reduce_payment' && themedStyles.chipActiveText,
                  ]}
                >
                  Reduzir parcela
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.label, themedStyles.label]}>Descrição (opcional)</Text>
            <TextInput
              value={newPrepayment.description ?? ''}
              onChangeText={(text) => setNewPrepayment((prev) => ({ ...prev, description: text }))}
              style={[styles.input, themedStyles.input]}
              placeholder="13º salário, bônus..."
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Descrição da amortização extra"
            />
            <Pressable
              style={styles.primaryButton}
              onPress={handleAddPrepayment}
              accessibilityRole="button"
              accessibilityLabel="Adicionar amortização extra"
              testID="btn-add-prepayment"
            >
              <Text style={styles.primaryButtonText} testID="label-add-prepayment">
                Adicionar amortização
              </Text>
            </Pressable>

            {(scenario.prepayments ?? []).length > 0 && (
              <View style={styles.list}>
                {(scenario.prepayments ?? []).map((payment) => (
                  <View
                    key={payment.id}
                    style={[styles.listItemRow, { borderColor: colors.border }]}
                  >
                    <View>
                      <Text style={[styles.listTitle, { color: colors.text }]}>
                        {payment.date.toLocaleDateString('pt-BR')} •{' '}
                        {formatCurrency(payment.amount)}
                      </Text>
                      <Text style={[styles.listSubtitle, { color: colors.textTertiary }]}>
                        {payment.strategy === 'reduce_term' ? 'Reduzir prazo' : 'Reduzir parcela'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemovePrepayment(payment.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Remover amortização"
                      hitSlop={8}
                    >
                      <Text style={[styles.deleteText, { color: colors.error }]}>Remover</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.section, themedStyles.section]} testID="section-fgts">
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>FGTS</Text>
            <Text style={[styles.label, themedStyles.label]}>Data</Text>
            <Pressable
              style={[styles.input, styles.inputPressable, themedStyles.input]}
              onPress={() => setShowFgtsDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Selecionar data do FGTS"
              testID="input-fgts-date"
            >
              <Text style={[styles.inputText, { color: colors.text }]}>
                {newFgts.date ? formatDateBR(newFgts.date) : ''}
              </Text>
            </Pressable>
            {showFgtsDatePicker ? (
              <DateTimePicker
                value={newFgts.date ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleFgtsDateChange}
              />
            ) : null}
            <Text style={[styles.label, themedStyles.label]}>Valor (R$)</Text>
            <TextInput
              value={
                newFgts.amount
                  ? `R$ ${newFgts.amount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                  : ''
              }
              onChangeText={(text) => {
                const { value } = maskCurrencyInput(text);
                setNewFgts((prev) => ({ ...prev, amount: value }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="R$ 20.000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Valor do FGTS"
              testID="input-fgts-amount"
            />
            <View style={styles.row}>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newFgts.usage === 'down_payment' && themedStyles.chipActive,
                ]}
                onPress={() => setNewFgts((prev) => ({ ...prev, usage: 'down_payment' }))}
                accessibilityRole="button"
                accessibilityState={{ selected: newFgts.usage === 'down_payment' }}
                accessibilityLabel="FGTS como entrada"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newFgts.usage === 'down_payment' && themedStyles.chipActiveText,
                  ]}
                >
                  Entrada
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newFgts.usage === 'amortization' && themedStyles.chipActive,
                ]}
                onPress={() => setNewFgts((prev) => ({ ...prev, usage: 'amortization' }))}
                accessibilityRole="button"
                accessibilityState={{ selected: newFgts.usage === 'amortization' }}
                accessibilityLabel="FGTS como amortização"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newFgts.usage === 'amortization' && themedStyles.chipActiveText,
                  ]}
                >
                  Amortização
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newFgts.usage === 'installment' && themedStyles.chipActive,
                ]}
                onPress={() => setNewFgts((prev) => ({ ...prev, usage: 'installment' }))}
                accessibilityRole="button"
                accessibilityState={{ selected: newFgts.usage === 'installment' }}
                accessibilityLabel="FGTS para parcela"
                testID="chip-fgts-usage-installment"
              >
                <Text
                  style={[
                    styles.chipText,
                    themedStyles.chipText,
                    newFgts.usage === 'installment' && themedStyles.chipActiveText,
                  ]}
                >
                  Parcela
                </Text>
              </Pressable>
            </View>
            {newFgts.usage === 'amortization' && (
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.chip,
                    themedStyles.chip,
                    newFgts.strategy === 'reduce_term' && themedStyles.chipActive,
                  ]}
                  onPress={() => setNewFgts((prev) => ({ ...prev, strategy: 'reduce_term' }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newFgts.strategy === 'reduce_term' }}
                  accessibilityLabel="FGTS reduzindo prazo"
                >
                  <Text
                    style={[
                      styles.chipText,
                      themedStyles.chipText,
                      newFgts.strategy === 'reduce_term' && themedStyles.chipActiveText,
                    ]}
                  >
                    Reduzir prazo
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    themedStyles.chip,
                    newFgts.strategy === 'reduce_payment' && themedStyles.chipActive,
                  ]}
                  onPress={() => setNewFgts((prev) => ({ ...prev, strategy: 'reduce_payment' }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newFgts.strategy === 'reduce_payment' }}
                  accessibilityLabel="FGTS reduzindo parcela"
                >
                  <Text
                    style={[
                      styles.chipText,
                      themedStyles.chipText,
                      newFgts.strategy === 'reduce_payment' && themedStyles.chipActiveText,
                    ]}
                  >
                    Reduzir parcela
                  </Text>
                </Pressable>
              </View>
            )}
            <Text style={[styles.label, themedStyles.label]}>Descrição (opcional)</Text>
            <TextInput
              value={newFgts.description ?? ''}
              onChangeText={(text) => setNewFgts((prev) => ({ ...prev, description: text }))}
              style={[styles.input, themedStyles.input]}
              placeholder="Uso do FGTS..."
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Descrição do FGTS"
            />
            <Pressable
              style={styles.primaryButton}
              onPress={handleAddFgts}
              accessibilityRole="button"
              accessibilityLabel="Adicionar FGTS"
              testID="btn-add-fgts"
            >
              <Text style={styles.primaryButtonText} testID="label-add-fgts">
                Adicionar FGTS
              </Text>
            </Pressable>

            {(scenario.fgtsEvents ?? []).length > 0 && (
              <View style={styles.list}>
                {(scenario.fgtsEvents ?? []).map((event) => (
                  <View key={event.id} style={[styles.listItemRow, { borderColor: colors.border }]}>
                    <View>
                      <Text style={[styles.listTitle, { color: colors.text }]}>
                        {event.date.toLocaleDateString('pt-BR')} • {formatCurrency(event.amount)}
                      </Text>
                      <Text style={[styles.listSubtitle, { color: colors.textTertiary }]}>
                        {event.usage === 'down_payment'
                          ? 'Entrada'
                          : event.usage === 'amortization'
                            ? 'Amortização'
                            : 'Parcela'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveFgts(event.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Remover FGTS"
                      hitSlop={8}
                      testID="btn-remove-fgts"
                    >
                      <Text style={[styles.deleteText, { color: colors.error }]}>Remover</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Full-width sections for tablet (spanning both columns) */}
      {isTablet && (
        <>
          <View style={[styles.section, themedStyles.section]}>
            <LoanCharts
              schedule={schedule}
              visibilityRefs={{
                balance: balanceChartRef,
                payment: paymentChartRef,
                composition: compositionChartRef,
              }}
            />
          </View>

          <View style={[styles.section, themedStyles.section]}>
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>
              Tabela de Amortização
            </Text>
            {totalInstallments > 0 && (
              <View style={styles.tableMetaRow} testID={`table-meta-row-${totalInstallments}`}>
                <Text
                  style={[styles.tableMetaText, { color: colors.textTertiary }]}
                  testID="text-table-visible-range"
                >
                  Mostrando {Math.min(MAX_TABLE_ROWS, totalInstallments)} de {totalInstallments}{' '}
                  parcelas
                </Text>
              </View>
            )}
            <AmortizationTable schedule={scheduleForTable} totalSchedule={schedule} showExtras />
            <View style={styles.subsectionTitleRow}>
              <Text style={[styles.subsectionTitle, { color: colors.textSecondary }]}>
                Gerar tabela completa
              </Text>
              <PremiumPill hidden={isPremium} />
            </View>
            {!isPremium ? (
              <Text style={[styles.exportHint, { color: colors.textTertiary }]}>
                {canUseRewardedExport
                  ? 'Grátis com anúncio por exportação, ou Premium para liberar tudo sem espera.'
                  : 'Disponível no Premium para liberar exportações ilimitadas.'}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Pressable
                style={[styles.exportButton, exportFlowBusy && styles.primaryButtonDisabled]}
                onPress={() => handleExportTableOnly('pdf')}
                disabled={exportFlowBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: exportFlowBusy }}
                accessibilityLabel="Gerar tabela completa em PDF"
                testID="btn-export-table-pdf"
              >
                <View style={styles.buttonContent}>
                  {exportFlowBusy &&
                  (exportingFormat === 'pdf' || rewardedExportFormat === 'pdf') ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.primaryButtonText}>
                    {exportFlowBusy && (exportingFormat === 'pdf' || rewardedExportFormat === 'pdf')
                      ? 'Preparando...'
                      : 'PDF'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.exportButton, exportFlowBusy && styles.primaryButtonDisabled]}
                onPress={() => handleExportTableOnly('xlsx')}
                disabled={exportFlowBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: exportFlowBusy }}
                accessibilityLabel="Gerar tabela completa em XLSX"
                testID="btn-export-table-xlsx"
              >
                <View style={styles.buttonContent}>
                  {exportFlowBusy &&
                  (exportingFormat === 'xlsx' || rewardedExportFormat === 'xlsx') ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.primaryButtonText}>
                    {exportFlowBusy &&
                    (exportingFormat === 'xlsx' || rewardedExportFormat === 'xlsx')
                      ? 'Preparando...'
                      : 'XLSX'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.exportButton, exportFlowBusy && styles.primaryButtonDisabled]}
                onPress={() => handleExportTableOnly('csv')}
                disabled={exportFlowBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: exportFlowBusy }}
                accessibilityLabel="Gerar tabela completa em CSV"
                testID="btn-export-table-csv"
              >
                <View style={styles.buttonContent}>
                  {exportFlowBusy &&
                  (exportingFormat === 'csv' || rewardedExportFormat === 'csv') ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.primaryButtonText}>
                    {exportFlowBusy && (exportingFormat === 'csv' || rewardedExportFormat === 'csv')
                      ? 'Preparando...'
                      : 'CSV'}
                  </Text>
                </View>
              </Pressable>
            </View>
            {exportFlowBusy ? (
              <View style={styles.exportingRow} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.exportingText, { color: colors.textTertiary }]}>
                  {getExportProgressText({ exporting, rewardedExportFormat })}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      <AdBanner enabled={showAds} />

      <ScenarioLimitPaywall
        visible={scenarioLimitPaywallVisible}
        iapAvailability={iapAvailability}
        isPremium={isPremium}
        markPremium={markPremium}
        onClose={closeScenarioLimitPaywall}
      />

      <PostExportPaywall
        visible={postExportPaywallVisible}
        iapAvailability={iapAvailability}
        isPremium={isPremium}
        markPremium={markPremium}
        onClose={() => setPostExportPaywallVisible(false)}
      />

      <Modal
        animationType="fade"
        transparent
        visible={pendingProfessionalExport !== null}
        onRequestClose={cancelProfessionalExport}
      >
        <View style={styles.professionalModalBackdrop} testID="professional-export-modal">
          <View style={styles.professionalModalCard}>
            <Text style={styles.professionalModalTitle}>PDF Profissional</Text>
            <Text style={styles.professionalModalText}>
              Informe o nome do cliente se quiser exibi-lo na capa do relatório.
            </Text>
            <TextInput
              value={professionalClientName}
              onChangeText={setProfessionalClientName}
              placeholder="Nome do cliente (opcional)"
              style={styles.professionalModalInput}
              testID="professional-export-client-name"
              accessibilityLabel="Nome do cliente para PDF Profissional"
            />
            <View style={styles.professionalModalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={cancelProfessionalExport}
                accessibilityRole="button"
                accessibilityLabel="Cancelar PDF Profissional"
                testID="professional-export-cancel"
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  void confirmProfessionalExport();
                }}
                accessibilityRole="button"
                accessibilityLabel="Gerar PDF Profissional"
                testID="professional-export-confirm"
              >
                <Text style={styles.primaryButtonText}>Gerar PDF</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={exporting}
        statusBarTranslucent
        accessibilityViewIsModal
      >
        <View
          style={styles.exportProgressBackdrop}
          testID="export-progress-modal"
          accessibilityLiveRegion="polite"
        >
          <View
            style={[
              styles.exportProgressCard,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[styles.exportProgressTitle, { color: colors.text }]}
              testID="export-progress-title"
            >
              {getExportProgressTitle(exportingFormat)}
            </Text>
            <Text style={[styles.exportProgressText, { color: colors.textSecondary }]}>
              {Platform.OS === 'android'
                ? 'Preparando o arquivo. Escolha onde salvar ou compartilhar em seguida.'
                : 'Preparando o arquivo. A tela de compartilhamento vai abrir em seguida.'}
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#F7F7F7',
  },
  containerTablet: {
    paddingHorizontal: 24,
    paddingTop: 24,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1F2937',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  columns: {
    flexDirection: 'column',
  },
  columnsTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  column: {
    width: '100%',
  },
  columnTablet: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculatingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  subsectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  inputPressable: {
    justifyContent: 'center',
  },
  inputText: {
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
    minWidth: 120,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  toggleButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#1D4ED8',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  chipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  premiumBadgeText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryLabel: {
    color: '#374151',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    flexGrow: 1,
    minWidth: 70,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  professionalModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  professionalModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  professionalModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  professionalModalText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
  },
  professionalModalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    color: '#111827',
  },
  professionalModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  exportProgressBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  exportProgressCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  exportProgressTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  exportProgressText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  list: {
    gap: 8,
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
  },
  listItemRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemContent: {
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  listSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  deleteText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  bannerWarning: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
  },
  bannerWarningText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
  warningText: {
    color: '#D97706',
    fontSize: 13,
  },
  helperText: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
  },
  exportHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 2,
  },
  exportingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  tableMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  tableMetaText: {
    color: '#6B7280',
    fontSize: 12,
  },
});
