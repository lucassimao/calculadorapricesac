import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Scenario } from '../../src/types/loan';
import { calculateLoanSummary, formatCurrency, generateAmortizationSchedule } from '../../src/lib/calculations';
import { AdBanner } from '../../src/components/AdBanner';
import { usePremium } from '../../src/hooks/usePremium';

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

function parseCurrencyInput(value: string): number {
  if (!value.trim()) return 0;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseNumberInput(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function ComparisonScreen() {
  const [base, setBase] = useState<Scenario>(BASE_SCENARIO);
  const [quickCases, setQuickCases] = useState<Scenario[]>([
    { ...BASE_SCENARIO, id: 'c1', name: 'Condição A' },
    { ...BASE_SCENARIO, id: 'c2', name: 'Condição B', rate: 1.1 },
    { ...BASE_SCENARIO, id: 'c3', name: 'Condição C', term: 300 },
  ]);
  const [principalText, setPrincipalText] = useState('300000');
  const [rateText, setRateText] = useState('1,2');
  const [termText, setTermText] = useState('360');
  const { isPremium, loading: premiumLoading } = usePremium();
  const showAds = !premiumLoading && !isPremium;

  const priceSchedule = useMemo(
    () => generateAmortizationSchedule({ ...base, system: 'PRICE' }),
    [base]
  );
  const sacSchedule = useMemo(
    () => generateAmortizationSchedule({ ...base, system: 'SAC' }),
    [base]
  );

  const priceSummary = useMemo(
    () => calculateLoanSummary(priceSchedule, base),
    [priceSchedule, base]
  );
  const sacSummary = useMemo(
    () => calculateLoanSummary(sacSchedule, base),
    [sacSchedule, base]
  );

  const interestDiff = priceSummary.totalInterest - sacSummary.totalInterest;
  const totalDiff = priceSummary.totalPaymentWithCosts - sacSummary.totalPaymentWithCosts;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Comparar SAC vs Price</Text>
      <AdBanner enabled={showAds} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parâmetros</Text>
        <Text style={styles.label}>Valor do Financiamento (R$)</Text>
        <TextInput
          value={principalText}
          onChangeText={(text) => {
            setPrincipalText(text);
            setBase((prev) => ({ ...prev, principal: parseCurrencyInput(text) }));
          }}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel="Valor do financiamento"
        />
        <Text style={styles.label}>Taxa de Juros (% ao mês)</Text>
        <TextInput
          value={rateText}
          onChangeText={(text) => {
            setRateText(text);
            setBase((prev) => ({ ...prev, rate: parseNumberInput(text), rateType: 'monthly' }));
          }}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel="Taxa de juros ao mês"
        />
        <Text style={styles.label}>Prazo (meses)</Text>
        <TextInput
          value={termText}
          onChangeText={(text) => {
            setTermText(text);
            const parsed = Number.parseInt(text || '0', 10);
            setBase((prev) => ({ ...prev, term: Number.isNaN(parsed) ? 0 : parsed, termUnit: 'months' }));
          }}
          keyboardType="numeric"
          style={styles.input}
          accessibilityLabel="Prazo em meses"
        />
      </View>

      <AdBanner enabled={showAds} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo Comparativo</Text>

        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Price</Text>
            <Text style={styles.cardValue}>{formatCurrency(priceSummary.totalPayment)}</Text>
            <Text style={styles.cardLabel}>Total Pago</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SAC</Text>
            <Text style={styles.cardValue}>{formatCurrency(sacSummary.totalPayment)}</Text>
            <Text style={styles.cardLabel}>Total Pago</Text>
          </View>
        </View>

        {(priceSummary.totalPaymentWithCosts > priceSummary.totalPayment ||
          sacSummary.totalPaymentWithCosts > sacSummary.totalPayment) && (
          <View style={styles.cardRow}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Price</Text>
              <Text style={styles.cardValue}>
                {formatCurrency(priceSummary.totalPaymentWithCosts)}
              </Text>
              <Text style={styles.cardLabel}>Total c/ Custos</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SAC</Text>
              <Text style={styles.cardValue}>
                {formatCurrency(sacSummary.totalPaymentWithCosts)}
              </Text>
              <Text style={styles.cardLabel}>Total c/ Custos</Text>
            </View>
          </View>
        )}

        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Price</Text>
            <Text style={styles.cardValue}>{formatCurrency(priceSummary.totalInterest)}</Text>
            <Text style={styles.cardLabel}>Total Juros</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SAC</Text>
            <Text style={styles.cardValue}>{formatCurrency(sacSummary.totalInterest)}</Text>
            <Text style={styles.cardLabel}>Total Juros</Text>
          </View>
        </View>

        <View style={styles.highlight}>
          <Text style={styles.highlightText}>
            Diferença de juros: {formatCurrency(Math.abs(interestDiff))} {' '}
            ({interestDiff > 0 ? 'SAC economiza' : 'Price economiza'})
          </Text>
        </View>

        {(priceSummary.totalPaymentWithCosts > priceSummary.totalPayment ||
          sacSummary.totalPaymentWithCosts > sacSummary.totalPayment) && (
          <View style={styles.highlightAlt}>
            <Text style={styles.highlightText}>
              Diferença total c/ custos: {formatCurrency(Math.abs(totalDiff))} {' '}
              ({totalDiff > 0 ? 'SAC economiza' : 'Price economiza'})
            </Text>
          </View>
        )}
      </View>

      <AdBanner enabled={showAds} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle} testID="section-quick-compare">Comparador Rápido</Text>
        <Text style={styles.helperText}>
          Compare até 3 condições diferentes (juros, prazo e entrada). O ranking
          usa o total pago com custos.
        </Text>
        {quickCases.map((item, index) => (
          <View key={item.id} style={styles.quickCard}>
            <Text style={styles.quickTitle}>{item.name}</Text>
            <View style={styles.quickRow}>
              <TextInput
                value={String(item.rate).replace('.', ',')}
                onChangeText={(text) => {
                  const value = Number.parseFloat(text.replace(',', '.'));
                  setQuickCases((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, rate: Number.isNaN(value) ? 0 : value } : c))
                  );
                }}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
                placeholder="Juros (%) a.m."
                accessibilityLabel={`Juros condição ${item.name}`}
                testID={`quick-rate-${index}`}
                nativeID={`quick-rate-${index}`}
              />
              <TextInput
                value={String(item.term)}
                onChangeText={(text) => {
                  const value = Number.parseInt(text || '0', 10);
                  setQuickCases((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, term: Number.isNaN(value) ? 0 : value } : c))
                  );
                }}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
                placeholder="Prazo (meses)"
                accessibilityLabel={`Prazo condição ${item.name}`}
                testID={`quick-term-${index}`}
                nativeID={`quick-term-${index}`}
              />
              <TextInput
                value={String(item.downPayment ?? 0)}
                onChangeText={(text) => {
                  const value = Number.parseFloat(text.replace(',', '.'));
                  setQuickCases((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, downPayment: Number.isNaN(value) ? 0 : value, loanMode: 'property' } : c))
                  );
                }}
                keyboardType="numeric"
                style={[styles.input, styles.inputSmall]}
                placeholder="Entrada (R$)"
                accessibilityLabel={`Entrada condição ${item.name}`}
                testID={`quick-down-${index}`}
                nativeID={`quick-down-${index}`}
              />
            </View>
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>Total c/ custos</Text>
              <Text style={styles.quickValue}>
                {formatCurrency(
                  calculateLoanSummary(generateAmortizationSchedule(item), item).totalPaymentWithCosts
                )}
              </Text>
            </View>
          </View>
        ))}
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
