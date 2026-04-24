export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

export type ExportAccess = 'premium' | 'free_rewarded';

export interface ExportOptions {
  tableOnly?: boolean;
  access?: ExportAccess;
  professional?: boolean;
}

export const FREE_EXPORT_ROW_LIMIT = 10;
export const FREE_PDF_ROW_LIMITS = {
  detailed: 10,
  tableOnly: 10,
} as const;

export const FREE_EXPORT_NOTICE_TITLE = 'Gerado na versão gratuita';
export const FREE_EXPORT_NOTICE_BODY =
  'Arquivo gerado após assistir a um anúncio no app Calculadora Price & SAC.';
export const FREE_EXPORT_NOTICE_UPGRADE =
  'Assine o Premium para exportar a versão completa, sem limitações e sem marca d’água.';

export function isFreeRewardedExport(options?: ExportOptions) {
  return options?.access === 'free_rewarded';
}

export function getExportFileStem(options?: ExportOptions) {
  if (options?.professional) return 'relatorio_profissional_financiamento';
  return options?.tableOnly ? 'tabela_amortizacao' : 'relatorio_financiamento';
}

export function getExportFilename(format: ExportFormat, options?: ExportOptions) {
  return `${getExportFileStem(options)}.${format}`;
}

export function getFreePdfVisibleRowLimit(tableOnly = false) {
  return tableOnly ? FREE_PDF_ROW_LIMITS.tableOnly : FREE_PDF_ROW_LIMITS.detailed;
}

export function buildFreeExportNoticeRows(totalRows: number, visibleRows: number) {
  return [
    [FREE_EXPORT_NOTICE_TITLE, FREE_EXPORT_NOTICE_BODY],
    ['Linhas exportadas', `${visibleRows} de ${totalRows}`],
    ['Upgrade', FREE_EXPORT_NOTICE_UPGRADE],
  ];
}
