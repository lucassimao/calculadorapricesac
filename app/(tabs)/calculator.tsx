import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useIAP } from 'expo-iap';
import { useRouter } from 'expo-router';
import type { FgtsEvent, PrepaymentEvent, Scenario } from '../../src/types/loan';
import { calculateLoanSummary, formatCurrency, generateAmortizationSchedule, validateScenario } from '../../src/lib/calculations';
import { parseCurrencyInput, parseNumberInput } from '../../src/lib/utils';
import { AmortizationTable } from '../../src/components/AmortizationTable';
import { LoanCharts } from '../../src/components/LoanCharts';
import {
  ExportSection,
  ScenarioSection,
  SummarySection,
  SystemSelector,
  ValidationSection,
} from '../../src/components/calculator';
import { loadScenarios, saveScenarios } from '../../src/lib/storage/scenarios';
import { AdBanner } from '../../src/components/AdBanner';
import { usePremium } from '../../src/hooks/usePremium';
import { exportCsv } from '../../src/lib/exports/csv';
import { exportPdf } from '../../src/lib/exports/pdf';
import { exportXlsx } from '../../src/lib/exports/xlsx';
import { IAP_FALLBACK_PRICE, IAP_PRODUCT_ID } from '../../src/lib/iap';
import { useIapAvailability } from '../../src/hooks/useIapAvailability';
import { useTheme } from '../../src/lib/theme';

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
const FREE_SCENARIO_LIMIT = 1;

function PremiumSectionIap({
  isPremium,
  markPremium,
}: {
  isPremium: boolean;
  markPremium: (value: boolean) => Promise<void>;
}) {
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [restoreRequestedAt, setRestoreRequestedAt] = useState<number | null>(null);
  const [purchasesValidated, setPurchasesValidated] = useState(false);
  const {
    connected,
    products,
    availablePurchases,
    requestPurchase,
    restorePurchases,
    fetchProducts,
    getAvailablePurchases,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (purchase.productId !== IAP_PRODUCT_ID) return;
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Ignore finish errors; entitlement is still granted locally.
      }
      await markPremium(true);
      Alert.alert('Premium ativado', 'Anúncios removidos e exportação liberada.');
    },
    onPurchaseError: () => {
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    },
  });

  const product = useMemo(
    () => products.find((item) => item.id === IAP_PRODUCT_ID),
    [products]
  );
  const hasEntitlement = useMemo(
    () => availablePurchases.some((purchase) => purchase.productId === IAP_PRODUCT_ID),
    [availablePurchases]
  );
  const priceLabel = product?.displayPrice ?? IAP_FALLBACK_PRICE;
  const restoreInProgress = restoreRequestedAt !== null;

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [IAP_PRODUCT_ID], type: 'in-app' }).catch(() => {});
    getAvailablePurchases()
      .then(() => setPurchasesValidated(true))
      .catch(() => setPurchasesValidated(true));
  }, [connected, fetchProducts, getAvailablePurchases]);

  useEffect(() => {
    if (hasEntitlement && !isPremium) {
      // Grant premium if platform says we have entitlement
      markPremium(true).catch(() => {});
    } else if (purchasesValidated && isPremium && !hasEntitlement) {
      // Revoke premium if local state says premium but platform has no entitlement
      // (e.g., user got a refund or purchase was revoked)
      markPremium(false).catch(() => {});
    }
  }, [hasEntitlement, isPremium, markPremium, purchasesValidated]);

  useEffect(() => {
    if (restoreRequestedAt === null) return;
    if (hasEntitlement) {
      markPremium(true)
        .then(() => Alert.alert('Restaurado', 'Compra restaurada com sucesso.'))
        .catch(() => {});
      setRestoreRequestedAt(null);
    }
  }, [restoreRequestedAt, hasEntitlement, markPremium]);

  useEffect(() => {
    if (restoreRequestedAt === null) return;
    const timeout = setTimeout(() => {
      if (!hasEntitlement) {
        Alert.alert('Nada para restaurar', 'Nenhuma compra encontrada.');
        setRestoreRequestedAt(null);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [restoreRequestedAt, hasEntitlement]);

  const handlePurchase = async () => {
    try {
      if (!connected) {
        Alert.alert('Loja indisponível', 'Conecte-se à App Store/Google Play para comprar.');
        return;
      }
      if (isPremium) {
        Alert.alert('Premium ativo', 'Você já removeu os anúncios.');
        return;
      }
      if (!product) {
        Alert.alert('Produto indisponível', 'Não foi possível carregar o produto. Tente novamente.');
        return;
      }
      setPurchaseInProgress(true);
      await requestPurchase({
        type: 'in-app',
        request: {
          ios: { sku: IAP_PRODUCT_ID },
          android: { skus: [IAP_PRODUCT_ID] },
        },
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível concluir a compra.');
    } finally {
      setPurchaseInProgress(false);
    }
  };

  const handleRestore = async () => {
    try {
      if (!connected) {
        Alert.alert('Loja indisponível', 'Conecte-se à App Store/Google Play para restaurar.');
        return;
      }
      setRestoreRequestedAt(Date.now());
      await restorePurchases();
      await getAvailablePurchases();
    } catch {
      Alert.alert('Erro', 'Não foi possível restaurar a compra.');
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Plano Premium</Text>
      <Text style={styles.label}>
        Desbloqueie recursos premium por {priceLabel} (pagamento único).
      </Text>
      <View style={styles.rowWrap}>
          <Pressable
            style={[
              styles.primaryButton,
              (isPremium || purchaseInProgress) && styles.primaryButtonDisabled,
            ]}
            onPress={handlePurchase}
            accessibilityRole="button"
            accessibilityLabel="Assinar Premium"
          >
            <Text style={styles.primaryButtonText}>
              {isPremium ? 'Premium ativo' : purchaseInProgress ? 'Processando...' : 'Assinar premium'}
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
      'As compras no app não estão disponíveis neste dispositivo. Use uma build instalada com loja compatível.'
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
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [principalText, setPrincipalText] = useState('300000');
  const [propertyValueText, setPropertyValueText] = useState('');
  const [downPaymentText, setDownPaymentText] = useState('');
  const [rateText, setRateText] = useState('1,2');
  const [termText, setTermText] = useState('360');
  const [startDateText, setStartDateText] = useState(new Date().toISOString().slice(0, 10));
  const [dueDayText, setDueDayText] = useState('5');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [insuranceRateText, setInsuranceRateText] = useState('0');
  const [adminFeeRateText, setAdminFeeRateText] = useState('0');
  const [iofRateText, setIofRateText] = useState('0');
  const [openingFeeText, setOpeningFeeText] = useState('0');
  const [itbiRateText, setItbiRateText] = useState('0');
  const [registryFeeText, setRegistryFeeText] = useState('0');
  const isPropertyMode = scenario.loanMode === 'property';
  const [newFgts, setNewFgts] = useState<Partial<FgtsEvent>>({
    amount: 0,
    usage: 'amortization',
    strategy: 'reduce_term',
    date: new Date(),
  });
  const { isPremium, loading: premiumLoading, markPremium } = usePremium();
  const showAds = !premiumLoading && !isPremium;
  const iapAvailability = useIapAvailability();
  const [exporting, setExporting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [newPrepayment, setNewPrepayment] = useState<Partial<PrepaymentEvent>>({
    amount: 0,
    type: 'fixed_amount',
    strategy: 'reduce_term',
    date: new Date(),
  });
  const [showPrepaymentDatePicker, setShowPrepaymentDatePicker] = useState(false);
  const [showFgtsDatePicker, setShowFgtsDatePicker] = useState(false);

  useEffect(() => {
    loadScenarios()
      .then((loaded) => setScenarios(loaded))
      .catch(() => {});
  }, []);

  // Sync principal display when in property mode
  useEffect(() => {
    if (isPropertyMode && scenario.propertyValue && scenario.downPayment !== undefined) {
      const computed = Math.max(scenario.propertyValue - (scenario.downPayment ?? 0), 0);
      setPrincipalText(String(computed));
      setScenario((prev) => ({ ...prev, principal: computed }));
    }
  }, [isPropertyMode, scenario.propertyValue, scenario.downPayment]);

  const schedule = useMemo(() => generateAmortizationSchedule(scenario), [scenario]);
  const scheduleForTable = useMemo(
    () => schedule.slice(0, MAX_TABLE_ROWS + 1),
    [schedule]
  );
  const summary = useMemo(() => calculateLoanSummary(schedule, scenario), [schedule, scenario]);
  const validation = useMemo(() => validateScenario(scenario), [scenario]);
  const totalInstallments = Math.max(schedule.length - 1, 0);

  // Dynamic themed styles
  const themedStyles = useMemo(() => ({
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
  }), [colors]);

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
    if (!isPremium && existingIndex < 0 && scenarios.length >= FREE_SCENARIO_LIMIT) {
      Alert.alert(
        'Plano Premium',
        'Usuários gratuitos podem salvar apenas 1 cenário adicional. Assine o Premium para liberar mais cenários.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver Premium', onPress: () => router.push('/(tabs)/premium') },
        ]
      );
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
  };

  const handleLoadScenario = (target: Scenario) => {
    setScenario(target);
    setPrincipalText(String(target.principal));
    setPropertyValueText(target.propertyValue ? String(target.propertyValue) : '');
    setDownPaymentText(target.downPayment ? String(target.downPayment) : '');
    setRateText(String(target.rate).replace('.', ','));
    setTermText(String(target.term));
    setStartDateText(target.startDate.toISOString().slice(0, 10));
    setDueDayText(String(target.dueDay));
    setInsuranceRateText(target.insuranceRate ? String(target.insuranceRate).replace('.', ',') : '0');
    setAdminFeeRateText(target.adminFeeRate ? String(target.adminFeeRate).replace('.', ',') : '0');
    setIofRateText(target.iofRate ? String(target.iofRate).replace('.', ',') : '0');
    setOpeningFeeText(target.openingFee ? String(target.openingFee) : '0');
    setItbiRateText(target.itbiRate ? String(target.itbiRate).replace('.', ',') : '0');
    setRegistryFeeText(target.registryFee ? String(target.registryFee) : '0');
  };

  const handleDeleteScenario = (id: string, name: string) => {
    Alert.alert(
      'Excluir cenário',
      `Tem certeza que deseja excluir "${name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const nextList = scenarios.filter((s) => s.id !== id);
            await persistScenarios(nextList);
          },
        },
      ]
    );
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
  };

  const handleRemovePrepayment = (id: string) => {
    setScenario((prev) => ({
      ...prev,
      prepayments: (prev.prepayments ?? []).filter((p) => p.id !== id),
    }));
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
  };

  const handleRemoveFgts = (id: string) => {
    setScenario((prev) => ({
      ...prev,
      fgtsEvents: (prev.fgtsEvents ?? []).filter((event) => event.id !== id),
    }));
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    setScenario((prev) => ({ ...prev, startDate: selectedDate }));
    setStartDateText(selectedDate.toISOString().slice(0, 10));
  };

  const handlePrepaymentDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPrepaymentDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    setNewPrepayment((prev) => ({ ...prev, date: selectedDate }));
  };

  const handleFgtsDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowFgtsDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    setNewFgts((prev) => ({ ...prev, date: selectedDate }));
  };


  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    if (!isPremium) {
      Alert.alert('Premium', 'Exportação disponível apenas para assinantes.');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      if (format === 'pdf') {
        await exportPdf(scenario, summary, schedule);
      } else if (format === 'xlsx') {
        await exportXlsx(schedule, scenario, summary);
      } else {
        await exportCsv(schedule, scenario, summary);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o arquivo.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, themedStyles.container]} keyboardShouldPersistTaps="handled">
      <AdBanner enabled={showAds} />

      <ScenarioSection
        scenario={scenario}
        scenarios={scenarios}
        onNameChange={(name) => setScenario((prev) => ({ ...prev, name }))}
        onSave={handleSaveScenario}
        onNew={() => handleLoadScenario({ ...DEFAULT_SCENARIO, id: Date.now().toString() })}
        onLoad={handleLoadScenario}
        onDelete={handleDeleteScenario}
      />

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

      <View style={[styles.section, themedStyles.section]}>
        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Parâmetros</Text>

        <Text style={[styles.label, themedStyles.label]}>Valor do Financiamento (R$)</Text>
        <TextInput
          value={principalText}
          onChangeText={(text) => {
            setPrincipalText(text);
            setScenario((prev) => ({ ...prev, principal: parseCurrencyInput(text) }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholder="300000 ou 300.000,00"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Valor do financiamento"
          testID="input-principal"
          nativeID="input-principal"
        />

        {isPropertyMode && (
          <>
            <Text style={[styles.label, themedStyles.label]}>Valor do Imóvel (R$)</Text>
            <TextInput
              value={propertyValueText}
              onChangeText={(text) => {
                setPropertyValueText(text);
                setScenario((prev) => ({ ...prev, propertyValue: parseCurrencyInput(text) }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="500000"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Valor do imóvel"
            />

            <Text style={[styles.label, themedStyles.label]}>Entrada (R$)</Text>
            <TextInput
              value={downPaymentText}
              onChangeText={(text) => {
                setDownPaymentText(text);
                setScenario((prev) => ({ ...prev, downPayment: parseCurrencyInput(text) }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholder="100000"
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
            nativeID="input-rate"
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
            nativeID="input-term"
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
          nativeID="input-due-day"
        />
      </View>

      <ValidationSection errors={validation.errors} warnings={validation.warnings} />

      {!isPremium ? (
        iapAvailability === 'supported' ? (
          <PremiumSectionIap isPremium={isPremium} markPremium={markPremium} />
        ) : (
          <PremiumSectionUnsupported />
        )
      ) : null}

      <SummarySection
        summary={summary}
        principal={scenario.principal}
        isPremium={isPremium}
        isCalculating={isCalculating}
      />

      <AdBanner enabled={showAds} />

      <View style={[styles.section, themedStyles.section]}>
        <LoanCharts schedule={schedule} />
      </View>

      <View style={[styles.section, themedStyles.section]}>
        <View style={styles.row}>
          <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Tabela de Amortização</Text>
        </View>
        {totalInstallments > 0 && (
          <View style={styles.tableMetaRow}>
            <Text style={[styles.tableMetaText, { color: colors.textTertiary }]}>
              Mostrando {Math.min(MAX_TABLE_ROWS, totalInstallments)} de {totalInstallments} parcelas
            </Text>
          </View>
        )}
        <AmortizationTable
          schedule={scheduleForTable}
          totalSchedule={schedule}
          showExtras
          columns={['installment', 'date', 'payment', 'balance']}
        />
        <Text style={[styles.subsectionTitle, { color: colors.textSecondary }]}>Gerar tabela completa</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.primaryButton, !isPremium && styles.primaryButtonDisabled]}
            onPress={() => handleExport('pdf')}
            accessibilityRole="button"
            accessibilityLabel="Gerar tabela completa em PDF"
          >
            <Text style={styles.primaryButtonText}>PDF</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !isPremium && styles.primaryButtonDisabled]}
            onPress={() => handleExport('xlsx')}
            accessibilityRole="button"
            accessibilityLabel="Gerar tabela completa em XLSX"
          >
            <Text style={styles.primaryButtonText}>XLSX</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !isPremium && styles.primaryButtonDisabled]}
            onPress={() => handleExport('csv')}
            accessibilityRole="button"
            accessibilityLabel="Gerar tabela completa em CSV"
          >
            <Text style={styles.primaryButtonText}>CSV</Text>
          </Pressable>
        </View>
        {exporting ? (
          <View style={styles.exportingRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.exportingText, { color: colors.textTertiary }]}>Gerando arquivo...</Text>
          </View>
        ) : null}
      </View>

      <AdBanner enabled={showAds} />

      <View style={[styles.section, themedStyles.section]}>
        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]} testID="section-prepayments">Amortizações Extras</Text>
        <Text style={[styles.label, themedStyles.label]}>Data</Text>
        <Pressable
          style={[styles.input, styles.inputPressable, themedStyles.input]}
          onPress={() => setShowPrepaymentDatePicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Selecionar data da amortização extra"
          testID="input-prepayment-date"
          nativeID="input-prepayment-date"
        >
          <Text style={[styles.inputText, { color: colors.text }]}>
            {newPrepayment.date?.toISOString().slice(0, 10)}
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
          value={newPrepayment.amount ? String(newPrepayment.amount) : ''}
          onChangeText={(text) => {
            const parsed = parseCurrencyInput(text);
            setNewPrepayment((prev) => ({ ...prev, amount: parsed }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Valor da amortização extra"
          testID="input-prepayment-amount"
          nativeID="input-prepayment-amount"
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, themedStyles.chip, newPrepayment.type === 'fixed_amount' && themedStyles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, type: 'fixed_amount' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.type === 'fixed_amount' }}
            accessibilityLabel="Amortização por valor fixo"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newPrepayment.type === 'fixed_amount' && themedStyles.chipActiveText]}>Valor fixo</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, themedStyles.chip, newPrepayment.type === 'percentage' && themedStyles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, type: 'percentage' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.type === 'percentage' }}
            accessibilityLabel="Amortização por porcentagem do saldo"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newPrepayment.type === 'percentage' && themedStyles.chipActiveText]}>% do saldo</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, themedStyles.chip, newPrepayment.strategy === 'reduce_term' && themedStyles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, strategy: 'reduce_term' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.strategy === 'reduce_term' }}
            accessibilityLabel="Reduzir prazo"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newPrepayment.strategy === 'reduce_term' && themedStyles.chipActiveText]}>Reduzir prazo</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, themedStyles.chip, newPrepayment.strategy === 'reduce_payment' && themedStyles.chipActive]}
            onPress={() => setNewPrepayment((prev) => ({ ...prev, strategy: 'reduce_payment' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newPrepayment.strategy === 'reduce_payment' }}
            accessibilityLabel="Reduzir parcela"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newPrepayment.strategy === 'reduce_payment' && themedStyles.chipActiveText]}>Reduzir parcela</Text>
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
          nativeID="btn-add-prepayment"
        >
          <Text style={styles.primaryButtonText} testID="label-add-prepayment">
            Adicionar amortização
          </Text>
        </Pressable>

        {(scenario.prepayments ?? []).length > 0 && (
          <View style={styles.list}>
            {(scenario.prepayments ?? []).map((payment) => (
              <View key={payment.id} style={[styles.listItemRow, { borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.listTitle, { color: colors.text }]}>
                    {payment.date.toLocaleDateString('pt-BR')} • {formatCurrency(payment.amount)}
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
          nativeID="input-fgts-date"
        >
          <Text style={[styles.inputText, { color: colors.text }]}>
            {newFgts.date?.toISOString().slice(0, 10)}
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
          value={newFgts.amount ? String(newFgts.amount) : ''}
          onChangeText={(text) => {
            const parsed = parseCurrencyInput(text);
            setNewFgts((prev) => ({ ...prev, amount: parsed }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Valor do FGTS"
          testID="input-fgts-amount"
          nativeID="input-fgts-amount"
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.chip, themedStyles.chip, newFgts.usage === 'down_payment' && themedStyles.chipActive]}
            onPress={() => setNewFgts((prev) => ({ ...prev, usage: 'down_payment' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newFgts.usage === 'down_payment' }}
            accessibilityLabel="FGTS como entrada"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newFgts.usage === 'down_payment' && themedStyles.chipActiveText]}>Entrada</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, themedStyles.chip, newFgts.usage === 'amortization' && themedStyles.chipActive]}
            onPress={() => setNewFgts((prev) => ({ ...prev, usage: 'amortization' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newFgts.usage === 'amortization' }}
            accessibilityLabel="FGTS como amortização"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newFgts.usage === 'amortization' && themedStyles.chipActiveText]}>Amortização</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, themedStyles.chip, newFgts.usage === 'installment' && themedStyles.chipActive]}
            onPress={() => setNewFgts((prev) => ({ ...prev, usage: 'installment' }))}
            accessibilityRole="button"
            accessibilityState={{ selected: newFgts.usage === 'installment' }}
            accessibilityLabel="FGTS para parcela"
          >
            <Text style={[styles.chipText, themedStyles.chipText, newFgts.usage === 'installment' && themedStyles.chipActiveText]}>Parcela</Text>
          </Pressable>
        </View>
        {newFgts.usage === 'amortization' && (
          <View style={styles.row}>
            <Pressable
              style={[styles.chip, themedStyles.chip, newFgts.strategy === 'reduce_term' && themedStyles.chipActive]}
              onPress={() => setNewFgts((prev) => ({ ...prev, strategy: 'reduce_term' }))}
              accessibilityRole="button"
              accessibilityState={{ selected: newFgts.strategy === 'reduce_term' }}
              accessibilityLabel="FGTS reduzindo prazo"
            >
              <Text style={[styles.chipText, themedStyles.chipText, newFgts.strategy === 'reduce_term' && themedStyles.chipActiveText]}>Reduzir prazo</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, themedStyles.chip, newFgts.strategy === 'reduce_payment' && themedStyles.chipActive]}
              onPress={() => setNewFgts((prev) => ({ ...prev, strategy: 'reduce_payment' }))}
              accessibilityRole="button"
              accessibilityState={{ selected: newFgts.strategy === 'reduce_payment' }}
              accessibilityLabel="FGTS reduzindo parcela"
            >
              <Text style={[styles.chipText, themedStyles.chipText, newFgts.strategy === 'reduce_payment' && themedStyles.chipActiveText]}>Reduzir parcela</Text>
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
          nativeID="btn-add-fgts"
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
                >
                  <Text style={[styles.deleteText, { color: colors.error }]}>Remover</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, themedStyles.section]}>
        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Custos e Taxas</Text>
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>
          Use taxas mensais (%) sobre o saldo devedor. Custos iniciais são cobrados
          na assinatura.
        </Text>
        <Text style={[styles.label, themedStyles.label]}>IOF (% do financiado)</Text>
        <TextInput
          value={iofRateText}
          onChangeText={(text) => {
            setIofRateText(text);
            setScenario((prev) => ({ ...prev, iofRate: parseNumberInput(text), includeIOF: parseNumberInput(text) > 0 }));
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

        <Text style={[styles.label, themedStyles.label]}>Tarifa administrativa (% do saldo ao mês)</Text>
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
            setOpeningFeeText(text);
            const value = parseCurrencyInput(text);
            setScenario((prev) => ({
              ...prev,
              openingFee: value,
              includeOpeningFee: value > 0,
            }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Taxa de abertura"
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
                setRegistryFeeText(text);
                setScenario((prev) => ({ ...prev, registryFee: parseCurrencyInput(text) }));
              }}
              keyboardType="numeric"
              style={[styles.input, themedStyles.input]}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Taxa de cartório"
            />
          </>
        )}
      </View>

      <ExportSection
        isPremium={isPremium}
        exporting={exporting}
        onExport={handleExport}
      />

      <AdBanner enabled={showAds} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#F7F7F7',
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
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
