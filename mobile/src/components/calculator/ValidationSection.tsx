import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme';

interface ValidationSectionProps {
  errors: string[];
  warnings: string[];
}

export function ValidationSection({ errors, warnings }: ValidationSectionProps) {
  const { colors } = useTheme();

  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {errors.length > 0 && (
        <View style={[styles.banner, { backgroundColor: colors.errorLight }]}>
          {errors.map((error, index) => (
            <Text key={index} style={[styles.bannerText, { color: colors.error }]}>
              {error}
            </Text>
          ))}
        </View>
      )}
      {warnings.length > 0 && (
        <View
          style={[styles.banner, { backgroundColor: colors.warningLight }]}
          testID="validation-warnings"
        >
          {warnings.map((warning, index) => (
            <Text key={index} style={[styles.bannerText, { color: colors.warning }]}>
              {warning}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  banner: {
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  bannerText: {
    fontSize: 13,
  },
});
