import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { read, utils } from 'xlsx';
import { normalizeWorksheetRows } from '../src/lib/exports/worksheet-normalizer.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const PACKAGE_ID = 'com.lsimaocosta.calculadorapricesac';
const FIXTURE_PATH = path.join(ROOT, 'scripts', 'fixtures', 'export-readback.expected.json');
const FLOW_DIR = path.join(ROOT, 'maestro', 'readback');
const PERSISTENT_OUTPUT_ROOT = path.join(ROOT, 'tmp', 'export-readback');
mkdirSync(PERSISTENT_OUTPUT_ROOT, { recursive: true });
const OUTPUT_DIR = mkdtempSync(path.join(PERSISTENT_OUTPUT_ROOT, 'export-readback-'));

const exportFixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${stderr || stdout || 'No output'}`,
    );
  }

  return result;
}

function ensurePrerequisites() {
  const adbDevices = run('adb', ['devices']).stdout;
  if (!adbDevices.includes('\tdevice')) {
    throw new Error('Android emulator/device is not available via adb.');
  }

  const metroCheck = spawnSync(
    'bash',
    ['-lc', 'curl -I --max-time 5 http://127.0.0.1:8081 >/dev/null 2>&1'],
    {
      cwd: ROOT,
      stdio: 'ignore',
    },
  );
  if (metroCheck.status !== 0) {
    throw new Error('Metro is not responding on http://127.0.0.1:8081.');
  }
}

function sleep(seconds) {
  spawnSync('bash', ['-lc', `sleep ${seconds}`], {
    cwd: ROOT,
    stdio: 'ignore',
  });
}

function parseCsv(csv) {
  return csv.split('\n').map((line) => {
    if (!line) return [];
    return line.split('";"').map((cell) => cell.replace(/^"/, '').replace(/"$/, ''));
  });
}

function pullAppFile(deviceRelativePath, destinationPath) {
  rmSync(destinationPath, { force: true });
  const destinationFd = openSync(destinationPath, 'w');
  const outFd = spawnSync('adb', ['exec-out', 'run-as', PACKAGE_ID, 'cat', deviceRelativePath], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', destinationFd, 'pipe'],
  });
  closeSync(destinationFd);

  if (outFd.status !== 0) {
    throw new Error(
      `Unable to pull ${deviceRelativePath}\n${outFd.stderr?.trim() || outFd.stdout?.trim() || 'No output'}`,
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyCsv(localPath) {
  const csv = readFileSync(localPath, 'utf8');
  const rows = parseCsv(csv);
  verifyTabularExport(rows, 'CSV');
}

function verifyXlsx(localPath) {
  const workbook = read(readFileSync(localPath), { type: 'buffer' });
  const rows = utils.sheet_to_json(workbook.Sheets.Amortizacao, { header: 1 });
  const normalizedRows = normalizeWorksheetRows(rows);
  verifyTabularExport(normalizedRows, 'XLSX');
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function verifyPdf(localPath) {
  const bytes = readFileSync(localPath);
  assert(bytes.subarray(0, 5).toString() === '%PDF-', 'PDF header is invalid.');
  assert(statSync(localPath).size > 1000, 'PDF file is unexpectedly small.');

  const info = run('pdfinfo', [localPath]).stdout;
  const pageCountMatch = info.match(/Pages:\s+(\d+)/);
  const pageCount = pageCountMatch ? Number.parseInt(pageCountMatch[1], 10) : NaN;
  assert(pageCount === exportFixture.pdf.pageCount, `Unexpected PDF page count: ${pageCount}`);

  const text = run('pdftotext', [localPath, '-']).stdout;
  const normalizedText = normalizeWhitespace(text);
  const requiredFragments = exportFixture.pdf.requiredText;

  for (const fragment of requiredFragments) {
    assert(
      normalizedText.includes(normalizeWhitespace(fragment)),
      `PDF text is missing expected fragment: ${fragment}`,
    );
  }
}

function verifyTabularExport(rows, label) {
  assert(rows.length === exportFixture.rowCount, `${label} row count changed: ${rows.length}`);
  assert(
    JSON.stringify(rows[0]) === JSON.stringify(exportFixture.header),
    `${label} header changed.`,
  );

  const summaryStart = rows.findIndex((row) => row[0] === 'Cenário');
  assert(summaryStart > 0, `${label} summary section is missing.`);

  const checkpoints = {
    first: rows[1],
    second: rows[2],
    tenth: rows[10],
    sixtieth: rows[60],
    oneHundredTwentieth: rows[120],
    twoHundredFortieth: rows[240],
    lastInstallment: rows[summaryStart - 2],
  };

  for (const [key, expectedRow] of Object.entries(exportFixture.checkpoints)) {
    assert(
      JSON.stringify(checkpoints[key]) === JSON.stringify(expectedRow),
      `${label} checkpoint "${key}" changed.`,
    );
  }

  const summaryRows = rows.slice(summaryStart);
  assert(
    JSON.stringify(summaryRows) === JSON.stringify(exportFixture.summaryRows),
    `${label} summary rows changed.`,
  );
}

function runFlow(flowName) {
  run('maestro', ['test', path.join(FLOW_DIR, flowName)]);
}

function verifyFormat(format, flowName, devicePath, verifier) {
  console.log(`Running ${format.toUpperCase()} export flow...`);
  runFlow(flowName);
  assert(
    waitForDeviceFile(devicePath),
    `Unable to locate generated ${format.toUpperCase()} in app cache.`,
  );
  const localPath = path.join(OUTPUT_DIR, path.basename(devicePath));
  pullAppFile(devicePath, localPath);
  verifier(localPath);
  console.log(`Verified ${format.toUpperCase()} artifact: ${localPath}`);
}

function deviceFileExists(deviceRelativePath) {
  const result = spawnSync('adb', ['exec-out', 'run-as', PACKAGE_ID, 'ls', deviceRelativePath], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function waitForDeviceFile(deviceRelativePath, timeoutSeconds = 15) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (deviceFileExists(deviceRelativePath)) {
      return true;
    }
    sleep(1);
  }
  return false;
}

function getDeviceFileSize(deviceRelativePath) {
  const result = spawnSync(
    'adb',
    ['exec-out', 'run-as', PACKAGE_ID, 'sh', '-lc', `wc -c < "${deviceRelativePath}" 2>/dev/null`],
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.status !== 0) {
    return 0;
  }

  const size = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(size) ? size : 0;
}

function waitForDeviceFileSize(deviceRelativePath, minimumBytes, timeoutSeconds = 15) {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (getDeviceFileSize(deviceRelativePath) >= minimumBytes) {
      return true;
    }

    sleep(1);
  }

  return false;
}

function main() {
  try {
    ensurePrerequisites();
    mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('Running PDF export flow...');
    runFlow('export_pdf_dev.yaml');
    const pdfDevicePath = 'cache/relatorio_financiamento.pdf';
    assert(waitForDeviceFile(pdfDevicePath), 'Unable to locate generated PDF in app cache.');
    assert(waitForDeviceFileSize(pdfDevicePath, 1000), 'Generated PDF stayed empty in app cache.');
    const pdfLocalPath = path.join(OUTPUT_DIR, path.basename(pdfDevicePath));
    pullAppFile(pdfDevicePath, pdfLocalPath);
    verifyPdf(pdfLocalPath);
    console.log(`Verified PDF artifact: ${pdfLocalPath}`);

    verifyFormat('xlsx', 'export_xlsx_dev.yaml', 'cache/relatorio_financiamento.xlsx', verifyXlsx);
    verifyFormat('csv', 'export_csv_dev.yaml', 'cache/relatorio_financiamento.csv', verifyCsv);

    console.log(`Export readback verification passed. Artifacts stored in ${OUTPUT_DIR}`);
  } finally {
    console.log(`Export readback artifacts available at ${OUTPUT_DIR}`);
  }
}

main();
