import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { usePremium } from '../../src/hooks/usePremium';

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isPremium } = usePremium();

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="analytics-outline" size={18} color={colors.tabActive} />
              <Text style={[styles.headerTitleText, { color: colors.text }]}>Price & SAC</Text>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Simulador de financiamento
            </Text>
          </View>
        ),
        headerRight: () =>
          !isPremium ? (
            <Pressable
              style={[
                styles.headerChip,
                { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
              ]}
              onPress={() => router.push('/(tabs)/premium')}
              accessibilityRole="button"
              accessibilityLabel="Abrir Premium"
            >
              <Ionicons name="star-outline" size={14} color={colors.tabActive} />
              <Text style={[styles.headerChipText, { color: colors.tabActive }]}>Assinar</Text>
            </Pressable>
          ) : null,
      }}
    >
      <Tabs.Screen
        name="calculator"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calculator-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="comparison"
        options={{
          title: 'Comparar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-compare-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="premium"
        options={{
          title: 'Premium',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: 'Feedback',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
  },
  headerChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
