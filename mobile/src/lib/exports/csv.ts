import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, ScheduleRow, Scenario } from '@loan-engine/loan';
import { formatCetResult } from '@loan-engine/calculations';
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
  formatInsuranceChargeTiming,
} from './formatters';

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
  const hasCorrection = Boolean(scenario.indexType);
  const hasTotalIndexCorrection = summary.totalIndexCorrection !== 0;
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
    ...(hasCorrection ? ['Correção'] : []),
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
        ...(hasCorrection ? [formatCsvNumber(row.indexCorrection ?? 0)] : []),
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
    if (scenario.entryMode === 'existing_contract') {
      lines.push(buildCsvLine(['Tipo de simulação', 'Contrato existente']));
      lines.push(buildCsvLine(['Saldo devedor informado', formatCsvNumber(scenario.principal)]));
      if (scenario.nextDueDate) {
        lines.push(buildCsvLine(['Próxima parcela', formatDateBR(scenario.nextDueDate)]));
      }
    }
    lines.push(
      buildCsvLine(['Modalidade', scenario.loanMode === 'property' ? 'Imobiliário' : 'Padrão']),
    );
    lines.push(buildCsvLine(['Sistema', scenario.system]));
    if (scenario.entryMode === 'existing_contract') {
      lines.push(buildCsvLine(['Data do saldo informado', formatDateBR(scenario.startDate)]));
    } else {
      lines.push(buildCsvLine(['Data de início', formatDateBR(scenario.startDate)]));
      lines.push(buildCsvLine(['Dia de vencimento', scenario.dueDay]));
      lines.push(
        buildCsvLine(['Principal financiado', formatCsvNumber(summary.financedPrincipal)]),
      );
    }
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
    lines.push(
      buildCsvLine([
        scenario.entryMode === 'existing_contract' ? 'Parcelas restantes' : 'Prazo original',
        originalTerm,
      ]),
    );
    lines.push(buildCsvLine(['Prazo efetivo', effectiveTerm]));
    if (hasCorrection) {
      lines.push(buildCsvLine(['Índice de Correção', scenario.indexType ?? '']));
      lines.push(buildCsvLine(['Taxa de Correção', formatCorrectionRate(scenario.indexRate)]));
      if (hasTotalIndexCorrection) {
        lines.push(buildCsvLine(['Correção Total', formatCsvNumber(summary.totalIndexCorrection)]));
      }
    }
    lines.push(
      scenario.entryMode === 'existing_contract'
        ? buildCsvLine(['CET', 'Não se aplica ao saldo atual'])
        : buildCsvLine(['CET (a.a.)', formatCetResult(summary.cet)]),
    );
    lines.push(buildCsvLine(['Custos Iniciais', formatCsvNumber(summary.totalUpfrontCosts)]));
    lines.push(buildCsvLine(['Custos Mensais', formatCsvNumber(summary.totalMonthlyCosts)]));
    const totalInsurance = (summary.totalMipInsurance ?? 0) + (summary.totalDfiInsurance ?? 0);
    if (totalInsurance > 0) {
      lines.push(
        buildCsvLine([
          'Seguros: MIP + DFI (incluídos nos custos mensais)',
          formatCsvNumber(totalInsurance),
        ]),
      );
      if ((summary.totalMipInsurance ?? 0) > 0) {
        lines.push(
          buildCsvLine(['MIP (saldo devedor)', formatCsvNumber(summary.totalMipInsurance ?? 0)]),
        );
      }
      if ((summary.totalDfiInsurance ?? 0) > 0) {
        lines.push(
          buildCsvLine(['DFI (valor do imóvel)', formatCsvNumber(summary.totalDfiInsurance ?? 0)]),
        );
      }
      lines.push(
        buildCsvLine([
          'Cobrança dos seguros',
          formatInsuranceChargeTiming(scenario.insuranceChargeTiming),
        ]),
      );
    }
    if ((summary.totalAdminFees ?? 0) > 0) {
      lines.push(
        buildCsvLine([
          'Tarifa administrativa (incluída nos custos mensais)',
          formatCsvNumber(summary.totalAdminFees ?? 0),
        ]),
      );
    }
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
