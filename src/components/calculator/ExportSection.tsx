import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme';

type ExportFormat = 'pdf' | 'xlsx' | 'csv';

interface ExportSectionProps {
  isPremium: boolean;
  exporting: boolean;
  onExport: (format: ExportFormat) => void;
}

export function ExportSection({ isPremium, exporting, onExport }: ExportSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} testID="section-export">
        Exportar
      </Text>
      <Text style={[styles.helperText, { color: colors.textTertiary }]}>
        Inclui tabela completa com juros, amortização, custos, FGTS e resumo do cenário.
      </Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.primaryButton,
            !isPremium && styles.primaryButtonDisabled,
          ]}
          onPress={() => onExport('pdf')}
          accessibilityRole="button"
          accessibilityLabel="Exportar PDF"
          testID="btn-export-pdf"
          nativeID="btn-export-pdf"
        >
          <Text style={styles.primaryButtonText}>PDF</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            !isPremium && styles.primaryButtonDisabled,
          ]}
          onPress={() => onExport('xlsx')}
          accessibilityRole="button"
          accessibilityLabel="Exportar XLSX"
          testID="btn-export-xlsx"
          nativeID="btn-export-xlsx"
        >
          <Text style={styles.primaryButtonText}>XLSX</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryButton,
            !isPremium && styles.primaryButtonDisabled,
          ]}
          onPress={() => onExport('csv')}
          accessibilityRole="button"
          accessibilityLabel="Exportar CSV"
          testID="btn-export-csv"
          nativeID="btn-export-csv"
        >
          <Text style={styles.primaryButtonText}>CSV</Text>
        </Pressable>
      </View>
      {exporting && (
        <View style={styles.exportingRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.exportingText, { color: colors.textSecondary }]}>
            Gerando arquivo...
          </Text>
        </View>
      )}
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
  helperText: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  exportingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportingText: {
    fontSize: 13,
  },
});
