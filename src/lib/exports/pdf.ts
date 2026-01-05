import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, Scenario, ScheduleRow } from '../../types/loan';
import { formatCurrency } from '../calculations';

const buildHtml = (scenario: Scenario, summary: LoanSummary, schedule: ScheduleRow[]) => {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  const tableRows = rows
    .map(
      (row) => `
      <tr>
        <td>${row.installmentNumber}</td>
        <td>${row.date.toISOString().slice(0, 10)}</td>
        <td>${formatCurrency(row.payment)}</td>
        <td>${formatCurrency(row.interest)}</td>
        <td>${formatCurrency(row.amortization)}</td>
        <td>${formatCurrency(row.balance)}</td>
      </tr>
    `
    )
    .join('');

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
          h1 { font-size: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #E5E7EB; padding: 6px; font-size: 11px; text-align: right; }
          th { background: #F3F4F6; }
          td:first-child, th:first-child { text-align: left; }
        </style>
      </head>
      <body>
        <h1>Relatório de Financiamento</h1>
        <p><strong>Sistema:</strong> ${scenario.system}</p>
        <p><strong>Valor:</strong> ${formatCurrency(scenario.principal)}</p>
        <p><strong>Taxa:</strong> ${scenario.rate}% ${scenario.rateType === 'monthly' ? 'a.m.' : 'a.a.'}</p>
        <p><strong>Prazo:</strong> ${scenario.term} ${scenario.termUnit}</p>
        <h2>Resumo</h2>
        <p>Total Pago: ${formatCurrency(summary.totalPayment)}</p>
        <p>Total Juros: ${formatCurrency(summary.totalInterest)}</p>
        <p>1ª Parcela: ${formatCurrency(summary.firstPayment)}</p>
        <p>Última Parcela: ${formatCurrency(summary.lastPayment)}</p>
        <h2>Tabela de Amortização</h2>
        <table>
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Data</th>
              <th>Parcela</th>
              <th>Juros</th>
              <th>Amortização</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
};

export async function exportPdf(scenario: Scenario, summary: LoanSummary, schedule: ScheduleRow[]) {
  const html = buildHtml(scenario, summary, schedule);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar PDF' });
}
