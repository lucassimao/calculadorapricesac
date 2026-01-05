import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportCsv } from '../exports/csv';
import { exportPdf } from '../exports/pdf';
import { exportXlsx } from '../exports/xlsx';
import type { LoanSummary, Scenario, ScheduleRow } from '../../types/loan';

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

    constructor(...segments: string[]) {
      this.uri = segments.join('/');
      createdFiles.push({ uri: this.uri, writes: this.writes });
    }

    create() {
      return;
    }

    write(data: unknown) {
      this.writes.push(data);
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
  startDate: new Date('2026-01-01'),
  dueDay: 1,
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
};

const schedule: ScheduleRow[] = [
  {
    installmentNumber: 0,
    date: new Date('2026-01-01'),
    payment: 0,
    interest: 0,
    amortization: 0,
    balance: 100000,
  },
  {
    installmentNumber: 1,
    date: new Date('2026-02-01'),
    payment: 10000,
    interest: 1000,
    amortization: 9000,
    balance: 91000,
  },
];

beforeEach(() => {
  shareAsync.mockReset();
  printToFileAsync.mockReset();
  createdFiles.length = 0;
});

describe('exports', () => {
  it('exports CSV and shares with correct mime', async () => {
    await exportCsv(schedule, scenario);

    expect(createdFiles).toHaveLength(1);
    expect(createdFiles[0]?.uri).toContain('tabela_amortizacao.csv');
    expect(createdFiles[0]?.writes).toHaveLength(1);
    expect(typeof createdFiles[0]?.writes[0]).toBe('string');
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('tabela_amortizacao.csv'),
      expect.objectContaining({ mimeType: 'text/csv' })
    );
  });

  it('exports XLSX and shares with correct mime', async () => {
    await exportXlsx(schedule, scenario);

    expect(createdFiles).toHaveLength(1);
    expect(createdFiles[0]?.uri).toContain('tabela_amortizacao.xlsx');
    expect(createdFiles[0]?.writes).toHaveLength(1);
    expect(createdFiles[0]?.writes[0]).toBeInstanceOf(Uint8Array);
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('tabela_amortizacao.xlsx'),
      expect.objectContaining({
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
  });

  it('exports PDF and shares with correct mime', async () => {
    printToFileAsync.mockResolvedValue({ uri: 'file:///cache/relatorio.pdf' });

    await exportPdf(scenario, summary, schedule);

    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('Relatório de Financiamento') })
    );
    expect(shareAsync).toHaveBeenCalledWith(
      'file:///cache/relatorio.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' })
    );
  });
});
