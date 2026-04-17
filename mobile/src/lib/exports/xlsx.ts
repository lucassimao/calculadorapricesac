import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { LoanSummary, ScheduleRow, Scenario } from '../../types/loan';
import { formatDateBR } from '../utils';
import { formatExportTerm } from './formatters';

interface XlsxOptions {
  tableOnly?: boolean;
}

export async function exportXlsx(
  schedule: ScheduleRow[],
  scenario: Scenario,
  summary: LoanSummary,
  options?: XlsxOptions,
) {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const data: (string | number)[][] = [
    [
      'N°',
      'Data',
      'Valor Parcela',
      'Juros',
      'Amortização',
      'Saldo',
      'Custos',
      'Extra',
      'FGTS Amortização',
      'FGTS Parcela',
      'Líquido',
    ],
    ...rows.map((row) => [
      row.installmentNumber,
      formatDateBR(row.date),
      row.payment,
      row.interest,
      row.amortization,
      row.balance,
      row.extraCosts ?? 0,
      row.prepaymentAmount ?? 0,
      row.fgtsAmortization ?? 0,
      row.fgtsSubsidy ?? 0,
      row.netPayment ?? row.payment,
    ]),
  ];

  if (!options?.tableOnly) {
    data.push(
      [],
      ['Cenário', scenario.name],
      ['Modalidade', scenario.loanMode === 'property' ? 'Imobiliário' : 'Padrão'],
      ['Sistema', scenario.system],
      ['Data de início', formatDateBR(scenario.startDate)],
      ['Dia de vencimento', scenario.dueDay],
      ['Principal financiado', summary.financedPrincipal],
      ...(scenario.loanMode === 'property'
        ? ([
            ['Valor do imóvel', scenario.propertyValue ?? 0],
            ['Entrada', scenario.downPayment ?? 0],
          ] as (string | number)[][])
        : []),
      ['Taxa', `${scenario.rate}% ${scenario.rateType === 'monthly' ? 'a.m.' : 'a.a.'}`],
      ['Prazo', formatExportTerm(scenario.term, scenario.termUnit)],
      ['CET (a.a.)', `${summary.cetAnnualRate.toFixed(2)}%`],
      ['Custos Iniciais', summary.totalUpfrontCosts],
      ['Custos Mensais', summary.totalMonthlyCosts],
      ['Total com Custos', summary.totalPaymentWithCosts],
      ['FGTS Usado', summary.totalFgtsUsed],
      ['Total Pago Líquido', summary.totalPaymentNet],
    );
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Amortizacao');

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const bytes = new Uint8Array(buffer);
  const file = new File(Paths.cache, 'tabela_amortizacao.xlsx');
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar XLSX',
  });
}
