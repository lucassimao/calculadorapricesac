import type { Scenario } from '@loan-engine/loan';

export interface BankParityFixture {
  id: string;
  source: {
    bank: string;
    product: string;
    title: string;
    url: string;
    referenceDate: string;
    accessedAt: string;
    scope: string;
    methodology: string;
  };
  scenario: Scenario;
  expected: {
    firstPayment: number;
    lastPayment: number;
    cetAnnualPercent: number;
    paymentTolerance: number;
    cetTolerancePercentagePoints: number;
  };
}

const itauCgiSource = {
  bank: 'Itaú Unibanco',
  product: 'Crédito com Garantia de Imóvel',
  title: 'Guia do Crédito com Garantia de Imóvel Itaú',
  url: 'https://www.itau.com.br/media/dam/m/70df394983874cf4/original/CGI_LP_Guia.pdf',
  referenceDate: '2024-06',
  accessedAt: '2026-08-01',
  scope:
    'Quadro comparativo oficial de R$ 100.000 em 240 meses, sem detalhamento de seguros; valida amortização e CET apenas com custos agregados representáveis pelo modelo atual.',
  methodology:
    'A taxa nominal e as parcelas são entradas publicadas. A taxa implícita nas parcelas Price/primeira SAC é ~1,58858% a.m.; a diferença de até R$ 1,43 decorre do 1,59% arredondado no guia. Como o guia publica o CET sem abrir encargos ou datas, openingFee foi retrocalculado com o próprio solver e representa somente o custo inicial agregado implícito, não uma tarifa Itaú declarada. A data sintética cria um primeiro período de 30 dias; este fixture não valida o solver de forma independente nem arbitra mês cheio versus pro rata.',
} as const;

const baseScenario: Omit<Scenario, 'id' | 'name' | 'system'> = {
  loanMode: 'standard',
  principal: 100000,
  rate: 1.59,
  rateType: 'monthly',
  term: 240,
  termUnit: 'months',
  startDate: new Date(2024, 5, 1),
  dueDay: 1,
  prepayments: [],
};

export const bankParityFixtures: BankParityFixture[] = [
  {
    id: 'itau-cgi-price-2024-06',
    source: itauCgiSource,
    scenario: {
      ...baseScenario,
      id: 'itau-cgi-price-2024-06',
      name: 'Itaú CGI Price — junho/2024',
      system: 'PRICE',
      includeOpeningFee: true,
      openingFee: 3305.31,
    },
    expected: {
      firstPayment: 1625.58,
      lastPayment: 1625.58,
      cetAnnualPercent: 21.69,
      paymentTolerance: 1.5,
      cetTolerancePercentagePoints: 0.1,
    },
  },
  {
    id: 'itau-cgi-sac-2024-06',
    source: itauCgiSource,
    scenario: {
      ...baseScenario,
      id: 'itau-cgi-sac-2024-06',
      name: 'Itaú CGI SAC — junho/2024',
      system: 'SAC',
      includeOpeningFee: true,
      openingFee: 3230.25,
    },
    expected: {
      firstPayment: 2005.24,
      lastPayment: 423.28,
      cetAnnualPercent: 21.86,
      paymentTolerance: 1.5,
      cetTolerancePercentagePoints: 0.1,
    },
  },
];
