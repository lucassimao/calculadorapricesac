import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RateType } from '@loan-engine/loan';
import type { NominalCashFlowComparison } from '../../lib/portability';
import { useTheme } from '../../lib/theme';

interface PortabilitySectionProps {
  rateText: string;
  rateType: RateType;
  termText: string;
  costsText: string;
  onRateTextChange: (text: string) => void;
  onRateTypeChange: (rateType: RateType) => void;
  onTermTextChange: (text: string) => void;
  onCostsTextChange: (text: string) => void;
  onCompare: () => void;
  error: string | null;
  result: NominalCashFlowComparison | null;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatPaymentDelta(delta: number) {
  if (delta < 0) return `${formatCurrency(Math.abs(delta))} menor`;
  if (delta > 0) return `${formatCurrency(delta)} maior`;
  return 'Mesmo valor';
}

export function PortabilitySection({
  rateText,
  rateType,
  termText,
  costsText,
  onRateTextChange,
  onRateTypeChange,
  onTermTextChange,
  onCostsTextChange,
  onCompare,
  error,
  result,
}: PortabilitySectionProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
      testID="section-portability"
    >
      <Text style={[styles.title, { color: colors.text }]}>Comparar com outra proposta</Text>
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        Compare os fluxos nominais do contrato atual e da portabilidade, sem desconto a valor
        presente.
      </Text>
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        A nova proposta considera o mesmo sistema e o mesmo indexador, seguro e tarifa mensal do
        contrato atual.
      </Text>
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        Amortizações e usos de FGTS planejados não entram nesta comparação contratual.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Taxa da nova proposta</Text>
      <View style={styles.rateRow}>
        <TextInput
          value={rateText}
          onChangeText={onRateTextChange}
          keyboardType="numeric"
          placeholder="9,5"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Taxa da nova proposta"
          style={[
            styles.input,
            styles.rateInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
          testID="input-portability-rate"
        />
        <View style={styles.rateTypeOptions} accessibilityRole="radiogroup">
          {(['monthly', 'annual'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => onRateTypeChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: rateType === option }}
              accessibilityLabel={option === 'monthly' ? 'Taxa nova ao mês' : 'Taxa nova ao ano'}
              style={[
                styles.rateType,
                { borderColor: colors.border },
                rateType === option && {
                  borderColor: colors.primary,
                  backgroundColor: colors.primaryLight,
                },
              ]}
              testID={`portability-rate-${option}`}
            >
              <Text style={{ color: rateType === option ? colors.primary : colors.textSecondary }}>
                {option === 'monthly' ? 'a.m.' : 'a.a.'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Prazo da nova proposta (meses)
      </Text>
      <TextInput
        value={termText}
        onChangeText={onTermTextChange}
        keyboardType="numeric"
        placeholder="180"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Prazo da nova proposta em meses"
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
        testID="input-portability-term"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Custos da portabilidade (R$)
      </Text>
      <TextInput
        value={costsText}
        onChangeText={onCostsTextChange}
        keyboardType="numeric"
        placeholder="R$ 0"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Custos da portabilidade"
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
        testID="input-portability-costs"
      />
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        Cartório, avaliação e tarifas entram uma única vez, fora das parcelas.
      </Text>

      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="portability-error"
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={onCompare}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.primary }]}
        testID="btn-compare-portability"
      >
        <Text style={styles.buttonText}>Comparar propostas</Text>
      </Pressable>

      {result ? (
        <View
          style={[
            styles.result,
            result.totalSavings > 0
              ? { backgroundColor: colors.successLight, borderColor: colors.success }
              : { backgroundColor: colors.warningLight, borderColor: colors.warning },
          ]}
          accessibilityLiveRegion="polite"
          testID="portability-result"
        >
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Total restante atual
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatCurrency(result.currentTotalCost)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Nova proposta + custos
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatCurrency(result.newTotalCost)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Diferença na 1ª parcela
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatPaymentDelta(result.monthlyPaymentDelta)}
            </Text>
          </View>
          <Text
            style={[
              styles.breakEven,
              { color: result.totalSavings > 0 ? colors.success : colors.warning },
            ]}
            testID="portability-break-even"
          >
            {result.breakEvenMonth === null
              ? 'Sem break-even no prazo'
              : `Break-even: ${result.breakEvenMonth}º mês`}
          </Text>
          <Text style={[styles.recommendation, { color: colors.text }]}>
            {result.recommendation}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
        Seguros e taxas no novo banco podem ser diferentes. Confirme o CET e as condições da nova
        proposta antes de decidir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700' },
  helper: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateInput: { flex: 1 },
  rateTypeOptions: { flexDirection: 'row', gap: 6 },
  rateType: {
    minHeight: 44,
    minWidth: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: 13, lineHeight: 18 },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  result: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, marginTop: 4 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metricLabel: { flex: 1, fontSize: 13 },
  metricValue: { fontSize: 13, fontWeight: '700' },
  breakEven: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  recommendation: { fontSize: 14, lineHeight: 20 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
