import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, Scenario, ScheduleRow } from '../../types/loan';
import { formatCurrency } from '../calculations';

interface PdfOptions {
  tableOnly?: boolean;
}

const buildHtml = (scenario: Scenario, summary: LoanSummary, schedule: ScheduleRow[], options?: PdfOptions) => {
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
        <td>${formatCurrency(row.extraCosts ?? 0)}</td>
        <td>${formatCurrency(row.fgtsSubsidy ?? 0)}</td>
        <td>${formatCurrency(row.netPayment ?? row.payment)}</td>
      </tr>
    `
    )
    .join('');

  const summarySection = options?.tableOnly ? '' : `
        <p><strong>Sistema:</strong> ${scenario.system}</p>
        <p><strong>Valor:</strong> ${formatCurrency(scenario.principal)}</p>
        <p><strong>Taxa:</strong> ${scenario.rate}% ${scenario.rateType === 'monthly' ? 'a.m.' : 'a.a.'}</p>
        <p><strong>Prazo:</strong> ${scenario.term} ${scenario.termUnit}</p>
        <h2>Resumo</h2>
        <p>Total Pago: ${formatCurrency(summary.totalPayment)}</p>
        <p>Total Juros: ${formatCurrency(summary.totalInterest)}</p>
        <p>Custos Iniciais: ${formatCurrency(summary.totalUpfrontCosts)}</p>
        <p>Custos Mensais: ${formatCurrency(summary.totalMonthlyCosts)}</p>
        <p>Total com Custos: ${formatCurrency(summary.totalPaymentWithCosts)}</p>
        <p>CET (a.a.): ${summary.cetAnnualRate.toFixed(2).replace('.', ',')}%</p>
        <p>FGTS Usado: ${formatCurrency(summary.totalFgtsUsed)}</p>
        <p>Total Pago Líquido: ${formatCurrency(summary.totalPaymentNet)}</p>
        <p>1ª Parcela: ${formatCurrency(summary.firstPayment)}</p>
        <p>Última Parcela: ${formatCurrency(summary.lastPayment)}</p>
        <h2>Tabela de Amortização</h2>`;

  const title = options?.tableOnly ? 'Tabela de Amortização' : 'Relatório de Financiamento';

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
        <h1>${title}</h1>
        ${summarySection}
        <table>
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Data</th>
              <th>Parcela</th>
              <th>Juros</th>
              <th>Amortização</th>
              <th>Saldo</th>
              <th>Custos</th>
              <th>FGTS</th>
              <th>Líquido</th>
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

export async function exportPdf(scenario: Scenario, summary: LoanSummary, schedule: ScheduleRow[], options?: PdfOptions) {
  const html = buildHtml(scenario, summary, schedule, options);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar PDF' });
}
