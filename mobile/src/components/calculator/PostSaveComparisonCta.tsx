import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/theme';

export function PostSaveComparisonCta({
  onCompare,
  onDismiss,
}: {
  onCompare: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Cenário salvo. Quer comparar propostas?');
  }, []);
  return (
    <View
      style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
      testID="post-save-comparison-cta"
    >
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: colors.text }]}>CENÁRIO SALVO</Text>
        <Text style={[styles.title, { color: colors.text }]}>Quer comparar propostas?</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Coloque juros, prazo e entrada lado a lado antes de decidir.
        </Text>
      </View>
      <Pressable
        style={[styles.compareButton, { backgroundColor: colors.primary }]}
        onPress={onCompare}
        accessibilityRole="button"
        accessibilityLabel="Comparar condições"
        testID="btn-post-save-compare"
      >
        <Text style={styles.compareText}>Comparar condições</Text>
      </Pressable>
      <Pressable
        style={styles.dismissButton}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Agora não"
        testID="btn-dismiss-post-save-compare"
      >
        <Text style={[styles.dismissText, { color: colors.textSecondary }]}>Agora não</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
    padding: 16,
  },
  copy: {
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  compareButton: {
    alignItems: 'center',
    borderRadius: 9,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compareText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
