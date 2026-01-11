import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Config, CopyFile, StoreKey } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolvePath(inputPath: string) {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(__dirname, '..', '..', inputPath);
}

export async function loadConfig(configPath: string): Promise<Config> {
  const resolved = resolvePath(configPath);
  const raw = await fs.readFile(resolved, 'utf8');
  return JSON.parse(raw) as Config;
}

export async function loadCopyFile(cfg: Config, locale: string): Promise<CopyFile> {
  const copyPath = path.join(resolvePath(cfg.defaults.copyDir), `${locale}.json`);
  const raw = await fs.readFile(copyPath, 'utf8');
  return JSON.parse(raw) as CopyFile;
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function outputPath(
  cfg: Config,
  store: StoreKey,
  locale: string,
  slot: string,
  format: string,
  attempts: number,
  attempt: number
) {
  const base = resolvePath(cfg.defaults.outputDir);
  const filename = attempts > 1 ? `${slot}_try${attempt}.${format}` : `${slot}.${format}`;
  return path.join(base, store, locale, filename);
}

export function bannerOutputPath(cfg: Config, store: StoreKey, format: string) {
  const base = resolvePath(cfg.defaults.outputDir);
  return path.join(base, store, 'pt-BR', `banner.${format}`);
}

export function iconOutputPath(cfg: Config, store: StoreKey, format: string) {
  const base = resolvePath(cfg.defaults.outputDir);
  return path.join(base, store, 'pt-BR', `icon.${format}`);
}

export function findScreenshot(cfg: Config, locale: string, device: string, slot: string) {
  const dir = resolvePath(cfg.defaults.screenshotDir);
  return path.join(dir, locale, device, `${slot}.png`);
}
