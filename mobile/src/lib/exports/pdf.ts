import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, Scenario, ScheduleRow } from '../../types/loan';
import { formatCurrency } from '../calculations';
import { formatDateBR } from '../utils';
import { formatExportTerm } from './formatters';

interface PdfOptions {
  tableOnly?: boolean;
}

const PDF_READY_TIMEOUT_MS = 5000;
const PDF_READY_POLL_MS = 100;

function decodeBase64(base64: string) {
  const fromBase64 = (
    Uint8Array as typeof Uint8Array & {
      fromBase64?: (value: string) => Uint8Array;
    }
  ).fromBase64;

  if (typeof fromBase64 === 'function') {
    return fromBase64(base64);
  }

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  throw new Error('Base64 decoding is not available.');
}

async function waitForPdfFile(uri: string) {
  const deadline = Date.now() + PDF_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const file = new File(uri);
    if (file.exists && typeof file.size === 'number' && file.size > 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, PDF_READY_POLL_MS));
  }

  throw new Error('Generated PDF file is empty.');
}

const buildHtml = (
  scenario: Scenario,
  summary: LoanSummary,
  schedule: ScheduleRow[],
  options?: PdfOptions,
) => {
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
        <td>${formatCurrency(row.prepaymentAmount ?? 0)}</td>
        <td>${formatCurrency(row.fgtsAmortization ?? 0)}</td>
        <td>${formatCurrency(row.fgtsSubsidy ?? 0)}</td>
        <td>${formatCurrency(row.netPayment ?? row.payment)}</td>
      </tr>
    `,
    )
    .join('');

  const summarySection = options?.tableOnly
    ? ''
    : `
        <p><strong>Cenário:</strong> ${scenario.name}</p>
        <p><strong>Modalidade:</strong> ${scenario.loanMode === 'property' ? 'Imobiliário' : 'Padrão'}</p>
        <p><strong>Sistema:</strong> ${scenario.system}</p>
        <p><strong>Data de início:</strong> ${formatDateBR(scenario.startDate)}</p>
        <p><strong>Dia de vencimento:</strong> ${scenario.dueDay}</p>
        <p><strong>Principal financiado:</strong> ${formatCurrency(summary.financedPrincipal)}</p>
        ${
          scenario.loanMode === 'property'
            ? `<p><strong>Valor do imóvel:</strong> ${formatCurrency(scenario.propertyValue ?? 0)}</p>
        <p><strong>Entrada:</strong> ${formatCurrency(scenario.downPayment ?? 0)}</p>`
            : ''
        }
        <p><strong>Taxa:</strong> ${scenario.rate}% ${scenario.rateType === 'monthly' ? 'a.m.' : 'a.a.'}</p>
        <p><strong>Prazo:</strong> ${formatExportTerm(scenario.term, scenario.termUnit)}</p>
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
              <th>N°</th>
              <th>Data</th>
              <th>Valor Parcela</th>
              <th>Juros</th>
              <th>Amortização</th>
              <th>Saldo</th>
              <th>Custos</th>
              <th>Extra</th>
              <th>FGTS Amort.</th>
              <th>FGTS Parcela</th>
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

export async function exportPdf(
  scenario: Scenario,
  summary: LoanSummary,
  schedule: ScheduleRow[],
  options?: PdfOptions,
) {
  const html = buildHtml(scenario, summary, schedule, options);
  const { base64 } = await Print.printToFileAsync({ html, base64: true });

  if (!base64) {
    throw new Error('Generated PDF payload is missing.');
  }

  const sharedFile = new File(Paths.cache, 'tabela_amortizacao.pdf');
  if (sharedFile.exists) {
    sharedFile.delete();
  }
  sharedFile.create({ overwrite: true });
  sharedFile.write(decodeBase64(base64));

  await waitForPdfFile(sharedFile.uri);
  await Sharing.shareAsync(sharedFile.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Exportar PDF',
  });
}
