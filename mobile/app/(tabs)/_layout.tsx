import { Tabs, useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { usePremium } from '../../src/hooks/usePremium';
import { useExport } from '../../src/contexts/ExportContext';

function ExportTabIcon({
  color,
  size,
  isPremium,
}: {
  color: string;
  size: number;
  isPremium: boolean;
}) {
  return (
    <View>
      <Ionicons name="share-outline" size={size} color={color} />
      {!isPremium && (
        <View style={styles.tabBadge}>
          <Ionicons name="star" size={8} color="#B45309" />
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isPremium } = usePremium();
  const { isExporting, isPremium: contextPremium, triggerExport } = useExport();

  const showExportActionSheet = () => {
    if (isExporting) return;

    const options = ['Exportar PDF', 'Exportar XLSX', 'Exportar CSV', 'Cancelar'];
    const cancelButtonIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Exportar Simulação',
          message: contextPremium
            ? 'Escolha o formato do arquivo'
            : 'Recurso disponível para assinantes Premium',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) triggerExport('pdf');
          else if (buttonIndex === 1) triggerExport('xlsx');
          else if (buttonIndex === 2) triggerExport('csv');
        },
      );
    } else {
      Alert.alert(
        'Exportar Simulação',
        contextPremium
          ? 'Escolha o formato do arquivo'
          : 'Recurso disponível para assinantes Premium',
        [
          { text: 'PDF', onPress: () => triggerExport('pdf') },
          { text: 'XLSX', onPress: () => triggerExport('xlsx') },
          { text: 'CSV', onPress: () => triggerExport('csv') },
          { text: 'Cancelar', style: 'cancel' },
        ],
      );
    }
  };

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
          title: 'Calculadora',
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
        name="export-action"
        options={{
          title: 'Exportar',
          tabBarIcon: ({ color, size }) => (
            <ExportTabIcon color={color} size={size} isPremium={isPremium} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Prevent navigation, just show action sheet
            e.preventDefault();
            showExportActionSheet();
          },
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
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
});
