import type {
  OptimizerGoal,
  OptimizerResult,
  OptimizerSuccess,
} from '@loan-engine/calculations/optimizer';
import { formatCurrency } from '@loan-engine/calculations';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { formatDateBR, maskDateInput } from '../../lib/utils';

type PrepaymentOptimizerSheetProps = {
  visible: boolean;
  isPremium: boolean;
  goal: OptimizerGoal;
  targetDateText: string;
  oneOffAmountText: string;
  recurringAmountText: string;
  targetPaymentText: string;
  result: OptimizerResult | null;
  isGenerating: boolean;
  onClose: () => void;
  onGoalChange: (goal: OptimizerGoal) => void;
  onTargetDateTextChange: (value: string) => void;
  onOneOffAmountTextChange: (value: string) => void;
  onRecurringAmountTextChange: (value: string) => void;
  onTargetPaymentTextChange: (value: string) => void;
  onGenerate: () => void;
  onUpgrade: () => void;
  onSavePlan: () => void;
};

const GOALS: { value: OptimizerGoal; label: string; testID: string }[] = [
  {
    value: 'payoff_by_date',
    label: 'Quitar até uma data',
    testID: 'optimizer-goal-payoff-date',
  },
  {
    value: 'minimize_interest',
    label: 'Minimizar juros',
    testID: 'optimizer-goal-minimize-interest',
  },
  {
    value: 'payment_cap',
    label: 'Reduzir parcela para um teto',
    testID: 'optimizer-goal-payment-cap',
  },
];

function ResultRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.resultValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function getPlanHeadline(result: OptimizerSuccess) {
  if (result.goal === 'payoff_by_date') {
    return result.recurringAmount
      ? `${formatCurrency(result.recurringAmount)} por mês`
      : 'Meta já atendida';
  }
  if (result.goal === 'payment_cap') {
    return result.oneOffAmount
      ? `${formatCurrency(result.oneOffAmount)} na próxima parcela`
      : 'Teto já atendido';
  }
  const parts = [
    result.oneOffAmount ? `${formatCurrency(result.oneOffAmount)} agora` : null,
    result.recurringAmount ? `${formatCurrency(result.recurringAmount)} por mês` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(' + ');
}

function OptimizerResultCard({
  result,
  onSavePlan,
}: {
  result: OptimizerResult;
  onSavePlan: () => void;
}) {
  const { colors } = useTheme();
  if (result.status === 'unreachable') {
    return (
      <View
        style={[styles.unreachableCard, { backgroundColor: colors.errorLight }]}
        testID="optimizer-unreachable-result"
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.resultTitle, { color: colors.error }]}>Meta não alcançável</Text>
        <Text style={[styles.resultBody, { color: colors.textSecondary }]}>{result.message}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.successLight, borderColor: colors.success },
      ]}
      testID="optimizer-plan-result"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.resultEyebrow, { color: colors.success }]}>PLANO PERSONALIZADO</Text>
      <Text style={[styles.planHeadline, { color: colors.text }]}>{getPlanHeadline(result)}</Text>
      <Text style={[styles.occurrences, { color: colors.textSecondary }]}>
        {result.prepayments.length > 0
          ? `${result.prepayments.length} ${result.prepayments.length === 1 ? 'ocorrência' : 'ocorrências'} a partir de ${formatDateBR(result.prepayments[0].date)}`
          : 'Nenhuma amortização adicional necessária.'}
      </Text>
      <View style={[styles.resultDivider, { backgroundColor: colors.border }]} />
      <ResultRow label="Juros antes" value={formatCurrency(result.baseSummary.totalInterest)} />
      <ResultRow
        label="Juros com o plano"
        value={formatCurrency(result.optimizedSummary.totalInterest)}
      />
      <ResultRow label="Juros economizados" value={formatCurrency(result.interestSaved)} />
      <ResultRow label="Quitação estimada" value={formatDateBR(result.payoffDate)} />
      {result.targetPayment !== undefined ? (
        <ResultRow label="Teto de parcela" value={formatCurrency(result.targetPayment)} />
      ) : null}
      {result.interestTradeoff !== undefined && result.interestTradeoff > 0 ? (
        <ResultRow
          label="Juros extras pelo alívio mensal"
          value={formatCurrency(result.interestTradeoff)}
        />
      ) : null}
      <Text style={[styles.explanation, { color: colors.textSecondary }]}>
        {result.explanation}
      </Text>
      {result.prepayments.length > 0 ? (
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onSavePlan}
          accessibilityRole="button"
          accessibilityLabel="Salvar plano como cenário"
          testID="btn-save-optimizer-plan"
        >
          <Text style={styles.primaryButtonText}>Salvar como cenário</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrepaymentOptimizerSheet({
  visible,
  isPremium,
  goal,
  targetDateText,
  oneOffAmountText,
  recurringAmountText,
  targetPaymentText,
  result,
  isGenerating,
  onClose,
  onGoalChange,
  onTargetDateTextChange,
  onOneOffAmountTextChange,
  onRecurringAmountTextChange,
  onTargetPaymentTextChange,
  onGenerate,
  onUpgrade,
  onSavePlan,
}: PrepaymentOptimizerSheetProps) {
  const { colors } = useTheme();
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
  ];

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>PREMIUM</Text>
            <Text style={[styles.title, { color: colors.text }]}>Assistente de amortização</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Diga sua meta. O app testa o contrato completo e encontra um plano reproduzível.
            </Text>
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar assistente de amortização"
            testID="btn-close-optimizer"
          >
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Qual é sua meta?</Text>
          <View style={styles.goalList}>
            {GOALS.map((option) => {
              const selected = goal === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.goalButton,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    selected && {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => onGoalChange(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  testID={option.testID}
                >
                  <Text
                    style={[
                      styles.goalText,
                      { color: selected ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {goal === 'payoff_by_date' ? (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Data desejada</Text>
              <TextInput
                value={targetDateText}
                onChangeText={(text) => onTargetDateTextChange(maskDateInput(text))}
                style={inputStyle}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                accessibilityLabel="Data desejada para quitar"
                testID="input-optimizer-target-date"
              />
            </View>
          ) : null}
          {goal === 'minimize_interest' ? (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Valor único disponível
              </Text>
              <TextInput
                value={oneOffAmountText}
                onChangeText={onOneOffAmountTextChange}
                style={inputStyle}
                placeholder="R$ 10.000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                accessibilityLabel="Valor único disponível para amortizar"
                testID="input-optimizer-one-off"
              />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Orçamento mensal</Text>
              <TextInput
                value={recurringAmountText}
                onChangeText={onRecurringAmountTextChange}
                style={inputStyle}
                placeholder="R$ 500"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                accessibilityLabel="Orçamento mensal para amortizar"
                testID="input-optimizer-recurring"
              />
            </View>
          ) : null}
          {goal === 'payment_cap' ? (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Teto da parcela</Text>
              <TextInput
                value={targetPaymentText}
                onChangeText={onTargetPaymentTextChange}
                style={inputStyle}
                placeholder="R$ 2.000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                accessibilityLabel="Teto desejado para a parcela"
                testID="input-optimizer-payment-cap"
              />
            </View>
          ) : null}

          {isPremium ? (
            <>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={onGenerate}
                disabled={isGenerating}
                accessibilityState={{ disabled: isGenerating }}
                accessibilityRole="button"
                accessibilityLabel="Calcular plano de amortização"
                testID="btn-generate-optimizer-plan"
              >
                {isGenerating ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={styles.primaryButtonText}>
                  {isGenerating ? 'Calculando plano...' : 'Calcular meu plano'}
                </Text>
              </Pressable>
              {result ? <OptimizerResultCard result={result} onSavePlan={onSavePlan} /> : null}
            </>
          ) : (
            <View
              style={[styles.gate, { borderColor: colors.border }]}
              testID="optimizer-premium-gate"
            >
              <View
                style={styles.blurredPreview}
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
              >
                <Text style={[styles.resultEyebrow, { color: colors.textTertiary }]}>
                  PLANO PERSONALIZADO
                </Text>
                <Text style={[styles.planHeadline, { color: colors.textTertiary }]}>
                  R$ ••• por mês
                </Text>
                <ResultRow label="Juros antes" value="R$ •••" />
                <ResultRow label="Juros com o plano" value="R$ •••" />
                <ResultRow label="Quitação estimada" value="••/••/••••" />
              </View>
              <View style={[styles.gateOverlay, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.gateTitle, { color: colors.text }]}>
                  Resultado exclusivo do Premium
                </Text>
                <Text style={[styles.gateText, { color: colors.textSecondary }]}>
                  Desbloqueie o cálculo completo, o plano e o salvamento no cenário.
                </Text>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={onUpgrade}
                  accessibilityRole="button"
                  accessibilityLabel="Desbloquear assistente no Premium"
                  testID="btn-optimizer-upgrade"
                >
                  <Text style={styles.primaryButtonText}>Ver meu plano no Premium</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  closeText: {
    fontSize: 30,
    lineHeight: 32,
  },
  content: {
    gap: 14,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  goalList: {
    gap: 8,
  },
  goalButton: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  goalText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  gate: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 260,
    overflow: 'hidden',
    position: 'relative',
  },
  blurredPreview: {
    gap: 10,
    opacity: 0.16,
    padding: 18,
  },
  gateOverlay: {
    alignItems: 'center',
    bottom: 0,
    gap: 8,
    justifyContent: 'center',
    left: 0,
    opacity: 0.94,
    padding: 20,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  gateTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  gateText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  unreachableCard: {
    borderRadius: 14,
    gap: 6,
    padding: 16,
  },
  resultEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  resultBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  planHeadline: {
    fontSize: 20,
    fontWeight: '800',
  },
  occurrences: {
    fontSize: 12,
    lineHeight: 18,
  },
  resultDivider: {
    height: 1,
  },
  resultRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  resultLabel: {
    flex: 1,
    fontSize: 13,
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  explanation: {
    fontSize: 13,
    lineHeight: 19,
  },
});
