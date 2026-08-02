import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme';

type AmortizationSystem = 'PRICE' | 'SAC';
type LoanMode = 'standard' | 'property';

interface SystemSelectorProps {
  system: AmortizationSystem;
  loanMode: LoanMode;
  onSystemChange: (system: AmortizationSystem) => void;
  onLoanModeChange: (mode: LoanMode) => void;
}

export function SystemSelector({
  system,
  loanMode,
  onSystemChange,
  onLoanModeChange,
}: SystemSelectorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Sistema</Text>
      <View style={styles.toggleRow}>
        {(['PRICE', 'SAC'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => onSystemChange(s)}
            style={[
              styles.toggleButton,
              { borderColor: colors.border },
              system === s && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: system === s }}
            accessibilityLabel={`Sistema ${s}`}
            testID={`system-${s.toLowerCase()}`}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: colors.textSecondary },
                system === s && { color: colors.primary },
              ]}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.helperText, { color: colors.textTertiary }]}>
        Price: parcelas fixas. SAC: amortização constante e parcelas decrescentes.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Modo</Text>
      <View style={styles.toggleRow}>
        {(
          [
            { value: 'standard', label: 'Padrão' },
            { value: 'property', label: 'Imóvel' },
          ] as const
        ).map((mode) => (
          <Pressable
            key={mode.value}
            onPress={() => onLoanModeChange(mode.value)}
            style={[
              styles.toggleButton,
              { borderColor: colors.border },
              loanMode === mode.value && {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: loanMode === mode.value }}
            accessibilityLabel={`Modo ${mode.label}`}
            testID={`loan-mode-${mode.value}`}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: colors.textSecondary },
                loanMode === mode.value && { color: colors.primary },
              ]}
            >
              {mode.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.helperText, { color: colors.textTertiary }]}>
        {loanMode === 'property'
          ? 'Modo imobiliário: calcula pelo valor do imóvel e entrada.'
          : 'Modo padrão: usa o valor do financiamento diretamente.'}
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
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
