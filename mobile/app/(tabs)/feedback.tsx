import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { usePremium } from '../../src/hooks/usePremium';
import { PremiumPill } from '../../src/components/PremiumPill';
import { AdBanner } from '../../src/components/AdBanner';

const FEEDBACK_EMAIL = 'lucas@lucassimao.com';
const FEEDBACK_SUBJECT = 'Feedback - Calculadora Price & SAC';
const WHATSAPP_NUMBER = '5511999999999'; // Replace with actual number
const WHATSAPP_MESSAGE = 'Olá! Tenho uma dúvida sobre o app Calculadora Price & SAC.';

const getMailtoUrl = () =>
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`;

const getWhatsAppUrl = () =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const { isPremium, loading: premiumLoading } = usePremium();
  const showAds = !premiumLoading && !isPremium;
  const [attempted, setAttempted] = useState(false);

  const themedStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    title: { color: colors.text },
    subtitle: { color: colors.textSecondary },
    card: { backgroundColor: colors.backgroundSecondary },
    label: { color: colors.textTertiary },
    value: { color: colors.text },
  }), [colors]);

  const openEmail = async () => {
    const url = getMailtoUrl();
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Email indisponível', 'Não foi possível abrir o app de e-mail.');
      return;
    }
    await Linking.openURL(url);
    setAttempted(true);
  };

  const openWhatsApp = async () => {
    const url = getWhatsAppUrl();
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('WhatsApp indisponível', 'Não foi possível abrir o WhatsApp.');
      return;
    }
    await Linking.openURL(url);
  };

  useEffect(() => {
    openEmail().catch(() => {});
  }, []);

  return (
    <ScrollView contentContainerStyle={[styles.container, themedStyles.container]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, themedStyles.title]}>Feedback</Text>
      <Text style={[styles.subtitle, themedStyles.subtitle]}>
        Escreva sua sugestão, dúvida ou problema.
      </Text>

      <AdBanner enabled={showAds} />

      {/* WhatsApp - Premium only */}
      {isPremium && (
        <View style={[styles.card, themedStyles.card, styles.whatsappCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <Text style={[styles.cardTitle, themedStyles.title]}>WhatsApp</Text>
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={10} color="#B45309" />
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </View>
          </View>
          <Text style={[styles.cardDescription, themedStyles.subtitle]}>
            Atendimento prioritário para assinantes Premium.
          </Text>
          <Pressable
            style={styles.whatsappButton}
            onPress={openWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Abrir WhatsApp"
          >
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
            <Text style={styles.whatsappButtonText}>Conversar no WhatsApp</Text>
          </Pressable>
        </View>
      )}

      {/* Email - Available to all */}
      <View style={[styles.card, themedStyles.card]}>
        <View style={styles.cardHeader}>
          <Ionicons name="mail-outline" size={24} color={colors.primary} />
          <Text style={[styles.cardTitle, themedStyles.title]}>E-mail</Text>
        </View>
        <Text style={[styles.value, themedStyles.value]}>{FEEDBACK_EMAIL}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={openEmail}
          accessibilityRole="button"
          accessibilityLabel="Abrir app de e-mail"
        >
          <Text style={styles.primaryButtonText}>
            {attempted ? 'Tentar novamente' : 'Abrir e-mail'}
          </Text>
        </Pressable>
      </View>

      {/* Premium upsell for non-premium users */}
      {!isPremium && (
        <View style={[styles.card, styles.upsellCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="logo-whatsapp" size={24} color="#9CA3AF" />
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>WhatsApp</Text>
            <PremiumPill />
          </View>
          <Text style={[styles.cardDescription, { color: colors.textTertiary }]}>
            Assine o Premium para atendimento prioritário via WhatsApp.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#F7F7F7',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  whatsappCard: {
    borderWidth: 2,
    borderColor: '#25D366',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
  upsellCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
