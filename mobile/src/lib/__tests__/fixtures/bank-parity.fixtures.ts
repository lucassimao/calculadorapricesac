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

export interface InsuranceBankParityFixture {
  id: string;
  source: BankParityFixture['source'];
  scenario: Scenario;
  expectedRows: {
    installmentNumber: number;
    totalCost: number;
    adminFee: number;
  }[];
  expectedOrigination: {
    mipInsurance: number;
    dfiInsurance: number;
  };
  publishedCetAnnualPercent: number;
  modeledCetAnnualPercent: number;
  paymentTolerance: number;
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

export const insuranceBankParityFixture: InsuranceBankParityFixture = {
  id: 'itau-habitacional-sac-mip-dfi-2008-03',
  source: {
    bank: 'Itaú Unibanco',
    product: 'Crédito Imobiliário',
    title: 'Entenda como são calculadas as suas prestações',
    url: 'https://ww3.itau.com.br/imobline/pre/pdf/calculoprestacao.pdf',
    referenceDate: '2008-03',
    accessedAt: '2026-08-03',
    scope:
      'Exemplo oficial SAC de R$ 80.000 em 300 meses para imóvel de R$ 100.000, comprador de 28 anos, com MIP, DFI, tarifa fixa e TR discriminados nas três primeiras prestações. Valida os seguros exatamente na contratação; não valida a base decrescente do MIP ao longo do contrato.',
    methodology:
      'A primeira prestação cobra MIP e DFI em dobro por incluir a assinatura; as seguintes cobram uma competência. O PDF histórico mantém MIP em 0,0202% do valor original, enquanto o motor usa saldo devedor: por isso, em uma execução auxiliar com o índice desativado, só a primeira competência valida exatamente a base MIP; as seguintes comprovam a queda esperada do motor, não paridade de componente. A tolerância de R$ 1,50 nos totais com TR ativa também cobre a diferença sistemática na ordem da correção e não valida correção monetária. O motor projeta a TR corrente nos 300 fluxos e calcula CET de 11,72% a.a.; não reproduz o CET publicado de 10,43% porque o documento não divulga datas, todos os fluxos nem as demais despesas usadas no CET. Este fixture valida apenas as três prestações e os componentes na contratação, sem alegar paridade de CET. Os valores foram associados pelas taxas publicadas (MIP: 0,0202% de R$ 80 mil; DFI: 0,01337% de R$ 100 mil), pois a extração textual da tabela pode inverter a ordem visual das duas colunas.',
  },
  scenario: {
    id: 'itau-habitacional-sac-mip-dfi-2008-03',
    name: 'Itaú SAC com MIP/DFI — março/2008',
    system: 'SAC',
    loanMode: 'property',
    principal: 80_000,
    propertyValue: 100_000,
    downPayment: 20_000,
    rate: 0.7207,
    rateType: 'monthly',
    term: 300,
    termUnit: 'months',
    startDate: new Date(2008, 2, 1),
    dueDay: 1,
    indexType: 'TR',
    indexRate: 0.1241,
    borrowerAge: 28,
    mipRate: 0.0202,
    dfiRate: 0.01337,
    adminFee: 25,
    insuranceChargeTiming: 'prepaid_at_signing',
  },
  expectedRows: [
    { installmentNumber: 1, totalCost: 927.29, adminFee: 25 },
    { installmentNumber: 2, totalCost: 897.23, adminFee: 25 },
    { installmentNumber: 3, totalCost: 896.69, adminFee: 25 },
  ],
  expectedOrigination: { mipInsurance: 32.32, dfiInsurance: 26.74 },
  publishedCetAnnualPercent: 10.43,
  modeledCetAnnualPercent: 11.72,
  paymentTolerance: 1.5,
};
