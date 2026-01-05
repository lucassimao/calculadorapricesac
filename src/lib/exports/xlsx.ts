import * as FileSystem from 'expo-file-system/legacy';
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

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}tabela_amortizacao.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar XLSX',
  });
}
