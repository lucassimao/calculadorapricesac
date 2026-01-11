import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import type { Config, StoreKey } from './types.js';
import { buildBannerPrompt, buildCoverPrompt } from './prompt.js';
import { ensureGuideAndMask } from './guide.js';
import { generateImage } from './gemini.js';
import { ensureDir, fileExists, findScreenshot, iconOutputPath, bannerOutputPath, loadCopyFile, outputPath, resolvePath } from './io.js';
import { prepareScreenshotCanvas, resizeExact, resizeTo } from './image.js';

export async function renderCovers(cfg: Config, storeFilter: string, slotFilter: string, attempts: number, creative: number, overwrite: boolean) {
  const stores = selectStores(cfg, storeFilter);
  const slots = selectSlots(cfg, slotFilter);
  const { guidePath } = await ensureGuideAndMask(cfg, false, overwrite);
  const copyFile = await loadCopyFile(cfg, 'pt-BR');

  for (const store of stores) {
    const storeCfg = cfg.stores[store];
    const framePath = store === 'appstore' ? cfg.defaults.framePathApp : cfg.defaults.framePathPlay;
    const useFrame = framePath ? await fileExists(resolvePath(framePath)) : false;

    for (const slot of slots) {
      const copyEntry = copyFile[slot.key];
      if (!copyEntry) {
        throw new Error(`Missing copy for slot ${slot.key}`);
      }
      const screenshotPath = findScreenshot(cfg, 'pt-BR', cfg.devices[0], slot.key);
      if (!(await fileExists(screenshotPath))) {
        throw new Error(`Screenshot not found: ${screenshotPath}`);
      }

      for (let attempt = 1; attempt <= attempts; attempt++) {
        const outPath = outputPath(cfg, store, 'pt-BR', slot.key, storeCfg.format, attempts, attempt);
        if (!overwrite && (await fileExists(outPath))) continue;

        const prompt = buildCoverPrompt(cfg, creative, store, storeCfg, slot, copyEntry);
        const prepared = await prepareScreenshotCanvas(cfg, screenshotPath);
        const images = [
          { path: prepared, mime: 'image/png' },
          { path: guidePath, mime: 'image/png' },
        ];
        if (useFrame && framePath) {
          images.push({ path: resolvePath(framePath), mime: 'image/png' });
        }

        const buffer = await generateImage(
          { model: cfg.models.image, imageSize: cfg.models.imageSize, aspectRatio: cfg.models.aspectRatio },
          { prompt, images }
        );
        const resized = await resizeExact(buffer, storeCfg.width, storeCfg.height);
        await ensureDir(path.dirname(outPath));
        await sharp(resized).toFile(outPath);
      }
    }
  }
}

export async function renderBanner(cfg: Config, storeFilter: string, overwrite: boolean) {
  const stores = selectStores(cfg, storeFilter);
  const copyFile = await loadCopyFile(cfg, 'pt-BR');
  const copyEntry = copyFile.banner;
  if (!copyEntry) {
    throw new Error('Missing banner copy entry');
  }

  const bannerShot = resolvePath(cfg.defaults.bannerScreenshot);
  const hasBannerShot = await fileExists(bannerShot);

  for (const store of stores) {
    const bannerCfg = cfg.banners[store];
    const outPath = bannerOutputPath(cfg, store, bannerCfg.format);
    if (!overwrite && (await fileExists(outPath))) continue;

    const prompt = buildBannerPrompt(copyEntry);
    const images = hasBannerShot ? [{ path: bannerShot, mime: 'image/png' }] : [];
    const buffer = await generateImage(
      { model: cfg.models.image, imageSize: cfg.models.imageSize, aspectRatio: '2:1' },
      { prompt, images }
    );
    const resized = await resizeExact(buffer, bannerCfg.width, bannerCfg.height);
    await ensureDir(path.dirname(outPath));
    await sharp(resized).toFile(outPath);
  }
}

export async function renderIcons(cfg: Config, storeFilter: string, overwrite: boolean) {
  const stores = selectStores(cfg, storeFilter);
  const iconSource = resolvePath(cfg.defaults.iconSource);
  if (!(await fileExists(iconSource))) {
    throw new Error(`Icon source not found: ${iconSource}`);
  }

  for (const store of stores) {
    const iconCfg = cfg.icons[store];
    const outPath = iconOutputPath(cfg, store, iconCfg.format);
    if (!overwrite && (await fileExists(outPath))) continue;

    const buffer = await resizeTo(iconSource, iconCfg.width, iconCfg.height, iconCfg.format);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, buffer);
  }
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
