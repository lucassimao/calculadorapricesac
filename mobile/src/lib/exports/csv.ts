import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, ScheduleRow, Scenario } from '../../types/loan';

interface CsvOptions {
  tableOnly?: boolean;
}

const buildCsv = (schedule: ScheduleRow[], scenario: Scenario, summary: LoanSummary, options?: CsvOptions) => {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const header = ['Parcela', 'Data', 'Parcela', 'Juros', 'Amortização', 'Saldo', 'Custos', 'FGTS', 'Líquido'];
  const lines = [
    header.join(','),
    ...rows.map((row) => [
      row.installmentNumber,
      row.date.toISOString().slice(0, 10),
      row.payment.toFixed(2).replace('.', ','),
      row.interest.toFixed(2).replace('.', ','),
      row.amortization.toFixed(2).replace('.', ','),
      row.balance.toFixed(2).replace('.', ','),
      (row.extraCosts ?? 0).toFixed(2).replace('.', ','),
      (row.fgtsSubsidy ?? 0).toFixed(2).replace('.', ','),
      (row.netPayment ?? row.payment).toFixed(2).replace('.', ','),
    ].join(',')),
  ];

  if (!options?.tableOnly) {
    lines.push('');
    lines.push(`Sistema,${scenario.system}`);
    lines.push(`Taxa,${scenario.rate}%`);
    lines.push(`Prazo,${scenario.term} ${scenario.termUnit}`);
    lines.push(`CET (a.a.),${summary.cetAnnualRate.toFixed(2).replace('.', ',')}%`);
    lines.push(`Custos Iniciais,${summary.totalUpfrontCosts.toFixed(2).replace('.', ',')}`);
    lines.push(`Custos Mensais,${summary.totalMonthlyCosts.toFixed(2).replace('.', ',')}`);
    lines.push(`Total com Custos,${summary.totalPaymentWithCosts.toFixed(2).replace('.', ',')}`);
    lines.push(`FGTS Usado,${summary.totalFgtsUsed.toFixed(2).replace('.', ',')}`);
    lines.push(`Total Pago Líquido,${summary.totalPaymentNet.toFixed(2).replace('.', ',')}`);
  }

  return lines.join('\n');
};

export async function exportCsv(schedule: ScheduleRow[], scenario: Scenario, summary: LoanSummary, options?: CsvOptions) {
  const csv = buildCsv(schedule, scenario, summary, options);
  const file = new File(Paths.cache, 'tabela_amortizacao.csv');
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar CSV' });
}
