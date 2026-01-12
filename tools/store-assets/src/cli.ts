import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './io.js';
import type { StoreKey } from './types.js';
import { ensureGuideAndMask } from './guide.js';
import { renderBanner, renderCovers, renderIcons } from './render.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(toolRoot, '.env') });

const program = new Command();

program
  .option('-c, --config <path>', 'config path', 'config.json')
  .option('-a, --action <action>', 'action: render, guide, banner, icon', 'render')
  .option('-s, --store <store>', 'store: appstore, play, all', 'all')
  .option('-l, --slot <slot>', 'slot key or all', 'all')
  .option('--attempts <number>', 'attempts per slot', '2')
  .option('--creative <number>', 'creativity level 0-5', '2')
  .option('--overwrite', 'overwrite existing outputs', false);

program.parse(process.argv);

const opts = program.opts();

const main = async () => {
  const cfg = await loadConfig(opts.config);
  const attempts = Math.max(1, Number.parseInt(opts.attempts, 10));
  const creative = Math.max(0, Math.min(5, Number.parseInt(opts.creative, 10)));

  switch (opts.action) {
    case 'render':
      await renderCovers(cfg, opts.store, opts.slot, attempts, creative, opts.overwrite);
      break;
    case 'guide':
      {
        const stores = opts.store === 'all'
          ? (Object.keys(cfg.stores) as StoreKey[])
          : [opts.store as StoreKey];
        for (const store of stores) {
          const storeCfg = cfg.stores[store];
          const baseWidth = storeCfg.baseWidth ?? cfg.defaults.baseWidth;
          const baseHeight = storeCfg.baseHeight ?? cfg.defaults.baseHeight;
          await ensureGuideAndMask(cfg, store, baseWidth, baseHeight, false, opts.overwrite);
        }
      }
      break;
    case 'banner':
      await renderBanner(cfg, opts.store, opts.overwrite, attempts);
      break;
    case 'icon':
      await renderIcons(cfg, opts.store, opts.overwrite, attempts);
      break;
    default:
      throw new Error(`Unknown action: ${opts.action}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
