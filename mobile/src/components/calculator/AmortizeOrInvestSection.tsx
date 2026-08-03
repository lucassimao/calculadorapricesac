import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  INVESTMENT_RATE_PRESETS,
  type AmortizeOrInvestResult,
  type InvestmentTaxRegime,
  type InvestmentVehicle,
} from '../../lib/amortize-or-invest';
import { useTheme } from '../../lib/theme';

interface AmortizeOrInvestSectionProps {
  amountText: string;
  vehicle: InvestmentVehicle;
  annualRateText: string;
  horizonText: string;
  taxRegime: InvestmentTaxRegime;
  isPremium: boolean;
  result: AmortizeOrInvestResult | null;
  error: string | null;
  onAmountTextChange: (text: string) => void;
  onVehicleChange: (vehicle: InvestmentVehicle) => void;
  onAnnualRateTextChange: (text: string) => void;
  onHorizonTextChange: (text: string) => void;
  onTaxRegimeChange: (regime: InvestmentTaxRegime) => void;
  onCompare: () => void;
  onUpgrade: () => void;
  onOpenSource: () => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const formatDate = (value: Date) => value.toLocaleDateString('pt-BR');

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

export function AmortizeOrInvestSection({
  amountText,
  vehicle,
  annualRateText,
  horizonText,
  taxRegime,
  isPremium,
  result,
  error,
  onAmountTextChange,
  onVehicleChange,
  onAnnualRateTextChange,
  onHorizonTextChange,
  onTaxRegimeChange,
  onCompare,
  onUpgrade,
  onOpenSource,
}: AmortizeOrInvestSectionProps) {
  const { colors } = useTheme();
  const preset = INVESTMENT_RATE_PRESETS[vehicle];
  const winnerLabel =
    result?.winner === 'amortize'
      ? 'Amortizar vence'
      : result?.winner === 'invest'
        ? 'Investir vence'
        : 'Empate técnico';
  const resultColor =
    result?.winner === 'amortize'
      ? colors.success
      : result?.winner === 'invest'
        ? colors.warning
        : colors.primary;
  const resultBackgroundColor =
    result?.winner === 'amortize'
      ? colors.successLight
      : result?.winner === 'invest'
        ? colors.warningLight
        : colors.primaryLight;

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
      testID="section-amortize-invest"
    >
      <Text style={[styles.title, { color: colors.text }]}>Amortizar ou investir?</Text>
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        Compare o ganho líquido de investir com a redução real da dívida no mesmo horizonte.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Valor disponível agora</Text>
      <TextInput
        value={amountText}
        onChangeText={onAmountTextChange}
        keyboardType="numeric"
        placeholder="R$ 20.000"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Valor para amortizar ou investir"
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
        testID="input-amortize-invest-amount"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Referência do investimento
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {(Object.keys(INVESTMENT_RATE_PRESETS) as InvestmentVehicle[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => onVehicleChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: vehicle === option }}
            style={[
              styles.chip,
              { borderColor: colors.border },
              vehicle === option && {
                borderColor: colors.primary,
                backgroundColor: colors.primaryLight,
              },
            ]}
            testID={
              option === 'tesouro_selic' ? 'investment-vehicle-selic' : 'investment-vehicle-cdi'
            }
          >
            <Text style={{ color: vehicle === option ? colors.primary : colors.textSecondary }}>
              {INVESTMENT_RATE_PRESETS[option].label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Rentabilidade bruta (% a.a.)
      </Text>
      <TextInput
        value={annualRateText}
        onChangeText={onAnnualRateTextChange}
        keyboardType="numeric"
        placeholder="14,15"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Rentabilidade bruta anual"
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
        testID="input-investment-annual-rate"
      />
      <Text style={[styles.helper, { color: colors.textTertiary }]}>
        {preset.disclaimer} Base de {preset.asOf.split('-').reverse().join('/')}.
      </Text>
      <Pressable
        onPress={onOpenSource}
        accessibilityRole="link"
        accessibilityLabel={`Abrir fonte ${preset.sourceLabel}`}
        testID="investment-source-link"
      >
        <Text style={[styles.link, { color: colors.primary }]}>{preset.sourceLabel}</Text>
      </Pressable>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Horizonte (meses)</Text>
      <TextInput
        value={horizonText}
        onChangeText={onHorizonTextChange}
        keyboardType="numeric"
        placeholder="60"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Horizonte em meses"
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
        testID="input-investment-horizon"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>Tributação</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {(['regressive', 'exempt'] as InvestmentTaxRegime[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => onTaxRegimeChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: taxRegime === option }}
            style={[
              styles.chip,
              { borderColor: colors.border },
              taxRegime === option && {
                borderColor: colors.primary,
                backgroundColor: colors.primaryLight,
              },
            ]}
            testID={`investment-tax-${option}`}
          >
            <Text style={{ color: taxRegime === option ? colors.primary : colors.textSecondary }}>
              {option === 'regressive' ? 'IR regressivo' : 'Investimento isento'}
            </Text>
          </Pressable>
        ))}
      </View>
      {taxRegime === 'regressive' ? (
        <Text style={[styles.helper, { color: colors.textTertiary }]}>
          Alíquotas sobre o rendimento: 22,5% até 180 dias; 20% até 360; 17,5% até 720; 15% depois
          disso.
        </Text>
      ) : null}

      {error ? (
        <Text
          style={[styles.error, { color: colors.error }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="amortize-invest-error"
        >
          {error}
        </Text>
      ) : null}

      {isPremium ? (
        <Pressable
          onPress={onCompare}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.primary }]}
          testID="btn-compare-amortize-invest"
        >
          <Text style={styles.buttonText}>Comparar caminhos</Text>
        </Pressable>
      ) : (
        <View
          style={[
            styles.gate,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}
          testID="amortize-invest-premium-gate"
        >
          <Text style={[styles.gateTitle, { color: colors.primary }]}>
            Resultado exclusivo do Premium
          </Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            Compare o ganho líquido, a nova quitação e a taxa que vira a decisão.
          </Text>
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: colors.primary }]}
            testID="btn-amortize-invest-upgrade"
          >
            <Text style={styles.buttonText}>Ver resultado no Premium</Text>
          </Pressable>
        </View>
      )}

      {isPremium && result ? (
        <View
          style={[
            styles.result,
            {
              backgroundColor: resultBackgroundColor,
              borderColor: resultColor,
            },
          ]}
          accessibilityLiveRegion="polite"
          testID="amortize-invest-result"
        >
          <Text style={[styles.winner, { color: resultColor }]}>
            {winnerLabel}
            {result.winner === 'tie' ? '' : ` por ${formatCurrency(result.difference)}`}
          </Text>

          <Text style={[styles.resultTitle, { color: colors.text }]}>Amortizar agora</Text>
          <Metric
            label="Juros economizados"
            value={formatCurrency(result.amortization.interestSaved)}
            color={colors.textSecondary}
          />
          <Metric
            label="Nova quitação"
            value={formatDate(result.amortization.newPayoffDate)}
            color={colors.textSecondary}
          />
          <Metric
            label="Valor no horizonte"
            value={formatCurrency(result.amortization.horizonValue)}
            color={colors.textSecondary}
          />
          <Metric
            label="Retorno anual equivalente (isento)"
            value={`${formatPercent(result.amortization.equivalentAnnualReturn)} a.a.`}
            color={colors.textSecondary}
          />

          <Text style={[styles.resultTitle, { color: colors.text }]}>Investir</Text>
          <Metric
            label="Saldo bruto"
            value={formatCurrency(result.investment.grossBalance)}
            color={colors.textSecondary}
          />
          <Metric
            label="IR estimado"
            value={formatCurrency(result.investment.taxAmount)}
            color={colors.textSecondary}
          />
          <Metric
            label="Saldo líquido"
            value={formatCurrency(result.investment.netBalance)}
            color={colors.textSecondary}
          />
          <Text style={[styles.flip, { color: colors.text }]}>
            Taxa de virada: {formatPercent(result.flipAnnualRate)} a.a. bruto
          </Text>
        </View>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
        Simulação nominal: reinveste as parcelas economizadas na taxa informada e pressupõe taxa
        constante e resgate no horizonte. Não inclui risco, liquidez ou inflação e não é
        recomendação de investimento.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 16, borderWidth: 1, gap: 10, marginBottom: 16, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  helper: { fontSize: 12, lineHeight: 18 },
  input: { borderRadius: 10, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    justifyContent: 'center',
    minHeight: 44,
    textDecorationLine: 'underline',
    textAlignVertical: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { fontSize: 13, fontWeight: '600' },
  gate: { borderRadius: 12, borderWidth: 1, gap: 8, padding: 14 },
  gateTitle: { fontSize: 16, fontWeight: '700' },
  result: { borderRadius: 12, borderWidth: 1, gap: 7, padding: 14 },
  winner: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  resultTitle: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  metricLabel: { flex: 1, fontSize: 13 },
  metricValue: { fontSize: 13, fontWeight: '700' },
  flip: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 2 },
});
