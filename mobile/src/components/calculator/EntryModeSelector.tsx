import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EntryMode } from '@loan-engine/loan';
import { useTheme } from '../../lib/theme';

interface EntryModeSelectorProps {
  entryMode: EntryMode;
  onChange: (entryMode: EntryMode) => void;
}

const OPTIONS: { value: EntryMode; label: string; testID: string }[] = [
  { value: 'new_loan', label: 'Novo financiamento', testID: 'entry-mode-new-loan' },
  {
    value: 'existing_contract',
    label: 'Já tenho um financiamento',
    testID: 'entry-mode-existing-contract',
  },
];

export function EntryModeSelector({ entryMode, onChange }: EntryModeSelectorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
      testID="section-entry-mode"
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>O que você quer simular?</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              { borderColor: colors.border },
              entryMode === option.value && {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: entryMode === option.value }}
            accessibilityLabel={option.label}
            testID={option.testID}
          >
            <Text
              style={[
                styles.optionText,
                { color: colors.textSecondary },
                entryMode === option.value && { color: colors.primary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.helperText, { color: colors.textTertiary }]}>
        {entryMode === 'existing_contract'
          ? 'Use o saldo e as parcelas que ainda faltam no seu contrato.'
          : 'Simule um crédito desde a contratação.'}
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
  options: {
    gap: 8,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
