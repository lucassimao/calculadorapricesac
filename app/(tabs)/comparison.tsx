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
  const [principalText, setPrincipalText] = useState('300000');
  const [rateText, setRateText] = useState('1,2');
  const [termText, setTermText] = useState('360');
  const { isPremium, loading: premiumLoading } = usePremium();

  const priceSchedule = useMemo(
    () => generateAmortizationSchedule({ ...base, system: 'PRICE' }),
    [base]
  );
  const sacSchedule = useMemo(
    () => generateAmortizationSchedule({ ...base, system: 'SAC' }),
    [base]
  );

  const priceSummary = useMemo(() => calculateLoanSummary(priceSchedule), [priceSchedule]);
  const sacSummary = useMemo(() => calculateLoanSummary(sacSchedule), [sacSchedule]);

  const interestDiff = priceSummary.totalInterest - sacSummary.totalInterest;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Comparar SAC vs Price</Text>
      {!premiumLoading && <AdBanner enabled={!isPremium} />}

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
        />
      </View>

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
      </View>

      {!premiumLoading && <AdBanner enabled={!isPremium} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
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
  },
  card: {
    flex: 1,
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
  highlightText: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
});
