import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CorrectionIndexType } from '../../types/loan';
import { useTheme } from '../../lib/theme';

interface IndexSelectorProps {
  indexType?: CorrectionIndexType;
  indexRateText: string;
  referenceLabel?: string | null;
  helperText?: string | null;
  loading: boolean;
  onIndexTypeChange: (type?: CorrectionIndexType) => void;
  onIndexRateTextChange: (text: string) => void;
}

const INDEX_OPTIONS: (CorrectionIndexType | undefined)[] = [undefined, 'TR', 'IPCA'];

function getIndexOptionTestID(type: CorrectionIndexType | undefined) {
  return `chip-index-${type?.toLowerCase() ?? 'none'}`;
}

export function IndexSelector({
  indexType,
  indexRateText,
  referenceLabel,
  helperText,
  loading,
  onIndexTypeChange,
  onIndexRateTextChange,
}: IndexSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Correção Monetária</Text>
      <View style={styles.toggleRow}>
        {INDEX_OPTIONS.map((type) => {
          const selected = indexType === type;
          const label = type ?? 'Nenhuma';
          const testID = getIndexOptionTestID(type);
          return (
            <Pressable
              key={type ?? 'none'}
              onPress={() => onIndexTypeChange(type)}
              style={[
                styles.chip,
                { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
                selected && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Correção ${label}`}
              testID={testID}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.textSecondary },
                  selected && { color: colors.primary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {indexType && (
        <>
          <View style={styles.rateLabelRow}>
            <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>
              Taxa {indexType} (% a.m.)
            </Text>
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <TextInput
            value={indexRateText}
            onChangeText={onIndexRateTextChange}
            keyboardType="numeric"
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder={loading ? 'Buscando no BACEN...' : 'Ex.: 0,08'}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={`Taxa ${indexType} ao mês`}
            testID="input-index-rate"
          />
          <Text style={[styles.helperText, { color: colors.textTertiary }]}>
            {referenceLabel ??
              helperText ??
              'Aplicada mensalmente ao saldo devedor antes dos juros da parcela.'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rateLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
