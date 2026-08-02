import { describe, expect, it } from 'vitest';
import {
  PREMIUM_BENEFITS,
  PREMIUM_ONE_TIME_MESSAGE,
  getPremiumSocialProof,
} from '../premium-offer';

describe('premium offer content', () => {
  it('keeps the paywall benefits and one-time framing aligned with the product contract', () => {
    expect({
      benefits: PREMIUM_BENEFITS.map(({ title, description }) => ({ title, description })),
      framing: PREMIUM_ONE_TIME_MESSAGE,
    }).toMatchInlineSnapshot(`
      {
        "benefits": [
          {
            "description": "Use a calculadora sem banners ou interrupções publicitárias.",
            "title": "Sem anúncios",
          },
          {
            "description": "Gere PDF, XLSX e CSV completos, sem limites e sem marca d’água.",
            "title": "Exportações ilimitadas",
          },
          {
            "description": "Apresente simulações com sua marca, contatos e identidade visual.",
            "title": "PDF profissional com sua marca",
          },
          {
            "description": "Salve e compare quantas simulações precisar.",
            "title": "Cenários ilimitados",
          },
        ],
        "framing": "Pague uma vez, use para sempre — sem assinatura.",
      }
    `);
  });

  it('keeps social proof hidden while the rating count is still too small', () => {
    expect(getPremiumSocialProof({ average: 5, count: 2 })).toBeNull();
  });

  it('rejects a low or empty-environment rating as social proof', () => {
    expect(getPremiumSocialProof({ average: Number(''), count: 12 })).toBeNull();
    expect(getPremiumSocialProof({ average: 3.9, count: 12 })).toBeNull();
  });

  it('activates honest social proof once enough ratings exist', () => {
    expect(getPremiumSocialProof({ average: 4.8, count: 12 })).toEqual({
      accessibilityLabel: 'Nota 4,8 de 5 na App Store, com 12 avaliações',
      label: '4,8 ★ na App Store · 12 avaliações',
    });
  });
});
