/**
 * Build-time SVG → PNG for card backgrounds (no react-native-svg at runtime).
 * Writes @3× (1074×1680) WebP-friendly PNGs under assets/images/pattern/baked/.
 *
 * Usage: node apps/client/scripts/bake-pattern-rasters.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const patternDir = path.join(root, 'assets/images/pattern');
const outDir = path.join(patternDir, 'baked');

const CARD_W = 358;
const CARD_H = 560;
/** Display density bake — covers 3× phone DPR for the design card. */
const SCALE = 3;
const OUT_W = CARD_W * SCALE;
const OUT_H = CARD_H * SCALE;

const FILES = [
  { key: '01', file: 'lateralzr-pattern-01-descending-current.svg' },
  { key: '02', file: 'lateralzr-pattern-02-ascending-current.svg' },
  { key: '03', file: 'lateralzr-pattern-03-edge-current.svg' },
];

/** Paper emboss recipe (mirrors lib/noMediaEmboss.ts + theme tokens.json). */
const PAPER = '#F5F1E8';
const RELIEF = {
  shade: '#CFC6B6',
  shadeAlpha: '0.55',
  highlight: '#FFFFFF',
  highlightAlpha: '0.85',
  core: '#ECE6DA',
  coreAlpha: '0.55',
};

function buildEmbossXml(frontXml) {
  let xml = frontXml;
  xml = xml.replace(
    /id="card-fill"[^>]*fill="[^"]+"/,
    `id="card-fill" width="358" height="560" fill="${PAPER}"`,
  );
  xml = xml.replace(
    /<rect width="358" height="560" fill="#F78D1E"\/>/,
    `<rect width="358" height="560" fill="${PAPER}"/>`,
  );
  xml = xml.replace(/fill="#F78D1E"/g, `fill="${PAPER}"`);
  xml = xml.replace(
    /id="relief-shade"[^>]*>/,
    `id="relief-shade" fill="${RELIEF.shade}" fill-opacity="${RELIEF.shadeAlpha}" stroke="${RELIEF.shade}" stroke-opacity="${RELIEF.shadeAlpha}" transform="translate(-0.6 -0.6)">`,
  );
  xml = xml.replace(
    /id="relief-highlight"[^>]*>/,
    `id="relief-highlight" fill="${RELIEF.highlight}" fill-opacity="${RELIEF.highlightAlpha}" stroke="${RELIEF.highlight}" stroke-opacity="${RELIEF.highlightAlpha}" transform="translate(0.7 0.7)">`,
  );
  xml = xml.replace(
    /id="relief-core"[^>]*>/,
    `id="relief-core" fill="${RELIEF.core}" fill-opacity="${RELIEF.coreAlpha}" stroke="${RELIEF.core}" stroke-opacity="${RELIEF.coreAlpha}">`,
  );
  xml = xml.replace(
    /<g id="connectors"[\s\S]*?<\/g>\s*<rect id="title-clear-area"/,
    '<rect id="title-clear-area"',
  );
  xml = xml.replace(/#FFC98A/g, PAPER);
  return xml;
}

/** 1×256 vertical fade: transparent → paper (emboss / media seam). */
function bakePaperFadePng() {
  const w = 1;
  const h = 256;
  // Minimal RGBA PNG via resvg of a tiny SVG gradient.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PAPER}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${PAPER}" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#f)"/>
</svg>`;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: w },
  });
  return resvg.render().asPng();
}

function rasterize(svgXml) {
  const resvg = new Resvg(svgXml, {
    fitTo: { mode: 'width', value: OUT_W },
    background: 'transparent',
  });
  const rendered = resvg.render();
  if (rendered.width !== OUT_W) {
    console.warn(`unexpected width ${rendered.width} (wanted ${OUT_W})`);
  }
  return rendered.asPng();
}

mkdirSync(outDir, { recursive: true });

for (const { key, file } of FILES) {
  const svgPath = path.join(patternDir, file);
  const frontXml = readFileSync(svgPath, 'utf8');
  const frontPng = rasterize(frontXml);
  const embossPng = rasterize(buildEmbossXml(frontXml));
  // Avoid Metro `@Nx` density suffixes in filenames — use `-3x` instead.
  const frontOut = path.join(outDir, `pattern-${key}-${SCALE}x.png`);
  const embossOut = path.join(outDir, `emboss-${key}-${SCALE}x.png`);
  writeFileSync(frontOut, frontPng);
  writeFileSync(embossOut, embossPng);
  console.log(`wrote ${path.relative(root, frontOut)} (${frontPng.length} B)`);
  console.log(`wrote ${path.relative(root, embossOut)} (${embossPng.length} B)`);
}

const fadePng = bakePaperFadePng();
const fadeOut = path.join(outDir, 'paper-fade-vertical.png');
writeFileSync(fadeOut, fadePng);
console.log(`wrote ${path.relative(root, fadeOut)} (${fadePng.length} B)`);

const manifest = {
  cardUnits: { width: CARD_W, height: CARD_H },
  scale: SCALE,
  pixelSize: { width: OUT_W, height: OUT_H },
  variants: FILES.map((f, i) => ({
    index: i,
    key: f.key,
    front: `pattern-${f.key}-${SCALE}x.png`,
    emboss: `emboss-${f.key}-${SCALE}x.png`,
  })),
  paperFade: 'paper-fade-vertical.png',
};
writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('done');
