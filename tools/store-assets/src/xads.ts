import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import sharp from 'sharp';

type Creative = {
  slug: string;
  screenshot: string;
  eyebrow: string;
  headline: string[];
  accentLine: number;
  support: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const screenshotRoot = path.join(repoRoot, 'tools/store-assets/screenshots/pt-BR');
const captureRoot = path.join(repoRoot, 'output/maestro-captures');
const outputDir = path.join(repoRoot, 'output/imagegen/x-ads-real');
const iconPath = path.join(repoRoot, 'mobile/assets/icon.png');

const creatives: Creative[] = [
  {
    slug: 'sem-cadastro',
    screenshot: 'marketing-summary.png',
    eyebrow: 'Calculadora Price & SAC',
    headline: ['Simule seu', 'financiamento', 'sem cadastro'],
    accentLine: 2,
    support: 'Simulador imobiliário offline, sem cadastro.',
  },
  {
    slug: 'sac-price',
    screenshot: 'marketing-comparison.png',
    eyebrow: 'Compare antes de fechar',
    headline: ['SAC ou Price?', 'Veja o custo', 'lado a lado'],
    accentLine: 0,
    support: 'Simulador imobiliário offline, sem cadastro.',
  },
  {
    slug: 'fgts-amortizacao',
    screenshot: 'marketing-fgts.png',
    eyebrow: 'FGTS e amortizações',
    headline: ['Teste FGTS', 'e amortizações', 'extras'],
    accentLine: 0,
    support: 'Simulador imobiliário offline, sem cadastro.',
  },
  {
    slug: 'pdf-export',
    screenshot: 'marketing-export-pdf.png',
    eyebrow: 'Relatórios profissionais',
    headline: ['Exporte PDFs', 'profissionais', 'no Premium'],
    accentLine: 0,
    support: 'Gere PDF e PDF Profissional no Premium.',
  },
];

const outputs = [
  { size: 800, quality: 88 },
  { size: 1200, quality: 88 },
];

const colors = {
  cream: '#fbf4e6',
  cream2: '#fffaf0',
  green: '#064a31',
  green2: '#0b5c3d',
  orange: '#e86f13',
  ink: '#202724',
  muted: '#67716b',
  line: '#ddd2bd',
  white: '#ffffff',
};

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgBuffer(svg: string) {
  return Buffer.from(svg);
}

async function roundedImage(
  input: Buffer,
  width: number,
  height: number,
  radius: number,
  fit: 'cover' | 'contain' = 'contain',
) {
  const mask = svgBuffer(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/>
    </svg>
  `);

  return sharp(input)
    .resize(width, height, { fit, position: 'top', background: colors.white })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function backgroundSvg(size: number, creative: Creative) {
  const s = size / 1200;
  const brandX = Math.round(86 * s);
  const brandY = Math.round(88 * s);
  const iconSize = Math.round(86 * s);
  const headlineX = Math.round(78 * s);
  const headlineTop = Math.round(245 * s);
  const lineHeight = Math.round(118 * s);
  const headlineSize = Math.round(88 * s);
  const eyebrowSize = Math.round(33 * s);
  const ctaX = Math.round(76 * s);
  const ctaY = Math.round(990 * s);
  const ctaW = Math.round(505 * s);
  const ctaH = Math.round(100 * s);
  const ctaTextSize = Math.round(39 * s);
  const supportSize = Math.round(26 * s);
  const supportY = Math.round(920 * s);

  const lines = creative.headline
    .map((line, index) => {
      const fill = index === creative.accentLine ? colors.green : colors.ink;
      const y = headlineTop + index * lineHeight;
      return `<text x="${headlineX}" y="${y}" font-size="${headlineSize}" font-weight="800" fill="${fill}">${esc(line)}</text>`;
    })
    .join('\n');

  return svgBuffer(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${colors.cream2}"/>
          <stop offset="100%" stop-color="${colors.cream}"/>
        </linearGradient>
        <linearGradient id="cta" x1="0" x2="1">
          <stop offset="0%" stop-color="${colors.green}"/>
          <stop offset="100%" stop-color="${colors.green2}"/>
        </linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="${Math.round(16 * s)}" stdDeviation="${Math.round(18 * s)}" flood-color="#092719" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>
      <circle cx="${Math.round(1070 * s)}" cy="${Math.round(165 * s)}" r="${Math.round(330 * s)}" fill="#ffffff" opacity="0.55"/>
      <circle cx="${Math.round(1140 * s)}" cy="${Math.round(1050 * s)}" r="${Math.round(410 * s)}" fill="${colors.green}" opacity="0.98"/>
      <path d="M0 ${Math.round(1020 * s)} C ${Math.round(185 * s)} ${Math.round(930 * s)}, ${Math.round(315 * s)} ${Math.round(980 * s)}, ${Math.round(500 * s)} ${Math.round(880 * s)}" fill="none" stroke="${colors.line}" stroke-width="${Math.round(3 * s)}" opacity="0.65"/>
      <text x="${brandX + iconSize + Math.round(24 * s)}" y="${brandY + Math.round(38 * s)}" font-family="Arial, Helvetica, sans-serif" font-size="${eyebrowSize}" font-weight="700" fill="${colors.green}">${esc(creative.eyebrow)}</text>
      ${lines}
      <text x="${headlineX}" y="${supportY}" font-family="Arial, Helvetica, sans-serif" font-size="${supportSize}" font-weight="600" fill="${colors.muted}">${esc(creative.support)}</text>
      <g filter="url(#softShadow)">
        <rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${Math.round(50 * s)}" fill="url(#cta)"/>
        <text x="${ctaX + Math.round(134 * s)}" y="${ctaY + Math.round(64 * s)}" font-family="Arial, Helvetica, sans-serif" font-size="${ctaTextSize}" font-weight="800" fill="${colors.white}">Baixe na App Store</text>
        <path transform="translate(${ctaX + Math.round(58 * s)} ${ctaY + Math.round(30 * s)}) scale(${1.75 * s})" d="M16.8 13.8c0 2.3 2 3.1 2 3.1s-1.6 4.7-3.8 4.7c-1.1 0-1.5-.7-2.8-.7s-1.8.7-2.9.7c-2.1 0-3.9-4.3-3.9-7.8 0-3.1 2-4.7 3.9-4.7 1.1 0 1.9.7 2.6.7s1.7-.9 3.1-.8c.5 0 1.9.2 2.8 1.5-2.4 1.3-2.2 3.7-2.2 4.1zM13.9 4.1c.6-.7 1-1.7.9-2.7-1 .1-2 .7-2.6 1.4-.6.7-1 1.7-.9 2.7 1-.1 1.9-.7 2.6-1.4z" fill="${colors.white}"/>
      </g>
    </svg>
  `);
}

function phoneFrameSvg(size: number) {
  const s = size / 1200;
  const x = Math.round(640 * s);
  const y = Math.round(145 * s);
  const w = Math.round(500 * s);
  const h = Math.round(900 * s);
  const r = Math.round(44 * s);
  const stroke = Math.round(12 * s);

  return {
    x,
    y,
    screenX: x + Math.round(12 * s),
    screenY: y + Math.round(12 * s),
    screenW: w - Math.round(24 * s),
    screenH: h - Math.round(24 * s),
    radius: Math.round(30 * s),
    baseSvg: svgBuffer(`
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="phoneShadow" x="-30%" y="-20%" width="170%" height="150%">
            <feDropShadow dx="${Math.round(-18 * s)}" dy="${Math.round(24 * s)}" stdDeviation="${Math.round(22 * s)}" flood-color="#05150e" flood-opacity="0.30"/>
          </filter>
        </defs>
        <g filter="url(#phoneShadow)">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#101615"/>
          <rect x="${x + stroke / 2}" y="${y + stroke / 2}" width="${w - stroke}" height="${h - stroke}" rx="${r - stroke / 2}" fill="#2b2d2c"/>
          <rect x="${x + stroke}" y="${y + stroke}" width="${w - stroke * 2}" height="${h - stroke * 2}" rx="${r - stroke}" fill="#050706"/>
        </g>
      </svg>
    `),
    overlaySvg: svgBuffer(`
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${x + Math.round(9 * s)}" y="${y + Math.round(9 * s)}" width="${w - Math.round(18 * s)}" height="${h - Math.round(18 * s)}" rx="${r - Math.round(9 * s)}" fill="none" stroke="#111817" stroke-width="${Math.round(14 * s)}"/>
      </svg>
    `),
  };
}

async function renderCreative(creative: Creative, size: number, quality: number) {
  const screenshotPath = await resolveScreenshotPath(creative.screenshot);
  const frame = phoneFrameSvg(size);

  const screenshot = await roundedImage(
    await fs.readFile(screenshotPath),
    frame.screenW,
    frame.screenH,
    frame.radius,
    'contain',
  );

  const iconSize = Math.round(86 * (size / 1200));
  const icon = await roundedImage(await fs.readFile(iconPath), iconSize, iconSize, Math.round(20 * (size / 1200)));

  const png = await sharp(backgroundSvg(size, creative))
    .composite([
      { input: icon, left: Math.round(86 * (size / 1200)), top: Math.round(54 * (size / 1200)) },
      { input: frame.baseSvg, left: 0, top: 0 },
      { input: screenshot, left: frame.screenX, top: frame.screenY },
      { input: frame.overlaySvg, left: 0, top: 0 },
    ])
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  await fs.mkdir(outputDir, { recursive: true });
  const outPath = path.join(outputDir, `xads-real-${creative.slug}-${size}.jpg`);
  await fs.writeFile(outPath, png);
  return outPath;
}

async function resolveScreenshotPath(fileName: string) {
  const capturedPath = path.join(captureRoot, fileName);
  if (await exists(capturedPath)) return capturedPath;

  const fallbackMap: Record<string, string> = {
    'marketing-summary.png': 'resumo.png',
    'marketing-comparison.png': 'graficos.png',
    'marketing-fgts.png': 'fgts.png',
    'marketing-export-pdf.png': 'exportar.png',
  };
  return path.join(screenshotRoot, fallbackMap[fileName] ?? fileName);
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const written: string[] = [];
  for (const creative of creatives) {
    for (const output of outputs) {
      written.push(await renderCreative(creative, output.size, output.quality));
    }
  }

  console.log('X Ads assets written:');
  for (const file of written) {
    const stat = await fs.stat(file);
    console.log(`- ${path.relative(repoRoot, file)} (${(stat.size / 1024 / 1024).toFixed(2)} MiB)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
