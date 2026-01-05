import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import type { Scenario } from '../../src/types/loan';
import { calculateLoanSummary, formatCurrency, generateAmortizationSchedule } from '../../src/lib/calculations';

const DEFAULT_SCENARIO: Scenario = {
  system: 'PRICE',
  principal: 300000,
  rate: 1.2,
  rateType: 'monthly',
  term: 360,
  termUnit: 'months',
  startDate: new Date(),
  dueDay: 5,
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

export default function CalculatorScreen() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [principalText, setPrincipalText] = useState('300000');
  const [rateText, setRateText] = useState('1,2');
  const [termText, setTermText] = useState('360');
  const [startDateText, setStartDateText] = useState(new Date().toISOString().slice(0, 10));
  const [dueDayText, setDueDayText] = useState('5');

  const schedule = useMemo(() => generateAmortizationSchedule(scenario), [scenario]);
  const summary = useMemo(() => calculateLoanSummary(schedule), [schedule]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Calculadora Price & SAC</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sistema</Text>
        <View style={styles.toggleRow}>
          {(['PRICE', 'SAC'] as const).map((system) => (
            <Pressable
              key={system}
              onPress={() => setScenario((prev) => ({ ...prev, system }))}
              style={[
                styles.toggleButton,
                scenario.system === system && styles.toggleButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  scenario.system === system && styles.toggleButtonTextActive,
                ]}
              >
                {system}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parâmetros</Text>

        <Text style={styles.label}>Valor do Financiamento (R$)</Text>
        <TextInput
          value={principalText}
          onChangeText={(text) => {
            setPrincipalText(text);
            setScenario((prev) => ({ ...prev, principal: parseCurrencyInput(text) }));
          }}
          keyboardType="numeric"
          style={styles.input}
          placeholder="300000 ou 300.000,00"
        />

        <Text style={styles.label}>Taxa de Juros</Text>
        <View style={styles.row}>
          <TextInput
            value={rateText}
            onChangeText={(text) => {
              setRateText(text);
              setScenario((prev) => ({ ...prev, rate: parseNumberInput(text) }));
            }}
            keyboardType="numeric"
            style={[styles.input, styles.inputFlex]}
            placeholder="1,2"
          />
          <View style={styles.toggleRow}>
            {(['monthly', 'annual'] as const).map((rateType) => (
              <Pressable
                key={rateType}
                onPress={() => setScenario((prev) => ({ ...prev, rateType }))}
                style={[
                  styles.chip,
                  scenario.rateType === rateType && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    scenario.rateType === rateType && styles.chipTextActive,
                  ]}
                >
                  {rateType === 'monthly' ? 'a.m.' : 'a.a.'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Prazo</Text>
        <View style={styles.row}>
          <TextInput
            value={termText}
            onChangeText={(text) => {
              setTermText(text);
              const parsed = Number.parseInt(text || '0', 10);
              setScenario((prev) => ({ ...prev, term: Number.isNaN(parsed) ? 0 : parsed }));
            }}
            keyboardType="numeric"
            style={[styles.input, styles.inputFlex]}
            placeholder="360"
          />
          <View style={styles.toggleRow}>
            {(['months', 'years'] as const).map((termUnit) => (
              <Pressable
                key={termUnit}
                onPress={() => setScenario((prev) => ({ ...prev, termUnit }))}
                style={[
                  styles.chip,
                  scenario.termUnit === termUnit && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    scenario.termUnit === termUnit && styles.chipTextActive,
                  ]}
                >
                  {termUnit === 'months' ? 'Meses' : 'Anos'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Data de Início (YYYY-MM-DD)</Text>
        <TextInput
          value={startDateText}
          onChangeText={(text) => {
            setStartDateText(text);
            const parsed = new Date(text);
            if (!Number.isNaN(parsed.getTime())) {
              setScenario((prev) => ({ ...prev, startDate: parsed }));
            }
          }}
          style={styles.input}
          placeholder="2026-01-05"
        />

        <Text style={styles.label}>Dia de Vencimento</Text>
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
          style={styles.input}
          placeholder="5"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Pago</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalPayment)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total de Juros</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalInterest)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>1ª Parcela</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.firstPayment)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Última Parcela</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.lastPayment)}</Text>
        </View>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  },
  summaryLabel: {
    color: '#374151',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#111827',
  },
});
