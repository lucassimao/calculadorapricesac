import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import type { Config, StoreKey } from './types.js';
import { buildBannerPrompt, buildCoverPrompt, buildIconPrompt } from './prompt.js';
import { ensureGuideAndMask } from './guide.js';
import { generateImage } from './gemini.js';
import { ensureDir, fileExists, findScreenshot, bannerOutputPath, loadCopyFile, outputPath, resolvePath } from './io.js';
import { fitWithinWithBackground, prepareScreenshotCanvas, resizeExact } from './image.js';

export async function renderCovers(cfg: Config, storeFilter: string, slotFilter: string, attempts: number, creative: number, overwrite: boolean) {
  const stores = selectStores(cfg, storeFilter);
  const slots = selectSlots(cfg, slotFilter);
  const copyFile = await loadCopyFile(cfg, 'pt-BR');
  const outputs: string[] = [];

  for (const store of stores) {
    const storeCfg = cfg.stores[store];
    const baseWidth = storeCfg.baseWidth ?? cfg.defaults.baseWidth;
    const baseHeight = storeCfg.baseHeight ?? cfg.defaults.baseHeight;
    const aspectRatio = storeCfg.aspectRatio ?? cfg.models.aspectRatio;
    const { guidePath } = await ensureGuideAndMask(cfg, store, baseWidth, baseHeight, false, overwrite);
    for (const slot of slots) {
      const copyEntry = copyFile[slot.key];
      if (!copyEntry) {
        throw new Error(`Missing copy for slot ${slot.key}`);
      }
      const screenshotPath = await findScreenshot(cfg, 'pt-BR', slot.key);
      if (!(await fileExists(screenshotPath))) {
        throw new Error(`Screenshot not found: ${screenshotPath}`);
      }

      const prompt = buildCoverPrompt(cfg, creative, store, storeCfg, slot, copyEntry, baseWidth, baseHeight);
      const prepared = await prepareScreenshotCanvas(cfg, screenshotPath, baseWidth, baseHeight);
      const images = [
        { path: prepared, mime: 'image/png' },
        { path: guidePath, mime: 'image/png' },
      ];
      const tasks = Array.from({ length: attempts }, (_, idx) => idx + 1).map(async (attempt) => {
        const outPath = outputPath(cfg, store, 'pt-BR', slot.key, storeCfg.format, attempts, attempt);
        if (!overwrite && (await fileExists(outPath))) {
          outputs.push(outPath);
          return;
        }

        const buffer = await generateImage(
          { model: cfg.models.image, imageSize: cfg.models.imageSize, aspectRatio },
          { prompt, images }
        );
        let resized = store === 'appstore'
          ? await fitWithinWithBackground(buffer, storeCfg.width, storeCfg.height)
          : await resizeExact(buffer, storeCfg.width, storeCfg.height);
        if (store === 'play') {
          resized = await sharp(resized).flatten({ background: '#ffffff' }).png().toBuffer();
        }
        await ensureDir(path.dirname(outPath));
        await sharp(resized).toFile(outPath);
        outputs.push(outPath);
      });
      await Promise.all(tasks);
    }
  }

  logOutputs('Capas', outputs);
}

export async function renderBanner(cfg: Config, storeFilter: string, overwrite: boolean, attempts: number) {
  const stores = selectStores(cfg, storeFilter);
  const tries = Math.max(1, attempts);
  const outputs: string[] = [];

  for (const store of stores) {
    const bannerCfg = cfg.banners[store];
    if (!bannerCfg) continue;
    const outPath = bannerOutputPath(cfg, store, bannerCfg.format);
    if (!overwrite && (await fileExists(outPath))) {
      outputs.push(outPath);
      continue;
    }

    const prompt = buildBannerPrompt();
    const tasks = Array.from({ length: tries }, (_, idx) => idx + 1).map(async (attempt) => {
      const outAttemptPath = outPath.replace('.png', `_try${attempt}.png`);
      if (!overwrite && (await fileExists(outAttemptPath))) {
        outputs.push(outAttemptPath);
        return;
      }
      const buffer = await generateImage(
        { model: cfg.models.image, imageSize: cfg.models.imageSize, aspectRatio: '16:9' },
        { prompt, images: [] }
      );
      let resized = await resizeExact(buffer, bannerCfg.width, bannerCfg.height);
      if (store === 'play') {
        resized = await sharp(resized).flatten({ background: '#ffffff' }).png().toBuffer();
      }
      await ensureDir(path.dirname(outAttemptPath));
      await sharp(resized).toFile(outAttemptPath);
      outputs.push(outAttemptPath);
    });
    await Promise.all(tasks);
  }

  logOutputs('Banners', outputs);
}

export async function renderIcons(cfg: Config, storeFilter: string, overwrite: boolean, attempts: number) {
  const outputs: string[] = [];
  const outDir = path.join(resolvePath(cfg.defaults.outputDir), 'icons');
  const tries = Math.max(1, attempts);

  const prompt = buildIconPrompt('Calculadora Price & SAC', 'appstore');

  const tasks = Array.from({ length: tries }, (_, idx) => idx + 1).map(async (attempt) => {
    const outPath = path.join(outDir, `icon_try${attempt}.png`);
    if (!overwrite && (await fileExists(outPath))) {
      outputs.push(outPath);
      return;
    }

    const generated = await generateImage(
      { model: cfg.models.image, imageSize: cfg.models.imageSize, aspectRatio: '1:1' },
      { prompt, images: [] }
    );
    const buffer = await resizeExact(generated, 1024, 1024);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, buffer);
    outputs.push(outPath);
  });

  await Promise.all(tasks);
  logOutputs('Ícones', outputs);
}

function selectStores(cfg: Config, filter: string): StoreKey[] {
  const keys = Object.keys(cfg.stores) as StoreKey[];
  if (filter === 'all') return keys;
  if (keys.includes(filter as StoreKey)) return [filter as StoreKey];
  throw new Error(`Unknown store: ${filter}`);
}

function selectSlots(cfg: Config, filter: string) {
  if (filter === 'all') return cfg.slots;
  return cfg.slots.filter((slot) => slot.key === filter);
}

function logOutputs(label: string, paths: string[]) {
  if (paths.length === 0) return;
  const unique = Array.from(new Set(paths));
  console.log(`\\n${label} gerados:`);
  unique.forEach((p) => console.log(`- ${p}`));
}
