export const PREMIUM_ONE_TIME_MESSAGE = 'Pague uma vez, use para sempre — sem assinatura.';

export const PREMIUM_BENEFITS = [
  {
    icon: 'ban-outline',
    title: 'Sem anúncios',
    description: 'Use a calculadora sem banners ou interrupções publicitárias.',
    color: '#DC2626',
  },
  {
    icon: 'share-outline',
    title: 'Exportações ilimitadas',
    description: 'Gere PDF, XLSX e CSV completos, sem limites e sem marca d’água.',
    color: '#2563EB',
  },
  {
    icon: 'briefcase-outline',
    title: 'PDF profissional com sua marca',
    description: 'Apresente simulações com sua marca, contatos e identidade visual.',
    color: '#7C3AED',
  },
  {
    icon: 'infinite-outline',
    title: 'Cenários ilimitados',
    description: 'Salve e compare quantas simulações precisar.',
    color: '#0891B2',
  },
] as const;

const SOCIAL_PROOF_MIN_RATING_COUNT = 10;

interface PremiumSocialProofInput {
  average: number;
  count: number;
}

export interface PremiumSocialProof {
  accessibilityLabel: string;
  label: string;
}

export function getPremiumSocialProof({
  average,
  count,
}: PremiumSocialProofInput): PremiumSocialProof | null {
  if (
    !Number.isFinite(average) ||
    !Number.isInteger(count) ||
    average < 4 ||
    average > 5 ||
    count < SOCIAL_PROOF_MIN_RATING_COUNT
  ) {
    return null;
  }

  const localizedAverage = average.toFixed(1).replace('.', ',');
  return {
    accessibilityLabel: `Nota ${localizedAverage} de 5 na App Store, com ${count} avaliações`,
    label: `${localizedAverage} ★ na App Store · ${count} avaliações`,
  };
}
