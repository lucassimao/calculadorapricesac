import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { ScheduleRow, Scenario } from '../../types/loan';

export async function exportXlsx(schedule: ScheduleRow[], scenario: Scenario) {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const data = [
    ['Parcela', 'Data', 'Parcela', 'Juros', 'Amortização', 'Saldo'],
    ...rows.map((row) => [
      row.installmentNumber,
      row.date.toISOString().slice(0, 10),
      row.payment,
      row.interest,
      row.amortization,
      row.balance,
    ]),
  ];

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
