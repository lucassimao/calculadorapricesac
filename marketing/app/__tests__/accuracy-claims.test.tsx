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
    expect(copy).toContain('taxas e bases de MIP/DFI na contratação');
    expect(copy).toContain('tarifa e os totais das três primeiras prestações');
    expect(copy).toContain('Isso não valida TR');
    expect(copy).toContain('TR, IPCA nem combinações específicas de apólice');
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

  it('explains why MIP, DFI, and the admin fee make the real installment higher', () => {
    const guide = guides.find((candidate) => candidate.slug === 'parcela-real-maior-mip-dfi-taxas');
    const copy = JSON.stringify(guide);

    expect(guide?.title).toContain('parcela real fica maior');
    expect(copy).toContain('MIP');
    expect(copy).toContain('saldo devedor');
    expect(copy).toContain('DFI');
    expect(copy).toContain('valor do imóvel');
    expect(copy).toContain('faixa etária');
    expect(copy).toContain('estimativa — confira sua apólice');
    expect(copy).toContain('Seguros: MIP + DFI');
    expect(copy).toContain('documento histórico mantém o MIP sobre o valor original');
    expect(copy).toContain('limite da cobertura MIP acompanha o saldo devedor');
    expect(copy).toContain('convenção de cálculo do app');
    expect(copy).toContain('CET publicado de 10,43% não é reproduzido');
    expect(guide?.screenshots).toEqual([
      {
        src: '/recursos/parcela-real-maior-mip-dfi-taxas/resumo.webp',
        alt: 'Resumo do app com seguros MIP e DFI separados e forma de cobrança.',
      },
    ]);
    expect(copy).toContain('https://www.gov.br/susep/');
    expect(copy).toContain('Baixar o app');
  });

  it('advertises split MIP/DFI costs on the landing and unlock pitch', () => {
    const { unmount } = render(<Home />);
    expect(screen.getByText(/MIP e DFI separados/i)).toBeInTheDocument();
    unmount();

    render(<UnlockCTA />);
    expect(screen.getByText(/seguros MIP e DFI por base real/i)).toBeInTheDocument();
  });

  it('explains how to decide between amortizing and investing with net returns', () => {
    const guide = guides.find(
      (candidate) => candidate.slug === 'amortizar-financiamento-ou-investir',
    );
    const copy = JSON.stringify(guide);

    expect(guide?.title).toBe('Amortizar o financiamento ou investir? Como decidir');
    expect(guide?.sections.map((section) => section.heading)).toEqual(
      expect.arrayContaining([
        'Vale mais a pena amortizar o financiamento ou investir?',
        'Como comparar CDI ou Tesouro Selic com os juros do financiamento',
        'Qual taxa faz o investimento ganhar da amortização?',
      ]),
    );
    expect(copy).toContain('100% do CDI');
    expect(copy).toContain('Tesouro Selic');
    expect(copy).toContain('IR regressivo');
    expect(copy).toContain('22,5%');
    expect(copy).toContain('15%');
    expect(copy).toContain('saldo bruto');
    expect(copy).toContain('saldo líquido');
    expect(copy).toContain('taxa de virada');
    expect(copy).toContain('reinveste cada economia mensal');
    expect(copy).toContain('retorno anual equivalente isento');
    expect(copy).toContain('horizonte');
    expect(copy).toContain('taxa constante');
    expect(copy).toContain('não é recomendação de investimento');
    expect(copy).toContain('https://arquivos.b3.com.br/');
    expect(copy).toContain('https://www.bcb.gov.br/controleinflacao/historicotaxasjuros');
    expect(copy).toContain('Baixar o app');
    expect(guide?.screenshots).toEqual([
      {
        src: '/recursos/amortizar-financiamento-ou-investir/resultado.webp',
        alt: 'Comparador do app mostrando amortização, investimento líquido e taxa de virada.',
      },
    ]);
  });

  it('advertises the amortize-or-invest comparator on acquisition surfaces', () => {
    const { unmount } = render(<Home />);
    expect(screen.getAllByText(/amortizar o financiamento ou investir/i)).not.toHaveLength(0);
    unmount();

    render(<UnlockCTA />);
    expect(screen.getByText(/comparador amortizar ou investir/i)).toBeInTheDocument();
  });

  it('explains goal-based prepayment optimization and advertises the Premium assistant', () => {
    const guide = guides.find(
      (candidate) => candidate.slug === 'melhor-estrategia-amortizar-financiamento',
    );
    const copy = JSON.stringify(guide);

    expect(guide?.title).toBe('Qual a melhor estratégia para amortizar o financiamento?');
    expect(guide?.sections.map((section) => section.heading)).toEqual(
      expect.arrayContaining([
        'Quero quitar até uma data',
        'Quero minimizar juros com meu orçamento',
        'Quero reduzir a parcela para um teto',
      ]),
    );
    expect(copy).toContain('reduzir prazo');
    expect(copy).toContain('reduzir parcela');
    expect(copy).toContain('quanto antes');
    expect(copy).toContain('juros extras');
    expect(copy).toContain('Baixar o app');

    const { unmount } = render(<Home />);
    expect(screen.getByText(/plano de amortização para sua meta/i)).toBeInTheDocument();
    unmount();

    render(<UnlockCTA />);
    expect(
      screen.getByText(/assistente que calcula seu melhor plano de amortização — Premium/i),
    ).toBeInTheDocument();
  });
});
