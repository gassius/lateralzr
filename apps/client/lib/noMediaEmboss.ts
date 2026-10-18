/**
 * No-media / missing-description blind Paper emboss (Lz-58 / guide §9.4).
 *
 * Mirrors the front encounter variant horizontally, paints the Paper relief
 * recipe, never glows, and stays out of the accessibility tree.
 */

import { decorative, pattern } from '@/theme/tokens';
import { color } from '@/theme/tokens';

export const NO_MEDIA_EMBOSS = pattern.noMediaEmboss;

export type NoMediaEmbossHeight = {
  height: number;
  fadeStart: number;
};

/** Height of the emboss band: ≤ 55% of the card, ≥ 24 px above first text. */
export function resolveNoMediaEmbossHeight(options: {
  cardHeight: number;
  firstTextY: number | null;
  maxHeightRatio?: number;
  fadeRatio?: number;
  minGapAboveTextPx?: number;
}): NoMediaEmbossHeight {
  const maxHeightRatio = options.maxHeightRatio ?? NO_MEDIA_EMBOSS.maxHeightRatio;
  const fadeRatio = options.fadeRatio ?? NO_MEDIA_EMBOSS.fadeRatio;
  const minGap = options.minGapAboveTextPx ?? NO_MEDIA_EMBOSS.minGapAboveTextPx;
  if (options.cardHeight <= 0) {
    return { height: 0, fadeStart: 0 };
  }
  const maxByRatio = options.cardHeight * maxHeightRatio;
  // 0 / negative / NaN come from measureInWindow on a hidden flipped face.
  const measuredTextY =
    options.firstTextY != null && Number.isFinite(options.firstTextY) && options.firstTextY > minGap
      ? options.firstTextY
      : null;
  const maxByText = measuredTextY != null ? measuredTextY - minGap : maxByRatio;
  const height = Math.max(0, Math.min(maxByRatio, maxByText));
  return {
    height,
    fadeStart: height * (1 - fadeRatio),
  };
}

/**
 * Recolor a front-pattern SVG as the Paper blind emboss and strip the glow.
 * The caller mirrors horizontally in the view.
 */
export function buildNoMediaEmbossXml(frontXml: string): string {
  const paper = decorative.reliefPaper;
  let xml = frontXml;
  xml = xml.replace(/id="card-fill"[^>]*fill="[^"]+"/, `id="card-fill" width="358" height="560" fill="${color.paper}"`);
  xml = xml.replace(/<rect width="358" height="560" fill="#F78D1E"\/>/, `<rect width="358" height="560" fill="${color.paper}"/>`);
  xml = xml.replace(/fill="#F78D1E"/g, `fill="${color.paper}"`);
  xml = xml.replace(
    /id="relief-shade"[^>]*>/,
    `id="relief-shade" fill="${paper.shade}" fill-opacity="${paper.shadeAlpha}" stroke="${paper.shade}" stroke-opacity="${paper.shadeAlpha}" transform="translate(-0.6 -0.6)">`,
  );
  xml = xml.replace(
    /id="relief-highlight"[^>]*>/,
    `id="relief-highlight" fill="${paper.highlight}" fill-opacity="${paper.highlightAlpha}" stroke="${paper.highlight}" stroke-opacity="${paper.highlightAlpha}" transform="translate(0.7 0.7)">`,
  );
  xml = xml.replace(
    /id="relief-core"[^>]*>/,
    `id="relief-core" fill="${paper.core}" fill-opacity="${paper.coreAlpha}" stroke="${paper.core}" stroke-opacity="${paper.coreAlpha}">`,
  );
  xml = xml.replace(/<g id="connectors"[\s\S]*?<\/g>\s*<rect id="title-clear-area"/, '<rect id="title-clear-area"');
  xml = xml.replace(
    /<desc>[\s\S]*?<\/desc>/,
    '<desc>Blind Paper emboss of the front pattern network. Glow layer stripped. Decorative: aria-hidden.</desc>',
  );
  xml = xml.replace(/#FFC98A/g, color.paper);
  xml = xml.replace(/data-variant="([^"]+)"/, 'data-variant="$1" data-emboss="paper"');
  return xml;
}
