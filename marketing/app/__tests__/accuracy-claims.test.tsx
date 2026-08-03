import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../page';
import { UnlockCTA } from '../components/Simulator/UnlockCTA';
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

  it('describes usage-correct FGTS recurrence rules with a dated official source and app CTA', () => {
    const fgtsGuide = guides.find((guide) => guide.slug === 'fgts-no-financiamento');
    const copy = JSON.stringify(fgtsGuide);

    expect(fgtsGuide?.updated).toBe('2026-08-03');
    expect(copy).toContain('2 anos');
    expect(copy).toContain('12 prestações consecutivas');
    expect(copy).toContain('80%');
    expect(copy).toContain('uso único');
    expect(copy).toContain(
      'https://www.fgts.gov.br/Paginas/subpaginas/amortizacao_liquidacao.aspx',
    );
    expect(copy).toContain('Orientação consultada em 2 de agosto de 2026');
    expect(copy).toContain('Baixar o app');
  });

  it('explains recurring prepayments in the amortization guide and ends with an app CTA', () => {
    const amortizationGuide = guides.find((guide) => guide.slug === 'amortizar-prazo-ou-parcela');
    const copy = JSON.stringify(amortizationGuide);

    expect(amortizationGuide?.updated).toBe('2026-08-03');
    expect(copy).toContain('Amortizações recorrentes');
    expect(copy).toContain('mensal, anual ou a cada 2 anos');
    expect(copy).toContain('cada evento continua editável');
    expect(copy).toContain('Baixar o app');
  });

  it('advertises recurring prepayments in the simulator unlock pitch', () => {
    render(<UnlockCTA />);

    expect(screen.getByText(/amortizações recorrentes/i)).toBeInTheDocument();
    expect(screen.getByText(/FGTS com regras por tipo de uso/i)).toBeInTheDocument();
  });

  it('explains how to compare amortization and portability for an existing contract', () => {
    const guide = guides.find(
      (candidate) => candidate.slug === 'amortizar-ou-portar-financiamento-atual',
    );
    const copy = JSON.stringify(guide);

    expect(guide?.title).toBe('Vale a pena amortizar (ou portar) meu financiamento atual?');
    expect(copy).toContain('saldo devedor atual');
    expect(copy).toContain('custos da portabilidade');
    expect(copy).toContain('uma única vez');
    expect(copy).toContain('break-even');
    expect(copy).toContain('sem desconto a valor presente');
    expect(copy).toContain('Seguros e taxas no novo banco podem ser diferentes');
    expect(copy).toContain('Baixar o app');
  });

  it('advertises existing-contract amortization and portability on acquisition surfaces', () => {
    const { unmount } = render(<Home />);
    expect(
      screen.getByText(/já tem um financiamento\? simule amortização e portabilidade/i),
    ).toBeInTheDocument();
    unmount();

    render(<UnlockCTA />);
    expect(screen.getByText(/amortização e portabilidade do contrato atual/i)).toBeInTheDocument();
  });
});
