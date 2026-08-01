import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Scenario } from '@loan-engine/loan';
import {
  calculateLoanSummary,
  formatCurrency,
  generateAmortizationSchedule,
} from '@loan-engine/calculations';
import { buildQuickComparisonScenario } from '../../src/lib/comparison';
import { parseCurrencyInput, parseNumberInput } from '../../src/lib/utils';
import { AdBanner } from '../../src/components/AdBanner';
import { usePremiumContext } from '../../src/contexts/PremiumContext';
import { useTheme } from '../../src/lib/theme';
import { getAnnualRateBucket, trackEvent, trackScreen } from '../../src/lib/analytics';
import { shouldShowAds } from '../../src/lib/premium';

const BASE_SCENARIO: Scenario = {
  id: 'base',
  name: 'Comparação',
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

export default function ComparisonScreen() {
  const { colors } = useTheme();
  const [base, setBase] = useState<Scenario>(BASE_SCENARIO);
  const [quickCases, setQuickCases] = useState<Scenario[]>([
    { ...BASE_SCENARIO, id: 'c1', name: 'Condição A' },
    { ...BASE_SCENARIO, id: 'c2', name: 'Condição B', rate: 1.1 },
    { ...BASE_SCENARIO, id: 'c3', name: 'Condição C', term: 300 },
  ]);
  const [principalText, setPrincipalText] = useState('300000');
  const [rateText, setRateText] = useState('1,2');
  const [termText, setTermText] = useState('360');
  const { isPremium, loading: premiumLoading } = usePremiumContext();
  const showAds = shouldShowAds(isPremium, premiumLoading);
  const hasTrackedComparisonUpdate = useRef(false);

  useEffect(() => {
    trackScreen('comparison');
  }, []);

  const comparisonConfigSignature = useMemo(
    () =>
      JSON.stringify({
        principal: base.principal,
        rate: base.rate,
        term: base.term,
        quickCases: quickCases.map((item) => ({
          id: item.id,
          rate: item.rate,
          term: item.term,
          downPayment: item.downPayment ?? 0,
        })),
      }),
    [base.principal, base.rate, base.term, quickCases],
  );

  useEffect(() => {
    if (!hasTrackedComparisonUpdate.current) {
      hasTrackedComparisonUpdate.current = true;
      return;
    }

    const timeout = setTimeout(() => {
      trackEvent('comparison_configuration_updated', {
        rate_bucket: getAnnualRateBucket(base.rate, base.rateType),
        term: base.term,
        base_system: base.system,
        loan_mode: base.loanMode ?? 'standard',
        is_premium: isPremium,
        quick_case_count: quickCases.length,
      });
    }, 800);

    return () => clearTimeout(timeout);
  }, [
    comparisonConfigSignature,
    base.loanMode,
    base.principal,
    base.rate,
    base.rateType,
    base.system,
    base.term,
    isPremium,
    quickCases.length,
  ]);

  const themedStyles = useMemo(
    () => ({
      container: { backgroundColor: colors.background },
      section: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      title: { color: colors.text },
      sectionTitle: { color: colors.text },
      label: { color: colors.textSecondary },
      input: { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
      card: { borderColor: colors.border },
      cardTitle: { color: colors.primary },
      cardValue: { color: colors.text },
      cardLabel: { color: colors.textTertiary },
      highlight: { backgroundColor: colors.primaryLight },
      highlightText: { color: colors.primary },
      helperText: { color: colors.textTertiary },
      quickCard: { borderColor: colors.border },
      quickTitle: { color: colors.text },
      quickLabel: { color: colors.textTertiary },
      quickValue: { color: colors.text },
    }),
    [colors],
  );

  const priceSchedule = useMemo(
    () => generateAmortizationSchedule({ ...base, system: 'PRICE' }),
    [base],
  );
  const sacSchedule = useMemo(
    () => generateAmortizationSchedule({ ...base, system: 'SAC' }),
    [base],
  );

  const priceSummary = useMemo(
    () => calculateLoanSummary(priceSchedule, base),
    [priceSchedule, base],
  );
  const sacSummary = useMemo(() => calculateLoanSummary(sacSchedule, base), [sacSchedule, base]);

  const interestDiff = priceSummary.totalInterest - sacSummary.totalInterest;
  const totalDiff = priceSummary.totalPaymentWithCosts - sacSummary.totalPaymentWithCosts;
  const quickCasesForComparison = useMemo(
    () => quickCases.map((item) => buildQuickComparisonScenario(base.principal, item)),
    [quickCases, base.principal],
  );
  const quickComparisonSummaries = useMemo(
    () =>
      quickCasesForComparison.map((comparisonCase) =>
        calculateLoanSummary(generateAmortizationSchedule(comparisonCase), comparisonCase),
      ),
    [quickCasesForComparison],
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, themedStyles.container]}
      keyboardShouldPersistTaps="handled"
      testID="screen-comparison"
    >
      <Text style={[styles.title, themedStyles.title]} testID="screen-comparison-title">
        Comparar SAC vs Price
      </Text>
      <AdBanner enabled={showAds} />

      <View style={[styles.section, themedStyles.section]} testID="section-comparison-parameters">
        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Parâmetros</Text>
        <Text style={[styles.label, themedStyles.label]}>Valor do Financiamento (R$)</Text>
        <TextInput
          value={principalText}
          onChangeText={(text) => {
            setPrincipalText(text);
            setBase((prev) => ({ ...prev, principal: parseCurrencyInput(text) }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Valor do financiamento"
        />
        <Text style={[styles.label, themedStyles.label]}>Taxa de Juros (% ao mês)</Text>
        <TextInput
          value={rateText}
          onChangeText={(text) => {
            setRateText(text);
            setBase((prev) => ({ ...prev, rate: parseNumberInput(text), rateType: 'monthly' }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Taxa de juros ao mês"
        />
        <Text style={[styles.label, themedStyles.label]}>Prazo (meses)</Text>
        <TextInput
          value={termText}
          onChangeText={(text) => {
            setTermText(text);
            const parsed = Number.parseInt(text || '0', 10);
            setBase((prev) => ({
              ...prev,
              term: Number.isNaN(parsed) ? 0 : parsed,
              termUnit: 'months',
            }));
          }}
          keyboardType="numeric"
          style={[styles.input, themedStyles.input]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Prazo em meses"
        />
        <Text style={[styles.helperText, themedStyles.helperText]}>
          No comparador rápido, a entrada reduz o valor financiado a partir do valor base acima.
        </Text>
      </View>

      <AdBanner enabled={showAds} />

      <View style={[styles.section, themedStyles.section]} testID="section-comparison-summary">
        <Text style={[styles.sectionTitle, themedStyles.sectionTitle]}>Resumo Comparativo</Text>

        <View style={styles.cardRow}>
          <View style={[styles.card, themedStyles.card]}>
            <Text style={[styles.cardTitle, themedStyles.cardTitle]}>Price</Text>
            <Text style={[styles.cardValue, themedStyles.cardValue]}>
              {formatCurrency(priceSummary.totalPayment)}
            </Text>
            <Text style={[styles.cardLabel, themedStyles.cardLabel]}>Total Pago</Text>
          </View>
          <View style={[styles.card, themedStyles.card]}>
            <Text style={[styles.cardTitle, themedStyles.cardTitle]}>SAC</Text>
            <Text style={[styles.cardValue, themedStyles.cardValue]}>
              {formatCurrency(sacSummary.totalPayment)}
            </Text>
            <Text style={[styles.cardLabel, themedStyles.cardLabel]}>Total Pago</Text>
          </View>
        </View>

        {(priceSummary.totalPaymentWithCosts > priceSummary.totalPayment ||
          sacSummary.totalPaymentWithCosts > sacSummary.totalPayment) && (
          <View style={styles.cardRow}>
            <View style={[styles.card, themedStyles.card]}>
              <Text style={[styles.cardTitle, themedStyles.cardTitle]}>Price</Text>
              <Text style={[styles.cardValue, themedStyles.cardValue]}>
                {formatCurrency(priceSummary.totalPaymentWithCosts)}
              </Text>
              <Text style={[styles.cardLabel, themedStyles.cardLabel]}>Total c/ Custos</Text>
            </View>
            <View style={[styles.card, themedStyles.card]}>
              <Text style={[styles.cardTitle, themedStyles.cardTitle]}>SAC</Text>
              <Text style={[styles.cardValue, themedStyles.cardValue]}>
                {formatCurrency(sacSummary.totalPaymentWithCosts)}
              </Text>
              <Text style={[styles.cardLabel, themedStyles.cardLabel]}>Total c/ Custos</Text>
            </View>
          </View>
        )}

        <View style={styles.cardRow}>
          <View style={[styles.card, themedStyles.card]}>
            <Text style={[styles.cardTitle, themedStyles.cardTitle]}>Price</Text>
            <Text style={[styles.cardValue, themedStyles.cardValue]}>
              {formatCurrency(priceSummary.totalInterest)}
            </Text>
            <Text style={[styles.cardLabel, themedStyles.cardLabel]}>Total Juros</Text>
          </View>
          <View style={[styles.card, themedStyles.card]}>
            <Text style={[styles.cardTitle, themedStyles.cardTitle]}>SAC</Text>
            <Text style={[styles.cardValue, themedStyles.cardValue]}>
              {formatCurrency(sacSummary.totalInterest)}
            </Text>
            <Text style={[styles.cardLabel, themedStyles.cardLabel]}>Total Juros</Text>
          </View>
        </View>

        <View style={[styles.highlight, themedStyles.highlight]}>
          <Text style={[styles.highlightText, themedStyles.highlightText]}>
            Diferença de juros: {formatCurrency(Math.abs(interestDiff))} (
            {interestDiff > 0 ? 'SAC economiza' : 'Price economiza'})
          </Text>
        </View>

        {(priceSummary.totalPaymentWithCosts > priceSummary.totalPayment ||
          sacSummary.totalPaymentWithCosts > sacSummary.totalPayment) && (
          <View style={[styles.highlightAlt, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.highlightText, { color: colors.success }]}>
              Diferença total c/ custos: {formatCurrency(Math.abs(totalDiff))} (
              {totalDiff > 0 ? 'SAC economiza' : 'Price economiza'})
            </Text>
          </View>
        )}
      </View>

      <AdBanner enabled={showAds} />

      <View style={[styles.section, themedStyles.section]}>
        <Text
          style={[styles.sectionTitle, themedStyles.sectionTitle]}
          testID="section-quick-compare"
        >
          Comparador Rápido
        </Text>
        <Text style={[styles.helperText, themedStyles.helperText]}>
          Compare até 3 condições diferentes (juros, prazo e entrada). O ranking usa o total pago
          com custos.
        </Text>
        {quickCases.map((item, index) => {
          const comparisonSummary = quickComparisonSummaries[index];

          return (
            <View
              key={item.id}
              style={[styles.quickCard, themedStyles.quickCard]}
              testID={`quick-card-${index}`}
            >
              <Text style={[styles.quickTitle, themedStyles.quickTitle]}>{item.name}</Text>
              <View style={styles.quickRow}>
                <TextInput
                  value={String(item.rate).replace('.', ',')}
                  onChangeText={(text) => {
                    const value = Number.parseFloat(text.replace(',', '.'));
                    setQuickCases((prev) =>
                      prev.map((c, i) =>
                        i === index ? { ...c, rate: Number.isNaN(value) ? 0 : value } : c,
                      ),
                    );
                  }}
                  keyboardType="numeric"
                  style={[styles.input, styles.inputSmall, themedStyles.input]}
                  placeholder="Juros (%) a.m."
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel={`Juros condição ${item.name}`}
                  testID={`quick-rate-${index}`}
                />
                <TextInput
                  value={String(item.term)}
                  onChangeText={(text) => {
                    const value = Number.parseInt(text || '0', 10);
                    setQuickCases((prev) =>
                      prev.map((c, i) =>
                        i === index ? { ...c, term: Number.isNaN(value) ? 0 : value } : c,
                      ),
                    );
                  }}
                  keyboardType="numeric"
                  style={[styles.input, styles.inputSmall, themedStyles.input]}
                  placeholder="Prazo (meses)"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel={`Prazo condição ${item.name}`}
                  testID={`quick-term-${index}`}
                />
                <TextInput
                  value={String(item.downPayment ?? 0)}
                  onChangeText={(text) => {
                    const value = parseCurrencyInput(text);
                    setQuickCases((prev) =>
                      prev.map((c, i) =>
                        i === index
                          ? {
                              ...c,
                              downPayment: Number.isNaN(value) ? 0 : value,
                            }
                          : c,
                      ),
                    );
                  }}
                  keyboardType="numeric"
                  style={[styles.input, styles.inputSmall, themedStyles.input]}
                  placeholder="Entrada (R$)"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel={`Entrada condição ${item.name}`}
                  testID={`quick-down-${index}`}
                />
              </View>
              <View style={styles.quickRow}>
                <Text style={[styles.quickLabel, themedStyles.quickLabel]}>Total c/ custos</Text>
                <Text style={[styles.quickValue, themedStyles.quickValue]}>
                  {formatCurrency(comparisonSummary.totalPaymentWithCosts)}
                </Text>
              </View>
              <View style={styles.quickRow}>
                <Text style={[styles.quickLabel, themedStyles.quickLabel]}>Financiado</Text>
                <Text style={[styles.quickValue, themedStyles.quickValue]}>
                  {formatCurrency(comparisonSummary.financedPrincipal)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

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
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 140,
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  highlight: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    padding: 12,
  },
  highlightAlt: {
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    padding: 12,
  },
  highlightText: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  helperText: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
  },
  quickCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  inputSmall: {
    flex: 1,
    minWidth: 120,
  },
  quickLabel: {
    color: '#6B7280',
  },
  quickValue: {
    fontWeight: '700',
    color: '#111827',
  },
});
