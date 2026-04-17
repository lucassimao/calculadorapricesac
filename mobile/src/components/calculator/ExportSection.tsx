import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme';
import { PremiumPill } from '../PremiumPill';

type ExportFormat = 'pdf' | 'xlsx' | 'csv';

interface ExportSectionProps {
  isPremium: boolean;
  exporting: boolean;
  exportingFormat?: ExportFormat | null;
  onExport: (format: ExportFormat) => void;
}

export function ExportSection({
  isPremium,
  exporting,
  exportingFormat,
  onExport,
}: ExportSectionProps) {
  const { colors } = useTheme();
  const isLoading = (format: ExportFormat) => exporting && exportingFormat === format;

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} testID="section-export">
          Exportar
        </Text>
        <PremiumPill hidden={isPremium} />
      </View>
      <Text style={[styles.helperText, { color: colors.textTertiary }]}>
        Inclui tabela completa com juros, amortização extra, custos, FGTS e resumo do cenário.
      </Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.primaryButton, (!isPremium || exporting) && styles.primaryButtonDisabled]}
          onPress={() => onExport('pdf')}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityState={{ disabled: exporting }}
          accessibilityLabel="Exportar PDF"
          testID="btn-export-pdf"
          nativeID="btn-export-pdf"
        >
          <View style={styles.buttonContent}>
            {isLoading('pdf') ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.primaryButtonText}>{isLoading('pdf') ? 'Gerando...' : 'PDF'}</Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, (!isPremium || exporting) && styles.primaryButtonDisabled]}
          onPress={() => onExport('xlsx')}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityState={{ disabled: exporting }}
          accessibilityLabel="Exportar XLSX"
          testID="btn-export-xlsx"
          nativeID="btn-export-xlsx"
        >
          <View style={styles.buttonContent}>
            {isLoading('xlsx') ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.primaryButtonText}>
              {isLoading('xlsx') ? 'Gerando...' : 'XLSX'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, (!isPremium || exporting) && styles.primaryButtonDisabled]}
          onPress={() => onExport('csv')}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityState={{ disabled: exporting }}
          accessibilityLabel="Exportar CSV"
          testID="btn-export-csv"
          nativeID="btn-export-csv"
        >
          <View style={styles.buttonContent}>
            {isLoading('csv') ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.primaryButtonText}>{isLoading('csv') ? 'Gerando...' : 'CSV'}</Text>
          </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
