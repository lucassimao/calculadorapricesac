import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
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
import type {
  CorrectionIndexType,
  EntryMode,
  FgtsEvent,
  PrepaymentEvent,
  RateType,
  Scenario,
} from '@loan-engine/loan';
import {
  calculateLoanSummary,
  formatCurrency,
  generateAmortizationSchedule,
  MIXED_PREPAYMENT_STRATEGIES_WARNING,
  OUT_OF_TERM_EVENT_WARNING_FRAGMENT,
  validateScenario,
} from '@loan-engine/calculations';
import { fetchLatestIndexRate } from '../../src/lib/bacen';
import {
  formatDateBR,
  maskCurrencyInput,
  parseCurrencyInput,
  parseNumberInput,
} from '../../src/lib/utils';
import { AmortizationTable } from '../../src/components/AmortizationTable';
import { LoanCharts } from '../../src/components/LoanCharts';
import {
  AmortizeOrInvestSection,
  IndexSelector,
  EntryModeSelector,
  InsuranceCostsSection,
  PortabilitySection,
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
  createDismissSafeExportAlertOptions,
  isAnyExportFlowBusy,
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
import {
  createOnboardingExampleScenario,
  isOnboardingExampleScenario,
} from '../../src/lib/onboarding-example';
import { canStartExportAttempt, claimExportClick } from '../../src/lib/export-sheet-outcome';
import {
  buildRecurringFgtsEvents,
  buildRecurringPrepaymentEvents,
  canAppendFgtsInstallmentEvents,
  FGTS_RULES_SOURCE,
  FGTS_RULES_REVIEWED_LABEL,
  getFgtsRecurrencePolicy,
  getFgtsUsageExplainer,
  trimEventsToSchedule,
  trimFgtsEventsToSchedule,
  type Recurrence,
  type RecurringFgtsEvent,
  type RecurringPrepaymentEvent,
} from '../../src/lib/recurring-events';
import {
  createExistingContractScenario,
  getExistingContractBalanceDate,
  getScenarioEntryMode,
  inferExistingContractDueDay,
} from '../../src/lib/existing-contract';
import { calculatePrepaymentImpact } from '../../src/lib/prepayment-impact';
import {
  calculatePortabilityComparison,
  parsePortabilityProposalInputs,
  type NominalCashFlowComparison,
} from '../../src/lib/portability';
import {
  getScenarioAnalyticsContext,
  trackCalculationPerformed,
  trackPortabilityCompared,
} from '../../src/lib/scenario-analytics';
import { getEstimatedMipRateForAge } from '../../src/lib/insurance-rates';
import {
  INVESTMENT_RATE_PRESETS,
  compareAmortizeOrInvest,
  type AmortizeOrInvestResult,
  type InvestmentTaxRegime,
  type InvestmentVehicle,
} from '../../src/lib/amortize-or-invest';
import {
  checkInvestmentReferenceRateChange,
  type InvestmentReferenceRateChange,
} from '../../src/lib/investment-rate-change';

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
const INITIAL_ONBOARDING_EXAMPLE = createOnboardingExampleScenario(new Date());

const MAX_TABLE_ROWS = 10;
interface PendingProfessionalExport {
  source: string;
  brandProfile: BrandProfile;
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Uma vez',
  monthly: 'Mensal',
  yearly: 'Anual',
  biennial: 'A cada 2 anos',
};

function getScenarioTermMonths(scenario: Scenario) {
  return scenario.termUnit === 'years' ? scenario.term * 12 : scenario.term;
}

function countPrunedExistingEvents(
  scenario: Scenario,
  nextPrepayments: PrepaymentEvent[],
  nextFgtsEvents: FgtsEvent[],
) {
  const remainingKeys = new Set([
    ...nextPrepayments.map((event) => `prepayment:${event.id}`),
    ...nextFgtsEvents.map((event) => `fgts:${event.id}`),
  ]);
  return [
    ...(scenario.prepayments ?? []).map((event) => `prepayment:${event.id}`),
    ...(scenario.fgtsEvents ?? []).map((event) => `fgts:${event.id}`),
  ].filter((key) => !remainingKeys.has(key)).length;
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
  const [scenario, setScenarioState] = useState<Scenario>(INITIAL_ONBOARDING_EXAMPLE);
  const [onboardingExampleVisible, setOnboardingExampleVisible] = useState(true);
  const onboardingExampleScenarioRef = useRef<Scenario>(INITIAL_ONBOARDING_EXAMPLE);
  const updateScenarioFromUser = useCallback((update: SetStateAction<Scenario>) => {
    setOnboardingExampleVisible(false);
    setScenarioState(update);
  }, []);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [principalText, setPrincipalText] = useState('R$ 320.000');
  const [propertyValueText, setPropertyValueText] = useState('R$ 400.000');
  const [downPaymentText, setDownPaymentText] = useState('R$ 80.000');
  const [rateText, setRateText] = useState('11,5');
  const [indexRateText, setIndexRateText] = useState('');
  const [indexRateLabel, setIndexRateLabel] = useState<string | null>(null);
  const [indexRateHelper, setIndexRateHelper] = useState<string | null>(null);
  const [indexRateLoading, setIndexRateLoading] = useState(false);
  const lastAutoFetchIndexType = useRef<CorrectionIndexType | null>(null);
  const manualIndexRateEdited = useRef(false);
  const [termText, setTermText] = useState('360');
  const [startDateText, setStartDateText] = useState(
    formatDateBR(INITIAL_ONBOARDING_EXAMPLE.startDate),
  );
  const [nextDueDateText, setNextDueDateText] = useState('');
  const [dueDayText, setDueDayText] = useState('5');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [borrowerAgeText, setBorrowerAgeText] = useState('');
  const [mipRateText, setMipRateText] = useState('0');
  const [dfiRateText, setDfiRateText] = useState('0');
  const [adminFeeText, setAdminFeeText] = useState('');
  const [adminFeeRateText, setAdminFeeRateText] = useState<string | undefined>(undefined);
  const [iofRateText, setIofRateText] = useState('0');
  const [openingFeeText, setOpeningFeeText] = useState('0');
  const [itbiRateText, setItbiRateText] = useState('0');
  const [registryFeeText, setRegistryFeeText] = useState('0');
  const [portabilityRateText, setPortabilityRateText] = useState('');
  const [portabilityRateType, setPortabilityRateType] = useState<RateType>('annual');
  const [portabilityTermText, setPortabilityTermText] = useState('');
  const [portabilityCostsText, setPortabilityCostsText] = useState('');
  const [portabilityError, setPortabilityError] = useState<string | null>(null);
  const [portabilityResult, setPortabilityResult] = useState<NominalCashFlowComparison | null>(
    null,
  );
  const [investmentAmountText, setInvestmentAmountText] = useState('');
  const [investmentVehicle, setInvestmentVehicle] = useState<InvestmentVehicle>('cdi');
  const [investmentAnnualRateText, setInvestmentAnnualRateText] = useState(
    String(INVESTMENT_RATE_PRESETS.cdi.annualRate).replace('.', ','),
  );
  const [investmentHorizonText, setInvestmentHorizonText] = useState('60');
  const [investmentTaxRegime, setInvestmentTaxRegime] = useState<InvestmentTaxRegime>('regressive');
  const [amortizeOrInvestResult, setAmortizeOrInvestResult] =
    useState<AmortizeOrInvestResult | null>(null);
  const [amortizeOrInvestError, setAmortizeOrInvestError] = useState<string | null>(null);
  const [investmentRateChange, setInvestmentRateChange] =
    useState<InvestmentReferenceRateChange | null>(null);
  const isPropertyMode = scenario.loanMode === 'property';
  const isExistingContract = getScenarioEntryMode(scenario) === 'existing_contract';
  const [tabActionExportPhase, setTabActionExportPhase] = useState<TabActionExportPhase>('idle');
  const [newFgts, setNewFgts] = useState<Partial<FgtsEvent>>({
    amount: 0,
    usage: 'amortization',
    strategy: 'reduce_term',
    date: new Date(),
  });
  const [fgtsRecurrence, setFgtsRecurrence] = useState<Recurrence>('biennial');
  const [editingFgtsId, setEditingFgtsId] = useState<string | null>(null);
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
  const [prepaymentRecurrence, setPrepaymentRecurrence] = useState<Recurrence>('none');
  const [editingPrepaymentId, setEditingPrepaymentId] = useState<string | null>(null);
  const [showAllPrepayments, setShowAllPrepayments] = useState(false);
  const [showPrepaymentDatePicker, setShowPrepaymentDatePicker] = useState(false);
  const [showFgtsDatePicker, setShowFgtsDatePicker] = useState(false);
  const hasSkippedInitialCalculation = useRef(false);
  const exportClickBusyRef = useRef(false);
  const mixedStrategyWarningShown = useRef(false);
  const outOfTermWarningShown = useRef(false);
  const calculatorScrollRef = useRef<ScrollView>(null);
  const amortizeOrInvestSectionRef = useRef<View>(null);
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
    let cancelled = false;
    const checkRateChange = async () => {
      const preset = INVESTMENT_RATE_PRESETS.cdi;
      const change = await checkInvestmentReferenceRateChange({
        annualRate: preset.annualRate,
        asOf: preset.asOf,
      });
      if (!cancelled && change) setInvestmentRateChange(change);
    };
    void checkRateChange().catch(() => {});
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkRateChange().catch(() => {});
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

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

  useEffect(() => {
    const example = onboardingExampleScenarioRef.current;
    if (onboardingExampleVisible && example && !isOnboardingExampleScenario(scenario, example)) {
      setOnboardingExampleVisible(false);
    }
  }, [onboardingExampleVisible, scenario]);

  // Sync principal display when in property mode
  useEffect(() => {
    if (isPropertyMode && scenario.propertyValue && scenario.downPayment !== undefined) {
      const computed = Math.max(scenario.propertyValue - (scenario.downPayment ?? 0), 0);
      const formatted =
        computed > 0
          ? `R$ ${computed.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
          : '';
      setPrincipalText(formatted);
      setScenarioState((prev) =>
        prev.principal === computed ? prev : { ...prev, principal: computed },
      );
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
        setScenarioState((prev) =>
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
  const existingContractVerificationSchedule = useMemo(
    () =>
      isExistingContract
        ? generateAmortizationSchedule({ ...scenario, prepayments: [], fgtsEvents: [] })
        : [],
    [isExistingContract, scenario],
  );
  const computedCurrentInstallment =
    existingContractVerificationSchedule[1]?.totalCost ??
    existingContractVerificationSchedule[1]?.payment;
  const prepaymentImpact = useMemo(
    () => (isExistingContract ? calculatePrepaymentImpact(scenario) : null),
    [isExistingContract, scenario],
  );
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
    setPortabilityResult(null);
    setPortabilityError(null);
    setAmortizeOrInvestResult(null);
    setAmortizeOrInvestError(null);
  }, [scenario]);

  const handleCompareAmortizeOrInvest = () => {
    try {
      const result = compareAmortizeOrInvest({
        scenario,
        extraAmount: parseCurrencyInput(investmentAmountText),
        investmentAnnualRate: parseNumberInput(investmentAnnualRateText),
        horizonMonths: Number(investmentHorizonText),
        taxRegime: investmentTaxRegime,
      });
      setAmortizeOrInvestResult(result);
      setAmortizeOrInvestError(null);
    } catch (error) {
      setAmortizeOrInvestResult(null);
      setAmortizeOrInvestError(
        error instanceof Error ? error.message : 'Não foi possível comparar os caminhos.',
      );
    }
  };

  const handleComparePortability = () => {
    if (!isExistingContract) {
      setPortabilityResult(null);
      setPortabilityError('Informe taxa, prazo e custos válidos para a nova proposta.');
      return;
    }

    try {
      const proposal = parsePortabilityProposalInputs({
        rateText: portabilityRateText,
        rateType: portabilityRateType,
        termText: portabilityTermText,
        costsText: portabilityCostsText,
      });
      const result = calculatePortabilityComparison(scenario, proposal);
      setPortabilityResult(result);
      setPortabilityError(null);
      trackPortabilityCompared(result.breakEvenMonth);
    } catch {
      setPortabilityResult(null);
      setPortabilityError('Não foi possível comparar. Revise os dados informados.');
    }
  };

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
      trackCalculationPerformed(scenario, schedule.length);
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

  const persistScenarios = async (nextScenarios: Scenario[]): Promise<boolean> => {
    try {
      await saveScenarios(nextScenarios);
      setScenarios(nextScenarios);
      return true;
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'O cenário não foi alterado. Tente novamente.',
      );
      return false;
    }
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
    let newId: string | null = null;
    if (existingIndex >= 0) {
      nextList[existingIndex] = scenario;
    } else {
      newId = Date.now().toString();
      nextList.unshift({ ...scenario, id: newId });
    }
    if (!(await persistScenarios(nextList))) return;
    if (newId) {
      updateScenarioFromUser((prev) => ({ ...prev, id: newId }));
    }
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
    updateScenarioFromUser(target);
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
    setNextDueDateText(target.nextDueDate ? formatDateBR(target.nextDueDate) : '');
    setDueDayText(String(target.dueDay));
    setBorrowerAgeText(target.borrowerAge ? String(target.borrowerAge) : '');
    setMipRateText(
      (target.mipRate ?? target.insuranceRate)
        ? String(target.mipRate ?? target.insuranceRate).replace('.', ',')
        : '0',
    );
    setDfiRateText(target.dfiRate ? String(target.dfiRate).replace('.', ',') : '0');
    setAdminFeeText(formatCurrencyValue(target.adminFee));
    setAdminFeeRateText(
      target.adminFeeRate ? String(target.adminFeeRate).replace('.', ',') : undefined,
    );
    setIofRateText(target.iofRate ? String(target.iofRate).replace('.', ',') : '0');
    setOpeningFeeText(formatCurrencyValue(target.openingFee));
    setItbiRateText(target.itbiRate ? String(target.itbiRate).replace('.', ',') : '0');
    setRegistryFeeText(formatCurrencyValue(target.registryFee));
    setPortabilityRateText('');
    setPortabilityRateType(target.rateType);
    setPortabilityTermText(
      getScenarioEntryMode(target) === 'existing_contract' ? String(target.term) : '',
    );
    setPortabilityCostsText('');
    setPortabilityError(null);
    setPortabilityResult(null);
    setNewPrepayment({
      amount: 0,
      type: 'fixed_amount',
      strategy: 'reduce_term',
      date: new Date(),
    });
    setPrepaymentRecurrence('none');
    setEditingPrepaymentId(null);
    setShowAllPrepayments(false);
    setNewFgts({
      amount: 0,
      usage: 'amortization',
      strategy: 'reduce_term',
      date: new Date(),
    });
    setFgtsRecurrence('biennial');
    setEditingFgtsId(null);
  };

  const handleDeleteScenario = (id: string, name: string) => {
    Alert.alert('Excluir cenário', `Tem certeza que deseja excluir "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const nextList = scenarios.filter((s) => s.id !== id);
          if (!(await persistScenarios(nextList))) return;
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
    const seriesId = editingPrepaymentId ?? Date.now().toString();
    const originalEvent = (scenario.prepayments ?? []).find(
      (event) => event.id === editingPrepaymentId,
    ) as RecurringPrepaymentEvent | undefined;
    if (editingPrepaymentId && !originalEvent) {
      resetPrepaymentDraft();
      Alert.alert('Evento não encontrado', 'A amortização não existe mais neste cenário.');
      return;
    }
    let nextEvents = buildRecurringPrepaymentEvents({
      seriesId,
      startDate: new Date(newPrepayment.date),
      loanStartDate: scenario.startDate,
      firstDueDate: isExistingContract ? scenario.nextDueDate : undefined,
      termMonths: getScenarioTermMonths(scenario),
      dueDay: scenario.dueDay,
      recurrence: editingPrepaymentId ? 'none' : prepaymentRecurrence,
      amount: newPrepayment.amount,
      type: newPrepayment.type as PrepaymentEvent['type'],
      strategy: newPrepayment.strategy as PrepaymentEvent['strategy'],
      description: newPrepayment.description,
    });
    if (editingPrepaymentId && nextEvents[0]) {
      nextEvents = [
        {
          ...nextEvents[0],
          id: editingPrepaymentId,
          recurrence: originalEvent?.recurrence ?? 'none',
        },
      ];
    }
    if (nextEvents.length === 0) {
      Alert.alert(
        'Data fora do contrato',
        'Escolha uma data entre o início e o fim do financiamento.',
      );
      return;
    }
    const tentativePrepayments = editingPrepaymentId
      ? (scenario.prepayments ?? []).map((event) =>
          event.id === editingPrepaymentId ? nextEvents[0] : event,
        )
      : [...(scenario.prepayments ?? []), ...nextEvents];
    const tentativeFgtsEvents = scenario.fgtsEvents ?? [];
    const tentativeSchedule = generateAmortizationSchedule({
      ...scenario,
      prepayments: tentativePrepayments,
      fgtsEvents: tentativeFgtsEvents,
    });
    const trimmedPrepayments = trimEventsToSchedule(tentativePrepayments, tentativeSchedule);
    const trimmedFgtsEvents = trimFgtsEventsToSchedule(tentativeFgtsEvents, tentativeSchedule);
    const survivingEventIds = new Set(trimmedPrepayments.map((event) => event.id));
    nextEvents = nextEvents.filter((event) => survivingEventIds.has(event.id));
    if (nextEvents.length === 0) {
      Alert.alert(
        'Data fora do contrato',
        'Escolha uma data entre o início e o fim do financiamento.',
      );
      return;
    }
    const commit = () => {
      updateScenarioFromUser((prev) => ({
        ...prev,
        prepayments: trimmedPrepayments,
        fgtsEvents: trimmedFgtsEvents,
      }));
      resetPrepaymentDraft();
      if (!editingPrepaymentId) {
        trackEvent('prepayment_added', {
          type: nextEvents[0].type,
          strategy: nextEvents[0].strategy,
          recurrence: nextEvents[0].recurrence,
          months_from_start: getMonthsFromStartBucket(scenario.startDate, nextEvents[0].date),
          ...getScenarioAnalyticsContext(scenario, schedule.length),
          prepayment_count_after: trimmedPrepayments.length,
        });
      }
    };
    const prunedExistingCount = countPrunedExistingEvents(
      scenario,
      trimmedPrepayments,
      trimmedFgtsEvents,
    );
    if (prunedExistingCount > 0) {
      Alert.alert(
        'Eventos após a quitação',
        `${prunedExistingCount} ${prunedExistingCount === 1 ? 'evento será removido' : 'eventos serão removidos'} porque ficou após a nova data de quitação.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Remover e salvar', style: 'destructive', onPress: commit },
        ],
      );
      return;
    }
    commit();
  };

  const handleEditPrepayment = (event: PrepaymentEvent) => {
    setNewPrepayment({ ...event, date: new Date(event.date) });
    setPrepaymentRecurrence('none');
    setEditingPrepaymentId(event.id);
  };

  const resetPrepaymentDraft = (date = new Date()) => {
    setNewPrepayment({
      amount: 0,
      type: 'fixed_amount',
      strategy: 'reduce_term',
      date,
    });
    setPrepaymentRecurrence('none');
    setEditingPrepaymentId(null);
  };

  const handleRemovePrepayment = (id: string) => {
    const nextPrepayments = (scenario.prepayments ?? []).filter((p) => p.id !== id);
    updateScenarioFromUser((prev) => ({
      ...prev,
      prepayments: nextPrepayments,
    }));
    trackEvent('prepayment_removed', {
      remaining_prepayments: nextPrepayments.length,
      ...getScenarioAnalyticsContext(scenario, schedule.length),
    });
    if (editingPrepaymentId === id) resetPrepaymentDraft();
  };

  const handleAddFgts = () => {
    if (!newFgts.amount || !newFgts.date) {
      Alert.alert('FGTS incompleto', 'Informe data e valor.');
      return;
    }
    const usage = newFgts.usage as FgtsEvent['usage'];
    const seriesId = editingFgtsId ?? Date.now().toString();
    const originalEvent = (scenario.fgtsEvents ?? []).find(
      (event) => event.id === editingFgtsId,
    ) as RecurringFgtsEvent | undefined;
    if (editingFgtsId && !originalEvent) {
      resetFgtsDraft();
      Alert.alert('Evento não encontrado', 'O uso do FGTS não existe mais neste cenário.');
      return;
    }
    let nextEvents = buildRecurringFgtsEvents({
      seriesId,
      startDate: usage === 'down_payment' ? scenario.startDate : new Date(newFgts.date),
      loanStartDate: scenario.startDate,
      firstDueDate: isExistingContract ? scenario.nextDueDate : undefined,
      termMonths: getScenarioTermMonths(scenario),
      dueDay: scenario.dueDay,
      recurrence: editingFgtsId ? 'none' : fgtsRecurrence,
      amount: newFgts.amount,
      usage,
      strategy: newFgts.strategy,
      description: newFgts.description,
    });
    if (editingFgtsId && nextEvents[0]) {
      const originalRecurrence = originalEvent?.recurrence ?? 'none';
      const allowedRecurrences = getFgtsRecurrencePolicy(usage).allowedRecurrences;
      nextEvents = [
        {
          ...nextEvents[0],
          id: editingFgtsId,
          recurrence: allowedRecurrences.includes(originalRecurrence) ? originalRecurrence : 'none',
        },
      ];
    }
    if (nextEvents.length === 0) {
      Alert.alert(
        'Data fora do contrato',
        'Escolha uma data entre o início e o fim do financiamento.',
      );
      return;
    }
    const fgtsEventsWithoutEdited = (scenario.fgtsEvents ?? []).filter(
      (event) => event.id !== editingFgtsId,
    );
    if (!canAppendFgtsInstallmentEvents(fgtsEventsWithoutEdited, nextEvents)) {
      Alert.alert(
        'Limite de parcelas com FGTS',
        'O plano pode ter no máximo 12 prestações consecutivas com abatimento do FGTS.',
      );
      return;
    }
    const tentativeFgtsEvents = editingFgtsId
      ? (scenario.fgtsEvents ?? []).map((event) =>
          event.id === editingFgtsId ? nextEvents[0] : event,
        )
      : [...(scenario.fgtsEvents ?? []), ...nextEvents];
    const tentativePrepayments = scenario.prepayments ?? [];
    const tentativeSchedule = generateAmortizationSchedule({
      ...scenario,
      prepayments: tentativePrepayments,
      fgtsEvents: tentativeFgtsEvents,
    });
    const trimmedPrepayments = trimEventsToSchedule(tentativePrepayments, tentativeSchedule);
    const trimmedFgtsEvents = trimFgtsEventsToSchedule(tentativeFgtsEvents, tentativeSchedule);
    const survivingEventIds = new Set(trimmedFgtsEvents.map((event) => event.id));
    nextEvents = nextEvents.filter((event) => survivingEventIds.has(event.id));
    if (nextEvents.length === 0) {
      Alert.alert(
        'Data fora do contrato',
        'Escolha uma data entre o início e o fim do financiamento.',
      );
      return;
    }
    const commit = () => {
      updateScenarioFromUser((prev) => ({
        ...prev,
        prepayments: trimmedPrepayments,
        fgtsEvents: trimmedFgtsEvents,
      }));
      resetFgtsDraft();
      if (!editingFgtsId) {
        trackEvent('fgts_added', {
          usage: nextEvents[0].usage,
          strategy: nextEvents[0].strategy ?? null,
          recurrence: nextEvents[0].recurrence,
          months_from_start: getMonthsFromStartBucket(scenario.startDate, nextEvents[0].date),
          ...getScenarioAnalyticsContext(scenario, schedule.length),
          fgts_event_count_after: trimmedFgtsEvents.length,
        });
      }
    };
    const prunedExistingCount = countPrunedExistingEvents(
      scenario,
      trimmedPrepayments,
      trimmedFgtsEvents,
    );
    if (prunedExistingCount > 0) {
      Alert.alert(
        'Eventos após a quitação',
        `${prunedExistingCount} ${prunedExistingCount === 1 ? 'evento será removido' : 'eventos serão removidos'} porque ficou após a nova data de quitação.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Remover e salvar', style: 'destructive', onPress: commit },
        ],
      );
      return;
    }
    commit();
  };

  const handleEditFgts = (event: FgtsEvent) => {
    setNewFgts({ ...event, date: new Date(event.date) });
    setFgtsRecurrence('none');
    setEditingFgtsId(event.id);
  };

  const resetFgtsDraft = (date = new Date()) => {
    setNewFgts({
      amount: 0,
      usage: 'amortization',
      strategy: 'reduce_term',
      date,
    });
    setFgtsRecurrence('biennial');
    setEditingFgtsId(null);
  };

  const handleRemoveFgts = (id: string) => {
    const nextFgtsEvents = (scenario.fgtsEvents ?? []).filter((event) => event.id !== id);
    updateScenarioFromUser((prev) => ({
      ...prev,
      fgtsEvents: nextFgtsEvents,
    }));
    trackEvent('fgts_removed', {
      remaining_fgts_events: nextFgtsEvents.length,
      ...getScenarioAnalyticsContext(scenario, schedule.length),
    });
    if (editingFgtsId === id) resetFgtsDraft();
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Close picker on Android always, on iOS only when date is set
    if (Platform.OS === 'android' || event.type === 'set') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    if (isExistingContract) {
      updateScenarioFromUser((prev) => ({
        ...prev,
        startDate: getExistingContractBalanceDate(selectedDate),
        nextDueDate: selectedDate,
        dueDay: inferExistingContractDueDay(selectedDate),
      }));
      setNextDueDateText(formatDateBR(selectedDate));
      setDueDayText(String(inferExistingContractDueDay(selectedDate)));
    } else {
      updateScenarioFromUser((prev) => ({ ...prev, startDate: selectedDate }));
      setStartDateText(formatDateBR(selectedDate));
    }
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
    (format: ExportFormat, source: string, tableOnly: boolean, onSettled: () => void) => {
      trackEvent('rewarded_export_gate_shown', { format, source });
      Alert.alert(
        'Exportação grátis com anúncio',
        'Assista a um anúncio para liberar esta exportação ou assine o Premium para exportar sem limites e sem anúncios.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => {
              trackEvent('rewarded_export_declined', { format, source, choice: 'cancel' });
              onSettled();
            },
          },
          {
            text: 'Ver Premium',
            onPress: () => {
              trackEvent('rewarded_export_declined', { format, source, choice: 'premium' });
              onSettled();
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
              void startRewardedExportFlow({ format, source, tableOnly }).finally(onSettled);
            },
          },
        ],
        createDismissSafeExportAlertOptions(onSettled),
      );
    },
    [router, startRewardedExportFlow],
  );

  const handleExportTableOnly = useCallback(
    async (format: ExportFormat) => {
      if (!canStartExportAttempt(validation.errors.length)) {
        Alert.alert('Atenção', 'Revise os dados antes de exportar.');
        return;
      }
      if (!claimExportClick(exportClickBusyRef, exporting || rewardedExportFormat !== null)) {
        return;
      }
      trackEvent('export_clicked', {
        format,
        source: 'table_only',
        table_only: true,
        is_premium: isPremium,
        rewarded_available: canUseRewardedExport,
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });

      if (!isPremium) {
        if (canUseRewardedExport) {
          promptUpgradeForExport(format, 'table_only', true, () => {
            exportClickBusyRef.current = false;
          });
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
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                exportClickBusyRef.current = false;
              },
            },
            {
              text: 'Ver Premium',
              onPress: () => {
                exportClickBusyRef.current = false;
                trackEvent('export_upgrade_clicked', {
                  source: 'table_only',
                  placement: 'blocked_alert',
                });
                setPendingPaywallSource('export_upgrade');
                router.push('/(tabs)/premium');
              },
            },
          ],
          createDismissSafeExportAlertOptions(() => {
            exportClickBusyRef.current = false;
          }),
        );
        return;
      }

      try {
        await runExport({ format, source: 'table_only', tableOnly: true });
      } finally {
        exportClickBusyRef.current = false;
      }
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
      validation.errors.length,
    ],
  );

  const seedExportExtrasForDev = () => {
    const fixedDate = new Date(2026, 0, 1);
    const firstDueDate = new Date(2026, 1, 5);
    updateScenarioFromUser((prev) => ({
      ...DEFAULT_SCENARIO,
      id: prev.id,
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
    setPrincipalText('R$ 300.000');
    setPropertyValueText('');
    setDownPaymentText('');
    setRateText('1,2');
    setTermText('360');
    setStartDateText(formatDateBR(fixedDate));
    setDueDayText('5');
    setIndexRateText('');
    setIndexRateLabel(null);
    setIndexRateHelper(null);
    manualIndexRateEdited.current = false;
    setBorrowerAgeText('');
    setMipRateText('0');
    setDfiRateText('0');
    setAdminFeeText('');
    setAdminFeeRateText(undefined);
    setIofRateText('0');
    setOpeningFeeText('');
    setItbiRateText('0');
    setRegistryFeeText('');
  };

  const seedMixedStrategiesForDev = () => {
    const fixedDate = new Date(2026, 0, 1);
    const firstDueDate = new Date(2026, 1, 5);
    updateScenarioFromUser((prev) => ({
      ...DEFAULT_SCENARIO,
      id: prev.id,
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
    setPrincipalText('R$ 300.000');
    setPropertyValueText('');
    setDownPaymentText('');
    setRateText('1,2');
    setTermText('360');
    setStartDateText(formatDateBR(fixedDate));
    setDueDayText('5');
    setIndexRateText('');
    setIndexRateLabel(null);
    setIndexRateHelper(null);
    manualIndexRateEdited.current = false;
    setBorrowerAgeText('');
    setMipRateText('0');
    setDfiRateText('0');
    setAdminFeeText('');
    setAdminFeeRateText(undefined);
    setIofRateText('0');
    setOpeningFeeText('');
    setItbiRateText('0');
    setRegistryFeeText('');
  };

  const seedOutOfTermWarningForDev = () => {
    const fixedDate = new Date(2026, 0, 1);
    updateScenarioFromUser((prev) => ({
      ...DEFAULT_SCENARIO,
      id: prev.id,
      startDate: fixedDate,
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
    setPrincipalText('R$ 300.000');
    setPropertyValueText('');
    setDownPaymentText('');
    setRateText('1,2');
    setTermText('1');
    setStartDateText(formatDateBR(fixedDate));
    setDueDayText('5');
    setIndexRateText('');
    setIndexRateLabel(null);
    setIndexRateHelper(null);
    manualIndexRateEdited.current = false;
    setBorrowerAgeText('');
    setMipRateText('0');
    setDfiRateText('0');
    setAdminFeeText('');
    setAdminFeeRateText(undefined);
    setIofRateText('0');
    setOpeningFeeText('');
    setItbiRateText('0');
    setRegistryFeeText('');
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
    (format: ExportFormat, options?: ExportTriggerOptions) => {
      const professional = Boolean(options?.professional);
      if (!canStartExportAttempt(validation.errors.length)) {
        Alert.alert('Atenção', 'Revise os dados antes de exportar.');
        return 'validation_blocked';
      }
      if (!claimExportClick(exportClickBusyRef, exporting || rewardedExportFormat !== null)) {
        return 'busy';
      }

      trackEvent('export_clicked', {
        format,
        source: 'tab_action',
        table_only: false,
        professional,
        is_premium: isPremium,
        rewarded_available: canUseRewardedExport,
        ...getScenarioAnalyticsContext(scenario, schedule.length),
      });

      if (professional && !isPremium) {
        Alert.alert('Premium', 'PDF Profissional disponível apenas para assinantes.');
        trackEvent('export_blocked_premium', {
          format,
          source: 'tab_action',
          professional: true,
          rewarded_available: canUseRewardedExport,
          ...getScenarioAnalyticsContext(scenario, schedule.length),
        });
        trackEvent('export_upgrade_clicked', {
          source: 'tab_action',
          placement: 'professional_blocked_redirect',
        });
        setPendingPaywallSource('export_upgrade');
        router.push('/(tabs)/premium');
        exportClickBusyRef.current = false;
        return 'handled';
      }

      if (!isPremium) {
        if (canUseRewardedExport) {
          void startRewardedExportFlow({ format, source: 'tab_action' }).finally(() => {
            exportClickBusyRef.current = false;
          });
          return 'handled';
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
        exportClickBusyRef.current = false;
        return 'handled';
      }

      if (professional) {
        void startProfessionalExportFlow('tab_action').finally(() => {
          exportClickBusyRef.current = false;
        });
        return 'handled';
      }

      void runExport({ format, source: 'tab_action' }).finally(() => {
        exportClickBusyRef.current = false;
      });
      return 'started';
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
      validation.errors.length,
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

  const handleEntryModeChange = (entryMode: EntryMode) => {
    if (entryMode === getScenarioEntryMode(scenario)) return;

    const commit = () => {
      if (entryMode === 'existing_contract') {
        const nextDueDate = schedule.find((row) => row.installmentNumber === 1)?.date ?? new Date();
        const existingScenario = createExistingContractScenario({
          id: scenario.id,
          name: scenario.name,
          system: scenario.system,
          currentBalance: scenario.principal,
          rate: scenario.rate,
          rateType: scenario.rateType,
          remainingInstallments: getScenarioTermMonths(scenario),
          nextDueDate,
          propertyValue: scenario.propertyValue,
          borrowerAge: scenario.borrowerAge,
          mipRate: scenario.mipRate ?? scenario.insuranceRate,
          dfiRate: scenario.dfiRate,
          adminFee: scenario.adminFee,
          adminFeeRate: scenario.adminFeeRate,
          indexType: scenario.indexType,
          indexRate: scenario.indexRate,
        });
        updateScenarioFromUser(existingScenario);
        setPrincipalText(formatCurrencyValue(existingScenario.principal));
        setTermText(String(existingScenario.term));
        setNextDueDateText(formatDateBR(nextDueDate));
        setStartDateText(formatDateBR(existingScenario.startDate));
        setDueDayText(String(existingScenario.dueDay));
        setIofRateText('0');
        setOpeningFeeText('');
        setPropertyValueText(formatCurrencyValue(existingScenario.propertyValue));
        setDownPaymentText('');
        setItbiRateText('0');
        setRegistryFeeText('');
        setPortabilityRateText('');
        setPortabilityRateType(existingScenario.rateType);
        setPortabilityTermText(String(existingScenario.term));
        setPortabilityCostsText('');
      } else {
        const nextScenario: Scenario = {
          ...scenario,
          entryMode: 'new_loan',
          nextDueDate: undefined,
          loanMode: 'standard',
          termUnit: 'months',
          startDate: new Date(),
          prepayments: [],
          fgtsEvents: [],
          propertyValue: undefined,
          downPayment: undefined,
          dfiRate: undefined,
          insuranceChargeTiming: undefined,
          includeInsurance: (scenario.mipRate ?? scenario.insuranceRate ?? 0) > 0,
          itbiRate: undefined,
          registryFee: undefined,
        };
        updateScenarioFromUser(nextScenario);
        setStartDateText(formatDateBR(nextScenario.startDate));
        setDueDayText(String(nextScenario.dueDay));
        setNextDueDateText('');
        setPropertyValueText('');
        setDfiRateText('0');
        setDownPaymentText('');
        setPortabilityRateText('');
        setPortabilityTermText('');
        setPortabilityCostsText('');
      }
      setPortabilityError(null);
      setPortabilityResult(null);
      const draftDate =
        entryMode === 'existing_contract'
          ? schedule.find((row) => row.installmentNumber === 1)?.date
          : undefined;
      resetPrepaymentDraft(draftDate ?? new Date());
      resetFgtsDraft(draftDate ?? new Date());
      setShowAllPrepayments(false);
    };

    const eventCount = (scenario.prepayments?.length ?? 0) + (scenario.fgtsEvents?.length ?? 0);
    const hasNewLoanOnlyData =
      entryMode === 'existing_contract' &&
      (scenario.loanMode === 'property' ||
        Boolean(scenario.includeIOF && (scenario.iofRate ?? 0) > 0) ||
        Boolean(scenario.includeOpeningFee && (scenario.openingFee ?? 0) > 0) ||
        (scenario.itbiRate ?? 0) > 0 ||
        (scenario.registryFee ?? 0) > 0);
    if (eventCount > 0 || hasNewLoanOnlyData) {
      const removedParts = [
        hasNewLoanOnlyData ? 'dados da contratação' : null,
        eventCount > 0
          ? `${eventCount} ${eventCount === 1 ? 'evento de amortização/FGTS' : 'eventos de amortização/FGTS'}`
          : null,
      ].filter((part): part is string => part !== null);
      Alert.alert(
        'Trocar tipo de simulação?',
        `A troca removerá ${removedParts.join(' e ')} para iniciar o novo cálculo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Trocar e limpar', style: 'destructive', onPress: commit },
        ],
      );
      return;
    }
    commit();
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
    setIsExporting(
      isAnyExportFlowBusy({
        tabActionPhase: tabActionExportPhase,
        rewardedExportFormat,
        exporting,
      }),
    );
  }, [exporting, rewardedExportFormat, tabActionExportPhase, setIsExporting]);

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
      ref={calculatorScrollRef}
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

      {investmentRateChange ? (
        <View
          style={[
            styles.rateChangeBanner,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}
          testID="investment-rate-change-banner"
        >
          <Pressable
            style={styles.rateChangeBannerContent}
            onPress={() => {
              const scrollView = calculatorScrollRef.current;
              const nativeScrollView = scrollView?.getNativeScrollRef();
              if (!scrollView || !nativeScrollView) return;
              amortizeOrInvestSectionRef.current?.measureLayout(nativeScrollView, (_x, y) => {
                scrollView.scrollTo({ y: Math.max(y - 12, 0), animated: true });
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Abrir comparador amortizar ou investir"
            testID="btn-open-amortize-invest"
          >
            <Text style={[styles.rateChangeBannerTitle, { color: colors.primary }]}>
              A taxa mudou — vale mais amortizar ou investir agora?
            </Text>
            <Text style={[styles.rateChangeBannerText, { color: colors.textSecondary }]}>
              CDI de {investmentRateChange.previousAnnualRate.toFixed(2).replace('.', ',')}% para{' '}
              {investmentRateChange.currentAnnualRate.toFixed(2).replace('.', ',')}% a.a. Toque para
              recalcular.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setInvestmentRateChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar aviso de mudança da taxa"
            hitSlop={12}
            testID="btn-dismiss-investment-rate-change"
          >
            <Text style={[styles.rateChangeBannerDismiss, { color: colors.primary }]}>×</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.columns, isTablet && styles.columnsTablet]}>
        {/* Column 1: Input Forms */}
        <View style={[styles.column, isTablet && styles.columnTablet]}>
          {onboardingExampleVisible ? (
            <View
              style={[
                styles.onboardingExampleChip,
                { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              testID="onboarding-example-chip"
            >
              <View style={styles.onboardingExampleCopy}>
                <Text style={[styles.onboardingExampleTitle, { color: colors.primary }]}>
                  Exemplo
                </Text>
                <Text style={[styles.onboardingExampleText, { color: colors.textSecondary }]}>
                  Imóvel de R$ 400.000, entrada de 20%, 11,5% a.a., 360 meses, SAC
                </Text>
              </View>
              <Pressable
                onPress={() => setOnboardingExampleVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Dispensar exemplo"
                hitSlop={8}
                testID="btn-dismiss-onboarding-example"
              >
                <Text style={[styles.onboardingExampleDismiss, { color: colors.primary }]}>×</Text>
              </Pressable>
            </View>
          ) : null}
          <ScenarioSection
            scenario={scenario}
            scenarios={scenarios}
            onNameChange={(name) => updateScenarioFromUser((prev) => ({ ...prev, name }))}
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

          <EntryModeSelector
            entryMode={getScenarioEntryMode(scenario)}
            onChange={handleEntryModeChange}
          />

          <SystemSelector
            system={scenario.system}
            loanMode={scenario.loanMode ?? 'standard'}
            hideLoanMode={isExistingContract}
            onSystemChange={(system) => updateScenarioFromUser((prev) => ({ ...prev, system }))}
            onLoanModeChange={(mode) => {
              if (mode === 'standard') {
                setPropertyValueText('');
                setDownPaymentText('');
                setDfiRateText('0');
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  loanMode: 'standard',
                  propertyValue: undefined,
                  downPayment: undefined,
                  itbiRate: undefined,
                  registryFee: undefined,
                  dfiRate: undefined,
                  insuranceChargeTiming: undefined,
                  includeInsurance: (prev.mipRate ?? prev.insuranceRate ?? 0) > 0,
                }));
              } else {
                updateScenarioFromUser((prev) => ({ ...prev, loanMode: 'property' }));
              }
            }}
          />

          <View style={[styles.section, themedStyles.section]} testID="section-parameters">
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Parâmetros</Text>

            <Text style={[styles.label, themedStyles.label]}>
              {isExistingContract ? 'Saldo devedor atual (R$)' : 'Valor do Financiamento (R$)'}
            </Text>
            <TextInput
              value={principalText}
              onChangeText={(text) => {
                const { display, value } = maskCurrencyInput(text);
                setPrincipalText(display);
                updateScenarioFromUser((prev) => ({ ...prev, principal: value }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="R$ 300.000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={
                isExistingContract ? 'Saldo devedor atual' : 'Valor do financiamento'
              }
              testID="input-principal"
            />

            {isExistingContract ? (
              <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                Informe o saldo imediatamente após a última parcela paga.
              </Text>
            ) : null}

            {!isExistingContract && isPropertyMode && (
              <>
                <Text style={[styles.label, themedStyles.label]}>Valor do Imóvel (R$)</Text>
                <TextInput
                  value={propertyValueText}
                  onChangeText={(text) => {
                    const { display, value } = maskCurrencyInput(text);
                    setPropertyValueText(display);
                    updateScenarioFromUser((prev) => ({ ...prev, propertyValue: value }));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholder="R$ 500.000"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Valor do imóvel"
                  testID="input-property-value"
                />

                <Text style={[styles.label, themedStyles.label]}>Entrada (R$)</Text>
                <TextInput
                  value={downPaymentText}
                  onChangeText={(text) => {
                    const { display, value } = maskCurrencyInput(text);
                    setDownPaymentText(display);
                    updateScenarioFromUser((prev) => ({ ...prev, downPayment: value }));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholder="R$ 100.000"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Entrada"
                  testID="input-down-payment"
                />
              </>
            )}

            <Text style={[styles.label, themedStyles.label]}>Taxa de Juros</Text>
            <View style={styles.rowWrap}>
              <TextInput
                value={rateText}
                onChangeText={(text) => {
                  setRateText(text);
                  updateScenarioFromUser((prev) => ({ ...prev, rate: parseNumberInput(text) }));
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
                    onPress={() => updateScenarioFromUser((prev) => ({ ...prev, rateType }))}
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
                updateScenarioFromUser((prev) => ({
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
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  indexRate: normalized === '' || Number.isNaN(value) ? undefined : value,
                }));
              }}
            />

            <Text style={[styles.label, themedStyles.label]}>
              {isExistingContract ? 'Número de parcelas restantes' : 'Prazo'}
            </Text>
            <View style={styles.rowWrap}>
              <TextInput
                value={termText}
                onChangeText={(text) => {
                  setTermText(text);
                  const parsed = Number.parseInt(text || '0', 10);
                  updateScenarioFromUser((prev) => ({
                    ...prev,
                    term: Number.isNaN(parsed) ? 0 : parsed,
                  }));
                }}
                keyboardType="numeric"
                style={[styles.input, styles.inputFlex, themedStyles.input]}
                placeholder="360"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel={isExistingContract ? 'Parcelas restantes' : 'Prazo'}
                testID="input-term"
              />
              {isExistingContract ? null : (
                <View style={styles.toggleRow}>
                  {(['months', 'years'] as const).map((termUnit) => (
                    <Pressable
                      key={termUnit}
                      onPress={() => updateScenarioFromUser((prev) => ({ ...prev, termUnit }))}
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
              )}
            </View>

            <Text style={[styles.label, themedStyles.label]}>
              {isExistingContract ? 'Data da próxima parcela' : 'Data de Início'}
            </Text>
            <Pressable
              style={[styles.input, styles.inputPressable, themedStyles.input]}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={
                isExistingContract
                  ? 'Selecionar data da próxima parcela'
                  : 'Selecionar data de início'
              }
              testID={isExistingContract ? 'input-next-due-date' : 'input-start-date'}
            >
              <Text style={[styles.inputText, { color: colors.text }]}>
                {isExistingContract ? nextDueDateText : startDateText}
              </Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={
                  isExistingContract && scenario.nextDueDate
                    ? scenario.nextDueDate
                    : scenario.startDate
                }
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
              />
            ) : null}
            {isExistingContract ? (
              <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                Se a próxima parcela cair no fim de fevereiro, assumimos vencimento no último dia
                dos meses seguintes. Datas no dia 30 continuam no dia 30.
              </Text>
            ) : null}

            {isExistingContract ? null : (
              <>
                <Text style={[styles.label, themedStyles.label]}>Dia de Vencimento</Text>
                <TextInput
                  value={dueDayText}
                  onChangeText={(text) => {
                    setDueDayText(text);
                    const parsed = Number.parseInt(text || '0', 10);
                    if (!Number.isNaN(parsed)) {
                      updateScenarioFromUser((prev) => ({ ...prev, dueDay: parsed }));
                    }
                  }}
                  keyboardType="numeric"
                  style={[styles.input, themedStyles.input]}
                  placeholder="5"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Dia de vencimento"
                  testID="input-due-day"
                />
              </>
            )}

            {isExistingContract && computedCurrentInstallment !== undefined ? (
              <View
                style={[
                  styles.computedInstallment,
                  { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                testID="existing-contract-computed-installment"
              >
                <Text style={[styles.computedInstallmentLabel, { color: colors.textSecondary }]}>
                  Parcela calculada para conferência
                </Text>
                <Text style={[styles.computedInstallmentValue, { color: colors.primary }]}>
                  {formatCurrency(computedCurrentInstallment)}
                </Text>
                <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                  Compare com o boleto. Diferenças podem indicar seguros ou tarifas ainda não
                  informados.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Custos e Taxas - moved to column 1 for better balance */}
          <View style={[styles.section, themedStyles.section]}>
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Custos e Taxas</Text>
            <Text style={[styles.helperText, { color: colors.textTertiary }]}>
              {isExistingContract
                ? 'Informe apenas seguros e tarifas mensais que ainda aparecem no boleto.'
                : 'MIP incide no saldo devedor; DFI, no valor do imóvel. Custos iniciais são cobrados na assinatura.'}
            </Text>
            {isExistingContract ? null : (
              <>
                <Text style={[styles.label, themedStyles.label]}>IOF (% do financiado)</Text>
                <TextInput
                  value={iofRateText}
                  onChangeText={(text) => {
                    setIofRateText(text);
                    updateScenarioFromUser((prev) => ({
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
              </>
            )}

            <InsuranceCostsSection
              borrowerAgeText={borrowerAgeText}
              mipRateText={mipRateText}
              dfiRateText={dfiRateText}
              adminFeeText={adminFeeText}
              legacyAdminFeeRateText={adminFeeRateText}
              showDfi={isPropertyMode || isExistingContract}
              showInsuranceTiming={isPropertyMode && !isExistingContract}
              insuranceChargeTiming={scenario.insuranceChargeTiming ?? 'monthly'}
              isExistingContract={isExistingContract}
              propertyValueText={propertyValueText}
              onPropertyValueTextChange={(text) => {
                const { display, value } = maskCurrencyInput(text);
                setPropertyValueText(display);
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  propertyValue: value > 0 ? value : undefined,
                }));
              }}
              onBorrowerAgeTextChange={(text) => {
                setBorrowerAgeText(text);
              }}
              onBorrowerAgeBlur={() => {
                const normalizedAge = borrowerAgeText.trim();
                const age = /^\d+$/.test(normalizedAge) ? Number(normalizedAge) : undefined;
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  borrowerAge: age,
                }));
              }}
              onApplyAgeEstimate={() => {
                const normalizedAge = borrowerAgeText.trim();
                const estimate = /^\d+$/.test(normalizedAge)
                  ? getEstimatedMipRateForAge(Number(normalizedAge))
                  : null;
                if (estimate === null) {
                  Alert.alert(
                    'Idade sem estimativa',
                    'Informe uma idade inteira entre 18 e 80 anos.',
                  );
                  return;
                }
                setMipRateText(String(estimate).replace('.', ','));
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  insuranceRate: undefined,
                  borrowerAge: Number(normalizedAge),
                  mipRate: estimate,
                  includeInsurance: estimate > 0 || (prev.dfiRate ?? 0) > 0,
                }));
              }}
              onMipRateTextChange={(text) => {
                setMipRateText(text);
                const mipRate = parseNumberInput(text);
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  insuranceRate: undefined,
                  mipRate,
                  includeInsurance: mipRate > 0 || (prev.dfiRate ?? 0) > 0,
                }));
              }}
              onDfiRateTextChange={(text) => {
                setDfiRateText(text);
                const dfiRate = parseNumberInput(text);
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  dfiRate,
                  includeInsurance: dfiRate > 0 || (prev.mipRate ?? prev.insuranceRate ?? 0) > 0,
                }));
              }}
              onInsuranceChargeTimingChange={(insuranceChargeTiming) => {
                updateScenarioFromUser((prev) => ({ ...prev, insuranceChargeTiming }));
              }}
              onAdminFeeTextChange={(text) => {
                const { display, value } = maskCurrencyInput(text);
                setAdminFeeText(display);
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  adminFeeRate: value > 0 ? undefined : parseNumberInput(adminFeeRateText ?? '0'),
                  adminFee: value,
                  includeAdminFee: value > 0 || parseNumberInput(adminFeeRateText ?? '0') > 0,
                }));
              }}
              onLegacyAdminFeeRateTextChange={(text) => {
                setAdminFeeRateText(text);
                const adminFeeRate = parseNumberInput(text);
                updateScenarioFromUser((prev) => ({
                  ...prev,
                  adminFeeRate,
                  includeAdminFee: adminFeeRate > 0 || (prev.adminFee ?? 0) > 0,
                }));
              }}
            />

            {isExistingContract ? null : (
              <>
                <Text style={[styles.label, themedStyles.label]}>Taxa de abertura (R$)</Text>
                <TextInput
                  value={openingFeeText}
                  onChangeText={(text) => {
                    const { display, value } = maskCurrencyInput(text);
                    setOpeningFeeText(display);
                    updateScenarioFromUser((prev) => ({
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
              </>
            )}

            {!isExistingContract && isPropertyMode && (
              <>
                <Text style={[styles.label, themedStyles.label]}>ITBI (% do imóvel)</Text>
                <TextInput
                  value={itbiRateText}
                  onChangeText={(text) => {
                    setItbiRateText(text);
                    updateScenarioFromUser((prev) => ({
                      ...prev,
                      itbiRate: parseNumberInput(text),
                    }));
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
                    updateScenarioFromUser((prev) => ({ ...prev, registryFee: value }));
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

          {isExistingContract ? (
            <PortabilitySection
              rateText={portabilityRateText}
              rateType={portabilityRateType}
              termText={portabilityTermText}
              costsText={portabilityCostsText}
              onRateTextChange={(text) => {
                setPortabilityRateText(text);
                setPortabilityError(null);
                setPortabilityResult(null);
              }}
              onRateTypeChange={(rateType) => {
                setPortabilityRateType(rateType);
                setPortabilityError(null);
                setPortabilityResult(null);
              }}
              onTermTextChange={(text) => {
                setPortabilityTermText(text);
                setPortabilityError(null);
                setPortabilityResult(null);
              }}
              onCostsTextChange={(text) => {
                setPortabilityCostsText(maskCurrencyInput(text).display);
                setPortabilityError(null);
                setPortabilityResult(null);
              }}
              onCompare={handleComparePortability}
              error={portabilityError}
              result={portabilityResult}
            />
          ) : null}

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
            cetNotApplicable={isExistingContract}
            insuranceChargeTiming={scenario.insuranceChargeTiming}
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
            {prepaymentImpact ? (
              <View
                style={[
                  styles.prepaymentImpact,
                  { backgroundColor: colors.successLight, borderColor: colors.success },
                ]}
                testID="existing-contract-prepayment-impact"
              >
                <Text style={[styles.prepaymentImpactTitle, { color: colors.success }]}>
                  Impacto no contrato atual
                </Text>
                <Text style={[styles.prepaymentImpactValue, { color: colors.text }]}>
                  Juros economizados: {formatCurrency(prepaymentImpact.interestSaved)}
                </Text>
                {prepaymentImpact.installmentsSaved > 0 ? (
                  <Text style={[styles.prepaymentImpactText, { color: colors.textSecondary }]}>
                    Nova quitação: {formatDateBR(prepaymentImpact.newPayoffDate)} ·{' '}
                    {prepaymentImpact.installmentsSaved}{' '}
                    {prepaymentImpact.installmentsSaved === 1
                      ? 'parcela a menos'
                      : 'parcelas a menos'}
                  </Text>
                ) : prepaymentImpact.paymentBefore !== undefined &&
                  prepaymentImpact.paymentAfter !== undefined ? (
                  <Text style={[styles.prepaymentImpactText, { color: colors.textSecondary }]}>
                    Parcela seguinte: {formatCurrency(prepaymentImpact.paymentAfter)} (antes{' '}
                    {formatCurrency(prepaymentImpact.paymentBefore)}) · prazo mantido
                  </Text>
                ) : (
                  <Text style={[styles.prepaymentImpactText, { color: colors.textSecondary }]}>
                    Prazo mantido; a economia aparece nas parcelas seguintes.
                  </Text>
                )}
              </View>
            ) : null}
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
            {editingPrepaymentId ? (
              <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                Editando somente esta ocorrência; as demais datas da série não mudam.
              </Text>
            ) : (
              <>
                <Text style={[styles.label, themedStyles.label]}>Frequência</Text>
                <View style={styles.row}>
                  {(['none', 'monthly', 'yearly', 'biennial'] as Recurrence[]).map((recurrence) => (
                    <Pressable
                      key={recurrence}
                      style={[
                        styles.chip,
                        themedStyles.chip,
                        prepaymentRecurrence === recurrence && themedStyles.chipActive,
                      ]}
                      onPress={() => setPrepaymentRecurrence(recurrence)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: prepaymentRecurrence === recurrence }}
                      accessibilityLabel={`Frequência ${RECURRENCE_LABELS[recurrence]}`}
                      testID={`chip-prepayment-recurrence-${recurrence}`}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          themedStyles.chipText,
                          prepaymentRecurrence === recurrence && themedStyles.chipActiveText,
                        ]}
                      >
                        {RECURRENCE_LABELS[recurrence]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
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
                {editingPrepaymentId ? 'Salvar amortização' : 'Adicionar amortização'}
              </Text>
            </Pressable>
            {editingPrepaymentId && (
              <Pressable
                style={[styles.secondaryButton, styles.centeredButton]}
                onPress={() => resetPrepaymentDraft()}
                accessibilityRole="button"
                accessibilityLabel="Cancelar edição da amortização"
                testID="btn-cancel-edit-prepayment"
              >
                <Text style={styles.secondaryButtonText}>Cancelar edição</Text>
              </Pressable>
            )}

            {(scenario.prepayments ?? []).length > 0 && (
              <View style={styles.list}>
                <Text
                  style={[styles.listSubtitle, { color: colors.textTertiary }]}
                  testID="prepayment-event-count"
                >
                  {(scenario.prepayments ?? []).length}{' '}
                  {(scenario.prepayments ?? []).length === 1 ? 'evento' : 'eventos'} no plano
                </Text>
                {(showAllPrepayments
                  ? (scenario.prepayments ?? [])
                  : (scenario.prepayments ?? []).slice(0, 24)
                ).map((payment) => (
                  <View
                    key={payment.id}
                    style={[styles.listItemRow, { borderColor: colors.border }]}
                  >
                    <View style={styles.listItemContent}>
                      <Text style={[styles.listTitle, { color: colors.text }]}>
                        {payment.date.toLocaleDateString('pt-BR')} •{' '}
                        {formatCurrency(payment.amount)}
                      </Text>
                      <Text style={[styles.listSubtitle, { color: colors.textTertiary }]}>
                        {payment.strategy === 'reduce_term' ? 'Reduzir prazo' : 'Reduzir parcela'}
                        {' · '}
                        {
                          RECURRENCE_LABELS[
                            (payment as RecurringPrepaymentEvent).recurrence ?? 'none'
                          ]
                        }
                      </Text>
                    </View>
                    <View style={styles.listActions}>
                      <Pressable
                        onPress={() => handleEditPrepayment(payment)}
                        accessibilityRole="button"
                        accessibilityLabel="Editar amortização"
                        hitSlop={8}
                        testID="btn-edit-prepayment"
                      >
                        <Text style={[styles.editText, { color: colors.primary }]}>Editar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemovePrepayment(payment.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Remover amortização"
                        hitSlop={8}
                      >
                        <Text style={[styles.deleteText, { color: colors.error }]}>Remover</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {(scenario.prepayments ?? []).length > 24 && (
                  <Pressable
                    style={[styles.secondaryButton, styles.centeredButton]}
                    onPress={() => setShowAllPrepayments((current) => !current)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showAllPrepayments ? 'Mostrar menos eventos' : 'Mostrar todos os eventos'
                    }
                    testID="btn-toggle-all-prepayments"
                  >
                    <Text style={styles.secondaryButtonText}>
                      {showAllPrepayments
                        ? 'Mostrar menos'
                        : `Mostrar todos os ${(scenario.prepayments ?? []).length} eventos`}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          <View style={[styles.section, themedStyles.section]} testID="section-fgts">
            <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>FGTS</Text>
            <Text style={[styles.label, themedStyles.label]}>Data</Text>
            {newFgts.usage === 'down_payment' ? (
              <View style={[styles.input, styles.inputPressable, themedStyles.input]}>
                <Text
                  style={[styles.inputText, { color: colors.text }]}
                  testID="fgts-down-payment-date"
                >
                  Na contratação: {formatDateBR(scenario.startDate)}
                </Text>
              </View>
            ) : (
              <>
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
              </>
            )}
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
              {isExistingContract ? null : (
                <Pressable
                  style={[
                    styles.chip,
                    themedStyles.chip,
                    newFgts.usage === 'down_payment' && themedStyles.chipActive,
                  ]}
                  onPress={() => {
                    setNewFgts((prev) => ({
                      ...prev,
                      usage: 'down_payment',
                      strategy: undefined,
                    }));
                    setFgtsRecurrence('none');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newFgts.usage === 'down_payment' }}
                  accessibilityLabel="FGTS como entrada"
                  testID="chip-fgts-usage-down-payment"
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
              )}
              <Pressable
                style={[
                  styles.chip,
                  themedStyles.chip,
                  newFgts.usage === 'amortization' && themedStyles.chipActive,
                ]}
                onPress={() => {
                  setNewFgts((prev) => ({
                    ...prev,
                    usage: 'amortization',
                    strategy: 'reduce_term',
                  }));
                  setFgtsRecurrence(editingFgtsId ? 'none' : 'biennial');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: newFgts.usage === 'amortization' }}
                accessibilityLabel="FGTS como amortização"
                testID="chip-fgts-usage-amortization"
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
                onPress={() => {
                  setNewFgts((prev) => ({ ...prev, usage: 'installment', strategy: undefined }));
                  setFgtsRecurrence(editingFgtsId ? 'none' : 'monthly');
                }}
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
            <Text
              style={[styles.helperText, { color: colors.textTertiary }]}
              testID="fgts-usage-explainer"
            >
              {getFgtsUsageExplainer(newFgts.usage ?? 'amortization')}
            </Text>
            <Pressable
              onPress={() => void Linking.openURL(FGTS_RULES_SOURCE)}
              accessibilityRole="link"
              accessibilityLabel="Abrir regras oficiais do FGTS"
              testID="fgts-rules-link"
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>
                Regras oficiais do FGTS (consultadas em {FGTS_RULES_REVIEWED_LABEL})
              </Text>
            </Pressable>
            {editingFgtsId ? (
              <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                Editando somente esta ocorrência; as demais datas da série não mudam.
              </Text>
            ) : (
              <>
                <Text style={[styles.label, themedStyles.label]}>Frequência</Text>
                <View style={styles.row}>
                  {getFgtsRecurrencePolicy(newFgts.usage ?? 'amortization').allowedRecurrences.map(
                    (recurrence) => (
                      <Pressable
                        key={recurrence}
                        style={[
                          styles.chip,
                          themedStyles.chip,
                          fgtsRecurrence === recurrence && themedStyles.chipActive,
                        ]}
                        onPress={() => setFgtsRecurrence(recurrence)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: fgtsRecurrence === recurrence }}
                        accessibilityLabel={`Frequência FGTS ${RECURRENCE_LABELS[recurrence]}`}
                        testID={`chip-fgts-recurrence-${recurrence}`}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            themedStyles.chipText,
                            fgtsRecurrence === recurrence && themedStyles.chipActiveText,
                          ]}
                        >
                          {newFgts.usage === 'installment' && recurrence === 'monthly'
                            ? '12 parcelas'
                            : RECURRENCE_LABELS[recurrence]}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </>
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
                {editingFgtsId ? 'Salvar FGTS' : 'Adicionar FGTS'}
              </Text>
            </Pressable>
            {editingFgtsId && (
              <Pressable
                style={[styles.secondaryButton, styles.centeredButton]}
                onPress={() => resetFgtsDraft()}
                accessibilityRole="button"
                accessibilityLabel="Cancelar edição do FGTS"
                testID="btn-cancel-edit-fgts"
              >
                <Text style={styles.secondaryButtonText}>Cancelar edição</Text>
              </Pressable>
            )}

            {(scenario.fgtsEvents ?? []).length > 0 && (
              <View style={styles.list}>
                <Text
                  style={[styles.listSubtitle, { color: colors.textTertiary }]}
                  testID="fgts-event-count"
                >
                  {(scenario.fgtsEvents ?? []).length}{' '}
                  {(scenario.fgtsEvents ?? []).length === 1 ? 'evento' : 'eventos'} de FGTS
                </Text>
                {(scenario.fgtsEvents ?? []).map((event) => (
                  <View key={event.id} style={[styles.listItemRow, { borderColor: colors.border }]}>
                    <View style={styles.listItemContent}>
                      <Text style={[styles.listTitle, { color: colors.text }]}>
                        {event.date.toLocaleDateString('pt-BR')} • {formatCurrency(event.amount)}
                      </Text>
                      <Text style={[styles.listSubtitle, { color: colors.textTertiary }]}>
                        {event.usage === 'down_payment'
                          ? 'Entrada'
                          : event.usage === 'amortization'
                            ? 'Amortização'
                            : 'Parcela'}
                        {' · '}
                        {RECURRENCE_LABELS[(event as RecurringFgtsEvent).recurrence ?? 'none']}
                      </Text>
                    </View>
                    <View style={styles.listActions}>
                      <Pressable
                        onPress={() => handleEditFgts(event)}
                        accessibilityRole="button"
                        accessibilityLabel="Editar FGTS"
                        hitSlop={8}
                        testID="btn-edit-fgts"
                      >
                        <Text style={[styles.editText, { color: colors.primary }]}>Editar</Text>
                      </Pressable>
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
                  </View>
                ))}
              </View>
            )}
          </View>

          <View ref={amortizeOrInvestSectionRef} collapsable={false}>
            <AmortizeOrInvestSection
              amountText={investmentAmountText}
              vehicle={investmentVehicle}
              annualRateText={investmentAnnualRateText}
              horizonText={investmentHorizonText}
              taxRegime={investmentTaxRegime}
              isPremium={isPremium}
              result={amortizeOrInvestResult}
              error={amortizeOrInvestError}
              onAmountTextChange={(text) => {
                const { display } = maskCurrencyInput(text);
                setInvestmentAmountText(display);
                setAmortizeOrInvestResult(null);
              }}
              onVehicleChange={(vehicle) => {
                setInvestmentVehicle(vehicle);
                setInvestmentAnnualRateText(
                  String(INVESTMENT_RATE_PRESETS[vehicle].annualRate).replace('.', ','),
                );
                setAmortizeOrInvestResult(null);
                setAmortizeOrInvestError(null);
              }}
              onAnnualRateTextChange={(text) => {
                setInvestmentAnnualRateText(text);
                setAmortizeOrInvestResult(null);
              }}
              onHorizonTextChange={(text) => {
                setInvestmentHorizonText(text.replace(/\D/g, ''));
                setAmortizeOrInvestResult(null);
              }}
              onTaxRegimeChange={(regime) => {
                setInvestmentTaxRegime(regime);
                setAmortizeOrInvestResult(null);
              }}
              onCompare={handleCompareAmortizeOrInvest}
              onUpgrade={() => {
                setPendingPaywallSource('amortizar_investir');
                router.push('/(tabs)/premium');
              }}
              onOpenSource={() => {
                void Linking.openURL(INVESTMENT_RATE_PRESETS[investmentVehicle].sourceUrl).catch(
                  () =>
                    Alert.alert('Não foi possível abrir a fonte', 'Tente novamente mais tarde.'),
                );
              }}
            />
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
  onboardingExampleChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  onboardingExampleCopy: {
    flex: 1,
    gap: 2,
  },
  onboardingExampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  onboardingExampleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  onboardingExampleDismiss: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '500',
  },
  rateChangeBanner: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    padding: 14,
  },
  rateChangeBannerContent: {
    flex: 1,
    gap: 3,
  },
  rateChangeBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  rateChangeBannerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  rateChangeBannerDismiss: {
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 24,
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
  centeredButton: {
    alignItems: 'center',
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
  listActions: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 12,
  },
  editText: {
    fontWeight: '600',
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
  computedInstallment: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  computedInstallmentLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  computedInstallmentValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  prepaymentImpact: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  prepaymentImpactTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  prepaymentImpactValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  prepaymentImpactText: {
    fontSize: 12,
    lineHeight: 17,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
