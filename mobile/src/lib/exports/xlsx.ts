import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { LoanSummary, ScheduleRow, Scenario } from '../../types/loan';

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
    ['Parcela', 'Data', 'Parcela', 'Juros', 'Amortização', 'Saldo', 'Custos', 'FGTS', 'Líquido'],
    ...rows.map((row) => [
      row.installmentNumber,
      row.date.toISOString().slice(0, 10),
      row.payment,
      row.interest,
      row.amortization,
      row.balance,
      row.extraCosts ?? 0,
      row.fgtsSubsidy ?? 0,
      row.netPayment ?? row.payment,
    ]),
  ];

  if (!options?.tableOnly) {
    data.push(
      [],
      ['Sistema', scenario.system],
      ['Taxa', `${scenario.rate}%`],
      ['Prazo', `${scenario.term} ${scenario.termUnit}`],
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
  const file = new File(Paths.cache, 'tabela_amortizacao.xlsx');
  file.create({ overwrite: true });
  file.write(new Uint8Array(buffer));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar XLSX',
  });
}
