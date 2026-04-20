import { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { usePremiumContext } from '../../src/contexts/PremiumContext';
import { useExport } from '../../src/contexts/ExportContext';
import type { ExportFormat } from '../../src/lib/exports/access';
import { trackEvent } from '../../src/lib/analytics';

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
  const { isPremium } = usePremiumContext();
  const {
    isExporting,
    isPremium: contextPremium,
    canUseRewardedExport,
    triggerExport,
  } = useExport();
  const [androidExportModalVisible, setAndroidExportModalVisible] = useState(false);
  const [androidExportFormat, setAndroidExportFormat] = useState<ExportFormat | null>(null);

  const showExportActionSheet = () => {
    if (isExporting) return;

    trackEvent('export_sheet_opened', {
      is_premium: contextPremium,
      rewarded_available: canUseRewardedExport,
      platform: Platform.OS,
    });

    const options = contextPremium
      ? ['Exportar PDF', 'Exportar XLSX', 'Exportar CSV', 'Cancelar']
      : canUseRewardedExport
        ? [
            'Ver anúncio e exportar PDF',
            'Ver anúncio e exportar XLSX',
            'Ver anúncio e exportar CSV',
            'Assinar Premium',
            'Cancelar',
          ]
        : ['Exportar PDF', 'Exportar XLSX', 'Exportar CSV', 'Assinar Premium', 'Cancelar'];
    const cancelButtonIndex = options.length - 1;
    const premiumButtonIndex = options.length - 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Exportar Simulação',
          message: contextPremium
            ? 'Escolha o formato do arquivo'
            : canUseRewardedExport
              ? 'Usuários gratuitos podem destravar cada exportação assistindo a um anúncio.'
              : 'Recurso disponível para assinantes Premium',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) triggerExport('pdf');
          else if (buttonIndex === 1) triggerExport('xlsx');
          else if (buttonIndex === 2) triggerExport('csv');
          else if (!contextPremium && buttonIndex === premiumButtonIndex) {
            trackEvent('export_upgrade_clicked', { source: 'tab_export_sheet', platform: 'ios' });
            router.push('/(tabs)/premium');
          }
        },
      );
    } else {
      setAndroidExportModalVisible(true);
    }
  };

  const handleAndroidExport = (format: 'pdf' | 'xlsx' | 'csv') => {
    if (isExporting) return;

    setAndroidExportFormat(format);
    void triggerExport(format);
  };

  useEffect(() => {
    if (isExporting || !androidExportModalVisible || androidExportFormat === null) return;
    setAndroidExportModalVisible(false);
    setAndroidExportFormat(null);
  }, [isExporting, androidExportModalVisible, androidExportFormat]);

  return (
    <>
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
                onPress={() => {
                  trackEvent('premium_entry_clicked', {
                    source: 'header_chip',
                    from_tab_layout: true,
                  });
                  router.push('/(tabs)/premium');
                }}
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
            tabBarButtonTestID: 'tab-calculator',
            tabBarAccessibilityLabel: 'Aba Calculadora',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calculator-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="comparison"
          options={{
            title: 'Comparar',
            tabBarButtonTestID: 'tab-comparison',
            tabBarAccessibilityLabel: 'Aba Comparar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="git-compare-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="export-action"
          options={{
            title: 'Exportar',
            tabBarButtonTestID: 'tab-export',
            tabBarAccessibilityLabel: 'Aba Exportar',
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
            unmountOnBlur: true,
            tabBarButtonTestID: 'tab-premium',
            tabBarAccessibilityLabel: 'Aba Premium',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="star-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="feedback"
          options={{
            title: 'Feedback',
            tabBarButtonTestID: 'tab-feedback',
            tabBarAccessibilityLabel: 'Aba Feedback',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      <Modal
        animationType="fade"
        transparent
        visible={androidExportModalVisible}
        onRequestClose={() => {
          if (!isExporting) {
            setAndroidExportModalVisible(false);
            setAndroidExportFormat(null);
          }
        }}
      >
        <View style={styles.modalBackdrop} testID="android-export-modal-backdrop">
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            testID="android-export-modal-card"
          >
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              testID="android-export-modal-title"
            >
              Exportar Simulação
            </Text>
            <Text
              style={[styles.modalText, { color: colors.textSecondary }]}
              testID="android-export-modal-description"
            >
              {contextPremium
                ? 'Escolha o formato do arquivo'
                : canUseRewardedExport
                  ? 'Usuários gratuitos podem destravar cada exportação assistindo a um anúncio.'
                  : 'Recurso disponível para assinantes Premium'}
            </Text>
            <View style={styles.modalActions} testID="android-export-modal-actions">
              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: '#2563EB' },
                  isExporting && styles.modalPrimaryButtonDisabled,
                ]}
                onPress={() => handleAndroidExport('pdf')}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="Exportar PDF"
                testID="android-export-modal-pdf"
              >
                <View style={styles.modalButtonContent}>
                  {isExporting && androidExportFormat === 'pdf' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.modalPrimaryButtonText}>
                    {isExporting && androidExportFormat === 'pdf' ? 'Gerando...' : 'PDF'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: '#2563EB' },
                  isExporting && styles.modalPrimaryButtonDisabled,
                ]}
                onPress={() => handleAndroidExport('xlsx')}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="Exportar XLSX"
                testID="android-export-modal-xlsx"
              >
                <View style={styles.modalButtonContent}>
                  {isExporting && androidExportFormat === 'xlsx' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.modalPrimaryButtonText}>
                    {isExporting && androidExportFormat === 'xlsx' ? 'Gerando...' : 'XLSX'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: '#2563EB' },
                  isExporting && styles.modalPrimaryButtonDisabled,
                ]}
                onPress={() => handleAndroidExport('csv')}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="Exportar CSV"
                testID="android-export-modal-csv"
              >
                <View style={styles.modalButtonContent}>
                  {isExporting && androidExportFormat === 'csv' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                  <Text style={styles.modalPrimaryButtonText}>
                    {isExporting && androidExportFormat === 'csv' ? 'Gerando...' : 'CSV'}
                  </Text>
                </View>
              </Pressable>
            </View>
            {!contextPremium ? (
              <Pressable
                style={[
                  styles.modalSecondaryButton,
                  { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                  isExporting && styles.modalSecondaryButtonDisabled,
                ]}
                onPress={() => {
                  if (!isExporting) {
                    trackEvent('export_upgrade_clicked', {
                      source: 'tab_export_sheet',
                      platform: 'android',
                    });
                    setAndroidExportModalVisible(false);
                    setAndroidExportFormat(null);
                    router.push('/(tabs)/premium');
                  }
                }}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="Assinar Premium"
                testID="android-export-modal-upgrade"
              >
                <Text style={[styles.modalSecondaryButtonText, { color: colors.text }]}>
                  Assinar Premium
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.modalSecondaryButton,
                { borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
                isExporting && styles.modalSecondaryButtonDisabled,
              ]}
              onPress={() => {
                if (!isExporting) {
                  setAndroidExportModalVisible(false);
                  setAndroidExportFormat(null);
                }
              }}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel="Cancelar exportação"
              testID="android-export-modal-cancel"
            >
              <Text style={[styles.modalSecondaryButtonText, { color: colors.textSecondary }]}>
                Cancelar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    gap: 10,
  },
  modalPrimaryButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  modalButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonDisabled: {
    opacity: 0.6,
  },
  modalSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
