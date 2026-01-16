import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PremiumPillProps {
  /** If true, the pill is hidden (e.g., when user already has premium) */
  hidden?: boolean;
  /** Optional custom label (defaults to "Premium") */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium';
}

/**
 * A golden pill/badge that indicates a feature is premium-only.
 * Automatically hidden when the user has premium access.
 */
export function PremiumPill({ hidden, label = 'Premium', size = 'small' }: PremiumPillProps) {
  if (hidden) return null;

  const isSmall = size === 'small';

  return (
    <View style={[styles.pill, isSmall ? styles.pillSmall : styles.pillMedium]}>
      <Ionicons
        name="star"
        size={isSmall ? 10 : 12}
        color="#B45309"
      />
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textMedium]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 999,
  },
  pillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  pillMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  text: {
    color: '#B45309',
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
});
