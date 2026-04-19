import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { exportCsv } from '../exports/csv';
import { exportPdf } from '../exports/pdf';
import { exportXlsx } from '../exports/xlsx';
import { FREE_EXPORT_ROW_LIMIT, getFreePdfVisibleRowLimit } from '../exports/access';
import type { LoanSummary, Scenario, ScheduleRow } from '../../types/loan';
import { normalizeWorksheetRows } from '../exports/worksheet-normalizer.mjs';

const { shareAsync, printToFileAsync, createdFiles } = vi.hoisted(() => ({
  shareAsync: vi.fn(),
  printToFileAsync: vi.fn(),
  createdFiles: [] as { uri: string; writes: unknown[] }[],
}));

vi.mock('expo-sharing', () => ({ shareAsync }));
vi.mock('expo-print', () => ({ printToFileAsync }));
vi.mock('expo-file-system', () => {
  class File {
    uri: string;
    writes: unknown[] = [];
    exists = false;
    size: number | null = 0;

    constructor(...segments: string[]) {
      this.uri = segments.join('/');
      if (this.uri.endsWith('.pdf')) {
        this.exists = true;
        this.size = 128;
      }
      createdFiles.push({ uri: this.uri, writes: this.writes });
    }

    create() {
      this.exists = true;
      this.size = this.size ?? 0;
      return;
    }

    write(data: unknown) {
      this.writes.push(data);
      this.exists = true;
      this.size =
        typeof data === 'string'
          ? data.length
          : data instanceof Uint8Array
            ? data.byteLength
            : this.size;
    }

    bytesSync() {
      return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    }

    delete() {
      this.exists = false;
    }
  }

  const Paths = {
    cache: 'file:///cache',
  };

  return { File, Paths };
});

const scenario: Scenario = {
  id: '1',
  name: 'Teste',
  system: 'PRICE',
  principal: 100000,
  rate: 1,
  rateType: 'monthly',
  term: 12,
  termUnit: 'months',
  startDate: new Date(2026, 0, 1),
  dueDay: 1,
  loanMode: 'property',
  propertyValue: 140000,
  downPayment: 40000,
  prepayments: [],
};

const summary: LoanSummary = {
  totalPayment: 120000,
  totalInterest: 20000,
  firstPayment: 10000,
  lastPayment: 9000,
  averagePayment: 9500,
  interestPercentage: 20,
  totalUpfrontCosts: 0,
  totalMonthlyCosts: 0,
  totalPaymentWithCosts: 120000,
  cetAnnualRate: 0,
  financedPrincipal: 100000,
  propertyTotalCost: 0,
  totalFgtsUsed: 0,
  totalPaymentNet: 120000,
};

const schedule: ScheduleRow[] = [
  {
    installmentNumber: 0,
    date: new Date(2026, 0, 1),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: 100000,
  },
  {
    installmentNumber: 1,
    date: new Date(2026, 1, 1),
    payment: 10000,
    interest: 1000,
    amortization: 9000,
    balance: 91000,
    extraCosts: 120,
    prepaymentAmount: 500,
    fgtsAmortization: 300,
    fgtsSubsidy: 200,
    netPayment: 9800,
  },
  {
    installmentNumber: 2,
    date: new Date(2026, 2, 1),
    payment: 9900,
    interest: 910,
    amortization: 8990,
    balance: 82010,
    extraCosts: 100,
    prepaymentAmount: 0,
    fgtsAmortization: 0,
    fgtsSubsidy: 0,
    netPayment: 9900,
  },
];

function buildLongSchedule(installments: number): ScheduleRow[] {
  return [
    {
      installmentNumber: 0,
      date: new Date(2026, 0, 1),
      payment: 0,
      interest: 0,
      amortization: 0,
      balance: 100000,
    },
    ...Array.from({ length: installments }, (_, index) => {
      const installmentNumber = index + 1;
      const payment = 10000 - index * 10;
      const interest = 1000 - index * 5;
      const amortization = payment - interest;
      const balance = Math.max(0, 100000 - installmentNumber * 2500);

      return {
        installmentNumber,
        date: new Date(2026, installmentNumber, 1),
        payment,
        interest,
        amortization,
        balance,
        extraCosts: installmentNumber % 2 === 0 ? 100 : 120,
        prepaymentAmount: installmentNumber % 3 === 0 ? 500 : 0,
        fgtsAmortization: installmentNumber % 4 === 0 ? 300 : 0,
        fgtsSubsidy: installmentNumber % 5 === 0 ? 200 : 0,
        netPayment: payment - 200,
      } satisfies ScheduleRow;
    }),
  ];
}

const fixturePath = path.join(__dirname, 'fixtures', 'export-content.expected.json');
const exportFixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
  rows: string[][];
  pdf: {
    title: string;
    headers: string[];
    firstRow: string[];
    metadata: Record<string, string>;
  };
};

function parseCsv(csv: string) {
  return csv.split('\n').map((line) => {
    if (!line) return [];
    return line.split('";"').map((cell) => cell.replace(/^"/, '').replace(/"$/, ''));
  });
}

function normalizeHtml(html: string) {
  return html.replace(/\s+/g, ' ').trim();
}

function extractTableCells(html: string, tag: 'th' | 'td') {
  return [...html.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, 'g'))].map((match) => match[1]);
}

function extractPdfMetadata(html: string) {
  return Object.fromEntries(
    [...html.matchAll(/<p><strong>(.*?):<\/strong>\s*(.*?)<\/p>/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

beforeEach(() => {
  shareAsync.mockReset();
  printToFileAsync.mockReset();
  createdFiles.length = 0;
});

describe('exports', () => {
  it('exports CSV and shares with correct mime', async () => {
    await exportCsv(schedule, scenario, summary);

    expect(createdFiles).toHaveLength(1);
    expect(createdFiles[0]?.uri).toContain('tabela_amortizacao.csv');
    expect(createdFiles[0]?.writes).toHaveLength(1);
    expect(typeof createdFiles[0]?.writes[0]).toBe('string');
    const csv = createdFiles[0]?.writes[0] as string;
    expect(csv).toContain(
      '"N°";"Data";"Valor Parcela";"Juros";"Amortização";"Saldo";"Custos";"Extra";"FGTS Amortização";"FGTS Parcela";"Líquido"',
    );
    expect(csv).toContain(
      '"1";"01/02/2026";"10000,00";"1000,00";"9000,00";"91000,00";"120,00";"500,00";"300,00";"200,00";"9800,00"',
    );
    expect(csv).toContain('"Cenário";"Teste"');
    expect(csv).toContain('"Valor do imóvel";"140000,00"');
    expect(csv).toContain('"Prazo original";"12 meses"');
    expect(csv).toContain('"Prazo efetivo";"2 parcelas"');
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('tabela_amortizacao.csv'),
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
  });

  it('exports XLSX and shares with correct mime', async () => {
    await exportXlsx(schedule, scenario, summary);

    expect(createdFiles).toHaveLength(1);
    expect(createdFiles[0]?.uri).toContain('tabela_amortizacao.xlsx');
    expect(createdFiles[0]?.writes).toHaveLength(1);
    expect(createdFiles[0]?.writes[0]).toBeInstanceOf(Uint8Array);
    const workbook = XLSX.read(createdFiles[0]?.writes[0], { type: 'array', cellNF: true });
    const sheet = workbook.Sheets.Amortizacao;
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
    expect(rows[0]).toEqual([
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
    ]);
    expect(rows[1]).toEqual([1, '01/02/2026', 10000, 1000, 9000, 91000, 120, 500, 300, 200, 9800]);
    expect(sheet.C2?.z).toBe('"R$" #,##0.00');
    expect(sheet.F2?.z).toBe('"R$" #,##0.00');
    expect(sheet.B10?.z).toBe('"R$" #,##0.00');
    expect(rows).toContainEqual(['Cenário', 'Teste']);
    expect(rows).toContainEqual(['Valor do imóvel', 140000]);
    expect(rows).toContainEqual(['Prazo original', '12 meses']);
    expect(rows).toContainEqual(['Prazo efetivo', '2 parcelas']);
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('tabela_amortizacao.xlsx'),
      expect.objectContaining({
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  });

  it('exports PDF and shares with correct mime', async () => {
    printToFileAsync.mockResolvedValue({
      uri: 'file:///cache/relatorio.pdf',
      base64: 'JVBERi0=',
    });

    await exportPdf(scenario, summary, schedule);

    const html = printToFileAsync.mock.calls[0]?.[0]?.html as string;
    const sharedPdf = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.pdf'));
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Relatório de Financiamento'),
        base64: true,
        width: 842,
        height: 595,
      }),
    );
    expect(html).toContain('<th>Extra</th>');
    expect(html).toContain('<th>FGTS Amort.</th>');
    expect(html).toContain('<th>FGTS Parcela</th>');
    expect(html).toContain('<strong>Cenário:</strong> Teste');
    expect(html).toContain('<strong>Valor do imóvel:</strong>');
    expect(html).toContain('<strong>Prazo original:</strong> 12 meses');
    expect(html).toContain('<strong>Prazo efetivo:</strong> 2 parcelas');
    expect(sharedPdf?.writes[0]).toBeInstanceOf(Uint8Array);
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('tabela_amortizacao.pdf'),
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
  });

  it('exports table-only variants without summary metadata', async () => {
    printToFileAsync.mockResolvedValue({
      uri: 'file:///cache/relatorio.pdf',
      base64: 'JVBERi0=',
    });

    await exportCsv(schedule, scenario, summary, { tableOnly: true });
    await exportXlsx(schedule, scenario, summary, { tableOnly: true });
    await exportPdf(scenario, summary, schedule, { tableOnly: true });

    const csvFile = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.csv'));
    const xlsxFile = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.xlsx'));
    const csvRows = parseCsv(csvFile?.writes[0] as string);
    const workbook = XLSX.read(xlsxFile?.writes[0], { type: 'array' });
    const worksheetRows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets.Amortizacao,
      { header: 1 },
    );
    const normalizedXlsxRows = normalizeWorksheetRows(worksheetRows);
    const html = normalizeHtml(printToFileAsync.mock.calls[0]?.[0]?.html as string);

    expect(csvRows).toHaveLength(3);
    expect(csvRows.some((row) => row[0] === 'Cenário')).toBe(false);
    expect(normalizedXlsxRows).toHaveLength(3);
    expect(normalizedXlsxRows.some((row: string[]) => row[0] === 'Cenário')).toBe(false);
    expect(html).toContain('<h1>Tabela de Amortização</h1>');
    expect(html).not.toContain('<strong>Cenário:</strong>');
    expect(html).not.toContain('<h2>Resumo</h2>');
  });

  it('exports rewarded CSV and XLSX with only the first 10 rows plus an upgrade notice', async () => {
    const longSchedule = buildLongSchedule(15);

    await exportCsv(longSchedule, scenario, summary, { access: 'free_rewarded' });
    await exportXlsx(longSchedule, scenario, summary, { access: 'free_rewarded' });

    const csvFile = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.csv'));
    const xlsxFile = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.xlsx'));
    const csvRows = parseCsv(csvFile?.writes[0] as string);
    const workbook = XLSX.read(xlsxFile?.writes[0], { type: 'array' });
    const worksheetRows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets.Amortizacao,
      { header: 1 },
    );
    const normalizedXlsxRows = normalizeWorksheetRows(worksheetRows);

    expect(
      csvRows.slice(1, 1 + FREE_EXPORT_ROW_LIMIT).every((row: string[]) => row[0] !== ''),
    ).toBe(true);
    expect(csvRows.some((row: string[]) => row[0] === '11')).toBe(false);
    expect(csvRows).toContainEqual([
      'Gerado na versão gratuita',
      'Arquivo gerado após assistir a um anúncio no app Calculadora Price & SAC.',
    ]);
    expect(csvRows).toContainEqual(['Linhas exportadas', '10 de 15']);
    expect(csvRows).toContainEqual([
      'Upgrade',
      'Assine o Premium para exportar a versão completa, sem limitações e sem marca d’água.',
    ]);

    expect(normalizedXlsxRows.some((row: string[]) => row[0] === '11')).toBe(false);
    expect(normalizedXlsxRows).toContainEqual([
      'Gerado na versão gratuita',
      'Arquivo gerado após assistir a um anúncio no app Calculadora Price & SAC.',
    ]);
    expect(normalizedXlsxRows).toContainEqual(['Linhas exportadas', '10 de 15']);
    expect(normalizedXlsxRows).toContainEqual([
      'Upgrade',
      'Assine o Premium para exportar a versão completa, sem limitações e sem marca d’água.',
    ]);
  });

  it('exports rewarded PDF with free watermarking and the first 10 rows on a compact single-page layout', async () => {
    const longSchedule = buildLongSchedule(60);
    printToFileAsync.mockResolvedValue({
      uri: 'file:///cache/relatorio.pdf',
      base64: 'JVBERi0=',
    });

    await exportPdf(scenario, summary, longSchedule, { access: 'free_rewarded' });

    const html = normalizeHtml(printToFileAsync.mock.calls[0]?.[0]?.html as string);
    const dataCells = extractTableCells(html, 'td');
    const installmentCells = dataCells.filter((_, index) => index % 11 === 0);
    const expectedVisibleRows = getFreePdfVisibleRowLimit(false);

    expect(html).toContain('VERSÃO GRATUITA');
    expect(html).toContain('Gerado na versão gratuita');
    expect(html).toContain('Assine o Premium para exportar a versão completa');
    expect(html).toContain(`Mostrando ${expectedVisibleRows} de 60 parcelas`);
    expect(installmentCells).toHaveLength(expectedVisibleRows);
    expect(installmentCells[0]).toBe('1');
    expect(installmentCells.at(-1)).toBe(String(expectedVisibleRows));
    expect(html).not.toContain(`>${expectedVisibleRows + 1}<`);
  });

  it('matches the saved export content fixture for csv, xlsx, and pdf', async () => {
    printToFileAsync.mockResolvedValue({
      uri: 'file:///cache/relatorio.pdf',
      base64: 'JVBERi0=',
    });

    await exportCsv(schedule, scenario, summary);
    await exportXlsx(schedule, scenario, summary);
    await exportPdf(scenario, summary, schedule);

    const csvFile = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.csv'));
    const xlsxFile = createdFiles.find((file) => file.uri.includes('tabela_amortizacao.xlsx'));
    const csvRows = parseCsv(csvFile?.writes[0] as string);
    const workbook = XLSX.read(xlsxFile?.writes[0], { type: 'array' });
    const worksheetRows = XLSX.utils.sheet_to_json<(string | number)[]>(
      workbook.Sheets.Amortizacao,
      {
        header: 1,
      },
    );
    const normalizedXlsxRows = normalizeWorksheetRows(worksheetRows);
    const html = normalizeHtml(printToFileAsync.mock.calls[0]?.[0]?.html as string);
    const pdfHeaders = extractTableCells(html, 'th');
    const pdfFirstRow = extractTableCells(html, 'td').slice(0, exportFixture.pdf.headers.length);
    const pdfMetadata = extractPdfMetadata(html);

    expect(csvRows).toEqual(exportFixture.rows);
    expect(normalizedXlsxRows).toEqual(exportFixture.rows);
    expect(html).toContain(`<h1>${exportFixture.pdf.title}</h1>`);
    expect(pdfHeaders).toEqual(exportFixture.pdf.headers);
    expect(pdfFirstRow).toEqual(exportFixture.pdf.firstRow);
    expect(pdfMetadata).toMatchObject(exportFixture.pdf.metadata);
  });
});
