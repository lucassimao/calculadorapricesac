import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { LoanSummary, Scenario, ScheduleRow } from '../../types/loan';
import { formatCurrency } from '../calculations';
import { formatDateBR } from '../utils';
import {
  FREE_EXPORT_NOTICE_BODY,
  FREE_EXPORT_NOTICE_TITLE,
  FREE_EXPORT_NOTICE_UPGRADE,
  getExportFilename,
  getFreePdfVisibleRowLimit,
  isFreeRewardedExport,
  type ExportOptions,
} from './access';
import {
  formatCorrectionRate,
  formatEffectiveInstallmentCount,
  formatExportTerm,
} from './formatters';

const PDF_READY_TIMEOUT_MS = 5000;
const PDF_READY_POLL_MS = 100;
const A4_LANDSCAPE_WIDTH_PT = 842;
const A4_LANDSCAPE_HEIGHT_PT = 595;

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

function buildTableRows(rows: ScheduleRow[], hasCorrection: boolean) {
  return rows
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
        ${hasCorrection ? `<td>${formatCurrency(row.indexCorrection ?? 0)}</td>` : ''}
      </tr>
    `,
    )
    .join('');
}

function buildTableHead(hasCorrection: boolean) {
  return `
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
        ${hasCorrection ? '<th>Correção</th>' : ''}
      </tr>
    </thead>
  `;
}

function buildPremiumHtml(
  scenario: Scenario,
  summary: LoanSummary,
  rows: ScheduleRow[],
  options?: ExportOptions,
) {
  const hasCorrection = Boolean(scenario.indexType);
  const tableRows = buildTableRows(rows, hasCorrection);
  const originalTerm = formatExportTerm(scenario.term, scenario.termUnit);
  const effectiveTerm = formatEffectiveInstallmentCount(rows.length);
  const hasTotalIndexCorrection = summary.totalIndexCorrection !== 0;

  const overviewSection = options?.tableOnly
    ? ''
    : `
      <section class="overviewGrid">
        <div class="overviewCard">
          <h2>Dados do Cenário</h2>
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
          <p><strong>Prazo original:</strong> ${originalTerm}</p>
          <p><strong>Prazo efetivo:</strong> ${effectiveTerm}</p>
          ${
            hasCorrection
              ? `<p><strong>Índice de Correção:</strong> ${scenario.indexType}</p>
          <p><strong>Taxa de Correção:</strong> ${formatCorrectionRate(scenario.indexRate)}</p>
          ${
            hasTotalIndexCorrection
              ? `<p><strong>Correção Total:</strong> ${formatCurrency(summary.totalIndexCorrection)}</p>`
              : ''
          }`
              : ''
          }
        </div>
        <div class="overviewCard">
          <h2>Resumo</h2>
          <p><strong>Total Pago:</strong> ${formatCurrency(summary.totalPayment)}</p>
          <p><strong>Total Juros:</strong> ${formatCurrency(summary.totalInterest)}</p>
          <p><strong>Custos Iniciais:</strong> ${formatCurrency(summary.totalUpfrontCosts)}</p>
          <p><strong>Custos Mensais:</strong> ${formatCurrency(summary.totalMonthlyCosts)}</p>
          <p><strong>Total com Custos:</strong> ${formatCurrency(summary.totalPaymentWithCosts)}</p>
          <p><strong>CET (a.a.):</strong> ${summary.cetAnnualRate.toFixed(2).replace('.', ',')}%</p>
          <p><strong>FGTS Usado:</strong> ${formatCurrency(summary.totalFgtsUsed)}</p>
          <p><strong>Total Pago Líquido:</strong> ${formatCurrency(summary.totalPaymentNet)}</p>
          <p><strong>1ª Parcela:</strong> ${formatCurrency(summary.firstPayment)}</p>
          <p><strong>Última Parcela:</strong> ${formatCurrency(summary.lastPayment)}</p>
        </div>
      </section>
      <h2 class="tableTitle">Tabela de Amortização</h2>`;

  const title = options?.tableOnly ? 'Tabela de Amortização' : 'Relatório de Financiamento';

  return `
    <html>
      <head>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          html, body { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 14px; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          h1 { font-size: 20px; margin: 0 0 12px; }
          h2 { font-size: 16px; margin: 0 0 8px; }
          .overviewGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
          .overviewCard { border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px 12px; break-inside: avoid; }
          .overviewCard p { margin: 0 0 6px; font-size: 12px; line-height: 1.3; }
          .tableTitle { margin-bottom: 10px; break-after: avoid; page-break-after: avoid; }
          .tableWrap { break-inside: auto; page-break-inside: auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 0; page-break-inside: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tbody { page-break-inside: auto; }
          tr { break-inside: avoid; page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #E5E7EB; padding: 6px; font-size: 11px; text-align: right; }
          th { background: #F3F4F6; }
          td:first-child, th:first-child { text-align: left; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${overviewSection}
        <div class="tableWrap">
          <table>
            ${buildTableHead(hasCorrection)}
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

function buildFreeRewardedHtml(
  scenario: Scenario,
  summary: LoanSummary,
  rows: ScheduleRow[],
  options?: ExportOptions,
) {
  const title = options?.tableOnly ? 'Tabela de Amortização' : 'Relatório de Financiamento';
  const visibleLimit = getFreePdfVisibleRowLimit(Boolean(options?.tableOnly));
  const visibleRows = rows.slice(0, visibleLimit);
  const originalTerm = formatExportTerm(scenario.term, scenario.termUnit);
  const effectiveTerm = formatEffectiveInstallmentCount(rows.length);
  const hasCorrection = Boolean(scenario.indexType);

  const summarySection = options?.tableOnly
    ? ''
    : `
      <div class="summaryInline">
        <span><strong>Cenário:</strong> ${scenario.name}</span>
        <span><strong>Modalidade:</strong> ${scenario.loanMode === 'property' ? 'Imobiliário' : 'Padrão'}</span>
        <span><strong>Sistema:</strong> ${scenario.system}</span>
        <span><strong>Principal:</strong> ${formatCurrency(summary.financedPrincipal)}</span>
        <span><strong>Taxa:</strong> ${scenario.rate}% ${scenario.rateType === 'monthly' ? 'a.m.' : 'a.a.'}</span>
        <span><strong>Prazo original:</strong> ${originalTerm}</span>
        <span><strong>Prazo efetivo:</strong> ${effectiveTerm}</span>
        ${
          hasCorrection
            ? `<span><strong>Correção:</strong> ${scenario.indexType} ${formatCorrectionRate(scenario.indexRate)}</span>`
            : ''
        }
      </div>
    `;

  const limitedNotice =
    rows.length > visibleRows.length
      ? `<p class="limitNotice">Mostrando ${visibleRows.length} de ${rows.length} parcelas nesta versão gratuita.</p>`
      : '';

  return `
    <html>
      <head>
        <style>
          @page { size: A4 landscape; margin: 4mm; }
          html, body { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { position: relative; padding: 2px; }
          .pageHeader { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
          h1 { font-size: 11px; margin: 0 0 2px; }
          .freeBadge { font-size: 6px; font-weight: 700; color: #92400E; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 999px; padding: 1px 5px; }
          .noticeCard { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 5px; padding: 3px 5px; margin-bottom: 3px; }
          .noticeCard p { margin: 0 0 1px; font-size: 6px; line-height: 1.1; }
          .summaryInline { display: flex; flex-wrap: wrap; gap: 1px 6px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 5px; padding: 3px 5px; margin-bottom: 3px; font-size: 6px; line-height: 1.1; }
          .summaryInline span { white-space: nowrap; }
          .limitNotice { margin: 0 0 3px; color: #92400E; font-size: 6px; font-weight: 700; }
          .tableWrap { break-inside: auto; page-break-inside: auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 1px; table-layout: fixed; page-break-inside: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tbody { page-break-inside: auto; }
          tr { break-inside: avoid; page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #E5E7EB; padding: 1px; font-size: 5.2px; line-height: 1.0; text-align: right; word-break: break-word; }
          th { background: #F3F4F6; }
          td:first-child, th:first-child { text-align: left; }
          .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: rgba(148, 163, 184, 0.10); transform: rotate(-22deg); pointer-events: none; z-index: 0; }
          .pageHeader, .noticeCard, .summaryInline, table, .limitNotice { position: relative; z-index: 1; }
        </style>
      </head>
      <body>
        <section class="page">
          <div class="watermark">VERSÃO GRATUITA</div>
          <div class="pageHeader">
            <h1>${title}</h1>
            <div class="freeBadge">${FREE_EXPORT_NOTICE_TITLE}</div>
          </div>
          <div class="noticeCard">
            <p>${FREE_EXPORT_NOTICE_BODY}</p>
            <p><strong>${FREE_EXPORT_NOTICE_UPGRADE}</strong></p>
          </div>
          ${summarySection}
          ${limitedNotice}
          <div class="tableWrap">
            <table>
              ${buildTableHead(hasCorrection)}
              <tbody>
                ${buildTableRows(visibleRows, hasCorrection)}
              </tbody>
            </table>
          </div>
        </section>
      </body>
    </html>
  `;
}

const buildHtml = (
  scenario: Scenario,
  summary: LoanSummary,
  schedule: ScheduleRow[],
  options?: ExportOptions,
) => {
  const rows = schedule.filter((row) => row.installmentNumber > 0);
  return isFreeRewardedExport(options)
    ? buildFreeRewardedHtml(scenario, summary, rows, options)
    : buildPremiumHtml(scenario, summary, rows, options);
};

export async function exportPdf(
  scenario: Scenario,
  summary: LoanSummary,
  schedule: ScheduleRow[],
  options?: ExportOptions,
) {
  const html = buildHtml(scenario, summary, schedule, options);
  const { base64 } = await Print.printToFileAsync({
    html,
    base64: true,
    width: A4_LANDSCAPE_WIDTH_PT,
    height: A4_LANDSCAPE_HEIGHT_PT,
  });

  if (!base64) {
    throw new Error('Generated PDF payload is missing.');
  }

  const sharedFile = new File(Paths.cache, getExportFilename('pdf', options));
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
