import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PREMIUM_BENEFITS,
  PREMIUM_ONE_TIME_MESSAGE,
  type PremiumSocialProof,
} from '../../lib/premium-offer';

interface PremiumOfferCardProps extends PropsWithChildren {
  priceLabel: string | null;
  socialProof: PremiumSocialProof | null;
}

export function PremiumOfferCard({ children, priceLabel, socialProof }: PremiumOfferCardProps) {
  return (
    <View style={styles.card} testID="premium-offer-card">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PREMIUM</Text>
        <Text style={styles.title}>Simule e compartilhe sem limites</Text>
        <Text style={styles.subtitle}>
          Todas as ferramentas para analisar financiamentos com clareza e apresentar um resultado
          profissional.
        </Text>
      </View>

      <View style={styles.priceBlock}>
        <Text style={styles.priceLabel}>PAGAMENTO ÚNICO</Text>
        {priceLabel ? (
          <Text style={styles.price} testID="premium-price-label">
            {priceLabel}
          </Text>
        ) : (
          <Text style={styles.helper}>Preço indisponível no momento.</Text>
        )}
        <Text style={styles.oneTimeMessage} testID="premium-one-time-message">
          {PREMIUM_ONE_TIME_MESSAGE}
        </Text>
      </View>

      {socialProof ? (
        <View
          style={styles.socialProof}
          testID="premium-social-proof"
          accessible
          accessibilityLabel={socialProof.accessibilityLabel}
        >
          <Ionicons name="star" size={16} color="#B45309" />
          <Text style={styles.socialProofText}>{socialProof.label}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />
      <View style={styles.benefits}>
        {PREMIUM_BENEFITS.map((benefit) => (
          <View key={benefit.title} style={styles.benefit}>
            <View style={[styles.icon, { backgroundColor: benefit.color + '15' }]}>
              <Ionicons name={benefit.icon} size={20} color={benefit.color} />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitDescription}>{benefit.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 18,
    marginBottom: 16,
    gap: 18,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  subtitle: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  priceBlock: {
    gap: 4,
  },
  priceLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  price: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  helper: {
    color: '#64748B',
    fontSize: 13,
  },
  oneTimeMessage: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  socialProof: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
  },
  socialProofText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  benefits: {
    gap: 16,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  benefitDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
});
