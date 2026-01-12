import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import type { Config, LayoutConfig, StoreKey } from './types.js';
import { ensureDir, resolvePath } from './io.js';

export async function ensureGuideAndMask(
  cfg: Config,
  store: StoreKey,
  baseWidth: number,
  baseHeight: number,
  invertMask: boolean,
  overwrite: boolean
) {
  const guideDir = resolvePath(cfg.defaults.guideDir);
  const maskDir = resolvePath(cfg.defaults.maskDir);
  const guidePath = path.join(guideDir, `layout-guide-${store}.png`);
  const maskPath = path.join(maskDir, `layout-mask-${store}.png`);
  const hashPath = path.join(guideDir, `layout-${store}.hash`);

  const cfgHash = hashConfig(cfg);
  if (!overwrite && (await exists(guidePath)) && (await exists(maskPath)) && (await hashMatches(hashPath, cfgHash))) {
    return { guidePath, maskPath };
  }

  await ensureDir(guideDir);
  await ensureDir(maskDir);

  const guideSvg = buildGuideSvg(baseWidth, baseHeight, cfg.layout);
  const maskSvg = buildMaskSvg(baseWidth, baseHeight, cfg.layout, invertMask);

  await sharp(Buffer.from(guideSvg)).png().toFile(guidePath);
  await sharp(Buffer.from(maskSvg)).png().toFile(maskPath);
  await fs.writeFile(hashPath, cfgHash);

  return { guidePath, maskPath };
}

function buildGuideSvg(width: number, height: number, layout: LayoutConfig) {
  const textHeight = Math.round(height * layout.textBackdropHeightPct);
  const screenshotRect = screenshotArea(width, height, layout);
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${textHeight}" fill="rgba(255,255,255,0.15)"/>
    <rect x="${screenshotRect.x}" y="${screenshotRect.y}" width="${screenshotRect.width}" height="${screenshotRect.height}" fill="rgba(255,153,0,0.2)"/>
  </svg>
  `;
}

function buildMaskSvg(width: number, height: number, layout: LayoutConfig, invert: boolean) {
  const screenshotRect = screenshotArea(width, height, layout);
  const baseFill = invert ? 'white' : 'black';
  const maskFill = invert ? 'black' : 'white';
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${baseFill}"/>
    <rect x="${screenshotRect.x}" y="${screenshotRect.y}" width="${screenshotRect.width}" height="${screenshotRect.height}" fill="${maskFill}"/>
  </svg>
  `;
}

export function screenshotArea(width: number, height: number, layout: LayoutConfig) {
  const maxWidth = Math.round(width * layout.screenshotWidthPct);
  const top = Math.round(height * layout.screenshotTopPct);
  const bottom = Math.round(height * layout.screenshotBottomPct);
  const maxHeight = height - top - bottom;

  const areaW = Math.min(maxWidth, width);
  const areaH = Math.min(maxHeight, height);

  const x = Math.round((width - areaW) / 2);
  const y = Math.round(top + (maxHeight - areaH) / 2);
  return { x, y, width: areaW, height: areaH };
}

function hashConfig(cfg: Config) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(cfg));
  return hash.digest('hex');
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hashMatches(path: string, expected: string) {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return raw.trim() === expected;
  } catch {
    return false;
  }
}
