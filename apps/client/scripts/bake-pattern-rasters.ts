/**
 * Build-time SVG → WebP for card backgrounds (no react-native-svg at runtime).
 *
 * Front bakes hide motifs intersecting the SVG default `#title-clear-area`
 * (same as PatternLayer pulseXml / hideMotifsInPatternSvg).
 * Also bakes soft glow sprites (Gaussian blur) for the connector pulse overlay.
 *
 * Usage: pnpm bake:patterns
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import {
  defaultTitleClearForVariant,
  hideMotifsInPatternSvg,
  motifsIntersectingClearArea,
  patternSvgForVariant,
  type PatternVariantIndex,
} from '../lib/patternPlacement.ts';
import { buildNoMediaEmbossXml } from '../lib/noMediaEmboss.ts';
import {
  PATTERN_BAKE_PIXEL,
  PATTERN_BAKE_SCALE,
  PATTERN_CARD_UNITS,
  PATTERN_PULSE_GLOW_FILL,
} from '../theme/pattern.ts';
import { color } from '../theme/tokens.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'assets/images/pattern/baked');

const SCALE = PATTERN_BAKE_SCALE;
const OUT_W = PATTERN_BAKE_PIXEL.width;
const OUT_H = PATTERN_BAKE_PIXEL.height;
const WEBP_QUALITY = 82;

const VARIANT_KEYS = ['01', '02', '03'] as const;

async function svgToWebp(svgXml: string, outPath: string, width: number): Promise<number> {
  const resvg = new Resvg(svgXml, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
  });
  const png = resvg.render().asPng();
  await sharp(png).webp({ quality: WEBP_QUALITY, alphaQuality: 90 }).toFile(outPath);
  return readFileSync(outPath).length;
}

/**
 * Soft horizontal glow stroke (blurred) — stretched/rotated at runtime.
 * Mirrors CONNECTOR_GLOW_LINE_EXTRAS stacked halos (+2/+4/+6) with a blur.
 */
function softGlowLineSvg(): string {
  const w = 256;
  const h = 64;
  const cy = h / 2;
  const fill = PATTERN_PULSE_GLOW_FILL;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="b" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <line x1="12" y1="${cy}" x2="${w - 12}" y2="${cy}" stroke="${fill}" stroke-width="14" stroke-linecap="round" filter="url(#b)" stroke-opacity="0.35"/>
  <line x1="12" y1="${cy}" x2="${w - 12}" y2="${cy}" stroke="${fill}" stroke-width="8" stroke-linecap="round" filter="url(#b)" stroke-opacity="0.55"/>
  <line x1="12" y1="${cy}" x2="${w - 12}" y2="${cy}" stroke="${fill}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.95"/>
</svg>`;
}

/**
 * Soft terminal node disc with blur halo.
 * Core radius 5 maps to geometry.endR at runtime (nodeSize = endR * 2 * 64/10).
 */
function softGlowNodeSvg(): string {
  const s = 64;
  const c = s / 2;
  const fill = PATTERN_PULSE_GLOW_FILL;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <filter id="b" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="3.2"/>
    </filter>
  </defs>
  <circle cx="${c}" cy="${c}" r="14" fill="${fill}" filter="url(#b)" fill-opacity="0.35"/>
  <circle cx="${c}" cy="${c}" r="9" fill="${fill}" filter="url(#b)" fill-opacity="0.55"/>
  <circle cx="${c}" cy="${c}" r="5" fill="${fill}"/>
</svg>`;
}

/** Vertical paper fade using theme `color.paper`. */
function paperFadeSvg(): string {
  const paper = color.paper;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1" height="256" viewBox="0 0 1 256">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${paper}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${paper}" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect width="1" height="256" fill="url(#f)"/>
</svg>`;
}

async function main(): Promise<void> {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const files: Array<{
    index: number;
    key: string;
    front: string;
    emboss: string;
    hiddenMotifs: string[];
  }> = [];

  for (let i = 0; i < 3; i += 1) {
    const variant = i as PatternVariantIndex;
    const key = VARIANT_KEYS[i]!;
    const clear = defaultTitleClearForVariant(variant);
    const hidden = motifsIntersectingClearArea(variant, clear);
    const frontXml = hideMotifsInPatternSvg(patternSvgForVariant(variant), hidden);
    const embossXml = buildNoMediaEmbossXml(patternSvgForVariant(variant));

    const frontName = `pattern-${key}-${SCALE}x.webp`;
    const embossName = `emboss-${key}-${SCALE}x.webp`;
    const frontBytes = await svgToWebp(frontXml, path.join(outDir, frontName), OUT_W);
    const embossBytes = await svgToWebp(embossXml, path.join(outDir, embossName), OUT_W);
    console.log(`wrote ${frontName} (${frontBytes} B) clearMotifs=${hidden.length}`);
    console.log(`wrote ${embossName} (${embossBytes} B)`);
    files.push({ index: i, key, front: frontName, emboss: embossName, hiddenMotifs: hidden });
  }

  const glowLine = 'glow-line-soft.webp';
  const glowNode = 'glow-node-soft.webp';
  console.log(
    `wrote ${glowLine} (${await svgToWebp(softGlowLineSvg(), path.join(outDir, glowLine), 256)} B)`,
  );
  console.log(
    `wrote ${glowNode} (${await svgToWebp(softGlowNodeSvg(), path.join(outDir, glowNode), 64)} B)`,
  );
  const fadeName = 'paper-fade-vertical.webp';
  console.log(
    `wrote ${fadeName} (${await svgToWebp(paperFadeSvg(), path.join(outDir, fadeName), 1)} B)`,
  );

  const manifest = {
    cardUnits: { ...PATTERN_CARD_UNITS },
    scale: SCALE,
    pixelSize: { width: OUT_W, height: OUT_H },
    paper: color.paper,
    format: 'webp',
    variants: files.map(({ index, key, front, emboss, hiddenMotifs }) => ({
      index,
      key,
      front,
      emboss,
      defaultClearHiddenMotifs: hiddenMotifs,
    })),
    glowLine,
    glowNode,
    paperFade: fadeName,
  };
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('done', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
