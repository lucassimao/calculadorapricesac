import path from 'path';
import os from 'os';
import sharp from 'sharp';
import type { Config } from './types.js';
import { screenshotArea } from './guide.js';
import { ensureDir } from './io.js';

export async function prepareScreenshotCanvas(
  cfg: Config,
  screenshotPath: string,
  baseWidth: number,
  baseHeight: number,
  layout = cfg.layout
) {
  const area = screenshotArea(baseWidth, baseHeight, layout);

  const resized = await sharp(screenshotPath)
    .resize(area.width, area.height, { fit: 'contain' })
    .toBuffer();

  const canvas = sharp({
    create: {
      width: baseWidth,
      height: baseHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composed = await canvas
    .composite([{ input: resized, left: area.x, top: area.y }])
    .png()
    .toBuffer();

  const tmpDir = path.join(os.tmpdir(), 'store-assets');
  await ensureDir(tmpDir);
  const outputPath = path.join(tmpDir, `screenshot-${Date.now()}.png`);
  await sharp(composed).png().toFile(outputPath);
  return outputPath;
}

export async function resizeExact(input: Buffer, width: number, height: number) {
  return sharp(input).resize(width, height, { fit: 'fill' }).png().toBuffer();
}

export async function fitWithinWithBackground(input: Buffer, width: number, height: number) {
  const img = sharp(input);
  const stats = await img.stats();
  const [r, g, b] = stats.channels.map((c) => Math.round(c.mean));
  return sharp(input)
    .resize(width, height, { fit: 'contain', background: { r, g, b, alpha: 1 } })
    .png()
    .toBuffer();
}

export async function resizeTo(inputPath: string, width: number, height: number, format: string) {
  const pipeline = sharp(inputPath).resize(width, height, { fit: 'cover' });
  if (format === 'png') return pipeline.png().toBuffer();
  if (format === 'jpg' || format === 'jpeg') return pipeline.jpeg({ quality: 92 }).toBuffer();
  return pipeline.png().toBuffer();
}
