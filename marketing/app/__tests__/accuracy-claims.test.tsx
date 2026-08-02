import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../page';
import { guides } from '../guias/content';

describe('constrained accuracy claims', () => {
  it('scopes the landing claim to the validated scenario class', () => {
    render(<Home />);

    expect(screen.getByText('Valores conferidos')).toBeInTheDocument();
    expect(
      screen.getByText(
        'SAC e Price conferidos com simulação bancária publicada para crédito prefixado sem seguros individualizados.',
      ),
    ).toBeInTheDocument();
  });

  it('documents source, tolerances, inferred costs, and exclusions in the CET guide', () => {
    const cetGuide = guides.find((guide) => guide.slug === 'o-que-e-cet');
    const methodology = cetGuide?.sections.find(
      (section) => section.heading === 'Como validamos os cálculos',
    );
    const copy = JSON.stringify(methodology);

    expect(copy).toContain('Guia do Crédito com Garantia de Imóvel Itaú');
    expect(copy).toContain('junho de 2024');
    expect(copy).toContain('R$ 100.000 em 240 meses');
    expect(copy).toContain('R$ 1,50');
    expect(copy).toContain('0,10 ponto percentual');
    expect(copy).toContain('custo inicial agregado implícito');
    expect(copy).toContain('nem arbitra a convenção de juros do primeiro período');
    expect(copy).toContain('não cobre TR, IPCA, MIP ou DFI');
  });
});
