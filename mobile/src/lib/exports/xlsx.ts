import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { LoanSummary, ScheduleRow, Scenario } from '@loan-engine/loan';
import { formatDateBR } from '../utils';
import {
  buildFreeExportNoticeRows,
  FREE_EXPORT_ROW_LIMIT,
  getExportFilename,
  isFreeRewardedExport,
  type ExportOptions,
} from './access';
import {
  formatCorrectionRate,
  formatEffectiveInstallmentCount,
  formatExportTerm,
} from './formatters';

const CURRENCY_FORMAT = '"R$" #,##0.00';
const BASE_TABLE_CURRENCY_COLUMN_INDEXES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SUMMARY_CURRENCY_LABELS = new Set([
  'Principal financiado',
  'Valor do imóvel',
  'Entrada',
  'Custos Iniciais',
  'Custos Mensais',
  'Total com Custos',
  'FGTS Usado',
  'Total Pago Líquido',
  'Correção Total',
]);

function applyCurrencyFormatToCell(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number) {
  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = sheet[cellRef];

  if (!cell || typeof cell.v !== 'number') return;
  cell.z = CURRENCY_FORMAT;
}

export async function exportXlsx(
  schedule: ScheduleRow[],
  scenario: Scenario,
  summary: LoanSummary,
  options?: ExportOptions,
) {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const isFreeExport = isFreeRewardedExport(options);
  const visibleRows = isFreeExport ? rows.slice(0, FREE_EXPORT_ROW_LIMIT) : rows;
  const originalTerm = formatExportTerm(scenario.term, scenario.termUnit);
  const effectiveTerm = formatEffectiveInstallmentCount(rows.length);
  const hasCorrection = Boolean(scenario.indexType);
  const hasTotalIndexCorrection = summary.totalIndexCorrection !== 0;
  const tableCurrencyColumnIndexes = hasCorrection
    ? [...BASE_TABLE_CURRENCY_COLUMN_INDEXES, 11]
    : BASE_TABLE_CURRENCY_COLUMN_INDEXES;
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
      ...(hasCorrection ? ['Correção'] : []),
    ],
    ...visibleRows.map((row) => [
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
      ...(hasCorrection ? [row.indexCorrection ?? 0] : []),
    ]),
  ];

  if (isFreeExport) {
    data.push([], ...buildFreeExportNoticeRows(rows.length, visibleRows.length));
  } else if (!options?.tableOnly) {
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
      ['Prazo original', originalTerm],
      ['Prazo efetivo', effectiveTerm],
      ...(hasCorrection
        ? ([
            ['Índice de Correção', scenario.indexType ?? ''],
            ['Taxa de Correção', formatCorrectionRate(scenario.indexRate)],
            ...(hasTotalIndexCorrection
              ? ([['Correção Total', summary.totalIndexCorrection]] as (string | number)[][])
              : []),
          ] as (string | number)[][])
        : []),
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

  for (let rowIndex = 1; rowIndex <= visibleRows.length; rowIndex += 1) {
    for (const columnIndex of tableCurrencyColumnIndexes) {
      applyCurrencyFormatToCell(sheet, rowIndex, columnIndex);
    }
  }

  if (!isFreeExport && !options?.tableOnly) {
    for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
      const label = data[rowIndex]?.[0];
      if (!SUMMARY_CURRENCY_LABELS.has(String(label))) continue;
      applyCurrencyFormatToCell(sheet, rowIndex, 1);
    }
  }

  sheet['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    ...(hasCorrection ? [{ wch: 14 }] : []),
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Amortizacao');

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const bytes = new Uint8Array(buffer);
  const file = new File(Paths.cache, getExportFilename('xlsx', options));
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar XLSX',
  });
}
