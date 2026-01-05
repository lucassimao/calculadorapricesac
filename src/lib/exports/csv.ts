import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ScheduleRow, Scenario } from '../../types/loan';

const buildCsv = (schedule: ScheduleRow[], scenario: Scenario) => {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const header = ['Parcela', 'Data', 'Parcela', 'Juros', 'Amortização', 'Saldo'];
  const lines = [
    header.join(','),
    ...rows.map((row) => [
      row.installmentNumber,
      row.date.toISOString().slice(0, 10),
      row.payment.toFixed(2).replace('.', ','),
      row.interest.toFixed(2).replace('.', ','),
      row.amortization.toFixed(2).replace('.', ','),
      row.balance.toFixed(2).replace('.', ','),
    ].join(',')),
  ];

  lines.push('');
  lines.push(`Sistema,${scenario.system}`);
  lines.push(`Taxa,${scenario.rate}%`);
  lines.push(`Prazo,${scenario.term} ${scenario.termUnit}`);

  return lines.join('\n');
};

export async function exportCsv(schedule: ScheduleRow[], scenario: Scenario) {
  const csv = buildCsv(schedule, scenario);
  const file = new File(Paths.cache, 'tabela_amortizacao.csv');
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar CSV' });
}
