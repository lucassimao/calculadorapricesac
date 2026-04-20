import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, ScheduleRow, Scenario } from '../../types/loan';
import { formatDateBR } from '../utils';
import {
  buildFreeExportNoticeRows,
  FREE_EXPORT_ROW_LIMIT,
  getExportFilename,
  isFreeRewardedExport,
  type ExportOptions,
} from './access';
import { formatEffectiveInstallmentCount, formatExportTerm } from './formatters';

const CSV_SEPARATOR = ';';

function formatCsvNumber(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function escapeCsvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCsvLine(values: (string | number)[]) {
  return values.map(escapeCsvValue).join(CSV_SEPARATOR);
}

const buildCsv = (
  schedule: ScheduleRow[],
  scenario: Scenario,
  summary: LoanSummary,
  options?: ExportOptions,
) => {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const isFreeExport = isFreeRewardedExport(options);
  const visibleRows = isFreeExport ? rows.slice(0, FREE_EXPORT_ROW_LIMIT) : rows;
  const originalTerm = formatExportTerm(scenario.term, scenario.termUnit);
  const effectiveTerm = formatEffectiveInstallmentCount(rows.length);
  const header = [
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
  ];
  const lines = [
    buildCsvLine(header),
    ...visibleRows.map((row) =>
      buildCsvLine([
        row.installmentNumber,
        formatDateBR(row.date),
        formatCsvNumber(row.payment),
        formatCsvNumber(row.interest),
        formatCsvNumber(row.amortization),
        formatCsvNumber(row.balance),
        formatCsvNumber(row.extraCosts ?? 0),
        formatCsvNumber(row.prepaymentAmount ?? 0),
        formatCsvNumber(row.fgtsAmortization ?? 0),
        formatCsvNumber(row.fgtsSubsidy ?? 0),
        formatCsvNumber(row.netPayment ?? row.payment),
      ]),
    ),
  ];

  if (isFreeExport) {
    lines.push('');
    for (const row of buildFreeExportNoticeRows(rows.length, visibleRows.length)) {
      lines.push(buildCsvLine(row));
    }
  } else if (!options?.tableOnly) {
    lines.push('');
    lines.push(buildCsvLine(['Cenário', scenario.name]));
    lines.push(
      buildCsvLine(['Modalidade', scenario.loanMode === 'property' ? 'Imobiliário' : 'Padrão']),
    );
    lines.push(buildCsvLine(['Sistema', scenario.system]));
    lines.push(buildCsvLine(['Data de início', formatDateBR(scenario.startDate)]));
    lines.push(buildCsvLine(['Dia de vencimento', scenario.dueDay]));
    lines.push(buildCsvLine(['Principal financiado', formatCsvNumber(summary.financedPrincipal)]));
    if (scenario.loanMode === 'property') {
      lines.push(buildCsvLine(['Valor do imóvel', formatCsvNumber(scenario.propertyValue ?? 0)]));
      lines.push(buildCsvLine(['Entrada', formatCsvNumber(scenario.downPayment ?? 0)]));
    }
    lines.push(
      buildCsvLine([
        'Taxa',
        `${scenario.rate}% ${scenario.rateType === 'monthly' ? 'a.m.' : 'a.a.'}`,
      ]),
    );
    lines.push(buildCsvLine(['Prazo original', originalTerm]));
    lines.push(buildCsvLine(['Prazo efetivo', effectiveTerm]));
    lines.push(
      buildCsvLine(['CET (a.a.)', `${summary.cetAnnualRate.toFixed(2).replace('.', ',')}%`]),
    );
    lines.push(buildCsvLine(['Custos Iniciais', formatCsvNumber(summary.totalUpfrontCosts)]));
    lines.push(buildCsvLine(['Custos Mensais', formatCsvNumber(summary.totalMonthlyCosts)]));
    lines.push(buildCsvLine(['Total com Custos', formatCsvNumber(summary.totalPaymentWithCosts)]));
    lines.push(buildCsvLine(['FGTS Usado', formatCsvNumber(summary.totalFgtsUsed)]));
    lines.push(buildCsvLine(['Total Pago Líquido', formatCsvNumber(summary.totalPaymentNet)]));
  }

  return lines.join('\n');
};

export async function exportCsv(
  schedule: ScheduleRow[],
  scenario: Scenario,
  summary: LoanSummary,
  options?: ExportOptions,
) {
  const csv = buildCsv(schedule, scenario, summary, options);
  const file = new File(Paths.cache, getExportFilename('csv', options));
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar CSV' });
}
