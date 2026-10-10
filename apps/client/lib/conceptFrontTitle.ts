import { color, type } from '../theme/tokens';

/**
 * Card-front concept title (Lz-26 / Art Direction v3.3 §7.3 + §6.1).
 *
 * Left-aligned in the pattern-master title clear area. Default size is
 * `type.concept` (32). Concept teal on orange is contrast-safe only at
 * ≥ `type.conceptMinOnOrange` (24); below that, fall back to ink.
 *
 * Wrap policy (art director / §7.3): never split a word without a visible hyphen.
 * Prefer space wraps; if a word overflows at 32, step size down to 24; only
 * then insert `-\n`. Prefer ≤ {@link CONCEPT_FRONT_TITLE_MAX_LINES} lines —
 * shrink toward 24 (teal floor), then let the face scroll. Never shrink below
 * 24 to preserve large-text settings (§7.2). Pattern clearing (Lz-25) consumes
 * the title rect.
 */

export const CONCEPT_FRONT_TITLE_FONT_SIZE = type.concept;

export const CONCEPT_FRONT_TITLE_MIN_ON_ORANGE = type.conceptMinOnOrange;

export const CONCEPT_FRONT_TITLE_TEXT_ALIGN = 'left' as const;

/** Line-height ratio for the front title (v3.3 concept role). */
export const CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO = 1.15;

/**
 * §7.3 / Lz-26: 3–4 lines allowed. When a space wrap exceeds this, shrink
 * toward 24 before relying on face scroll (never below the teal floor).
 */
export const CONCEPT_FRONT_TITLE_MAX_LINES = 4;

/** Visible hyphen used when a word still overflows at the 24 px floor. */
export const CONCEPT_FRONT_TITLE_HYPHEN = '-';

/** Preferred breathing room below the title block inside the face (px). */
export const CONCEPT_FRONT_TITLE_BOTTOM_RESERVE = 48;

/**
 * RN Web `Text` default (`font: '14px System'` → createReactDOMStyle SYSTEM_FONT_STACK).
 * Must match the rendered title face — not bare `system-ui`, which over-measures on CI.
 */
export const CONCEPT_FRONT_TITLE_FONT_STACK =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';

/**
 * Fallback advance when DOM/canvas measure is unavailable.
 * Calibrated to Liberation Sans Bold (~231 px for "extraordinariamente" at 24).
 */
export const CONCEPT_FRONT_TITLE_CHAR_WIDTH_RATIO = 0.51;

/**
 * Pattern-master `#title-clear-area` in card design units (358×560).
 * Lz-25 clears pattern ink around this box; layout here anchors into it.
 */
export const TITLE_CLEAR_AREA = {
  cardWidth: 358,
  cardHeight: 560,
  x: 20,
  y: 236,
  width: 318,
  height: 168,
} as const;

/** First baseline ≈ 52% of face height (Critiquito / pattern master). */
export const CONCEPT_FRONT_TITLE_BASELINE_RATIO = 0.52;

/**
 * Fraction of face height above the title block so a short one-liner’s
 * first baseline lands near {@link CONCEPT_FRONT_TITLE_BASELINE_RATIO}.
 * Long titles shrink this spacer so the block can rise and never clip.
 */
export const CONCEPT_FRONT_TITLE_TOP_RATIO = 0.47;

export type ConceptFrontTitleRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Soft-wrap line count in a layout `displayText` (hyphen breaks count). */
export function conceptFrontTitleLineCount(displayText: string): number {
  if (displayText.length === 0) return 0;
  return displayText.split('\n').length;
}

/**
 * Top spacer height: prefer the lower-middle anchor, but shrink so the title
 * block fits in the face without clipping at default text size.
 */
export function conceptFrontTitleTopSpacerHeight(
  faceHeight: number,
  titleBlockHeight: number,
  bottomReserve: number = CONCEPT_FRONT_TITLE_BOTTOM_RESERVE,
): number {
  if (faceHeight <= 0) return 0;
  const preferred = Math.round(faceHeight * CONCEPT_FRONT_TITLE_TOP_RATIO);
  const maxTop = Math.max(0, Math.round(faceHeight - titleBlockHeight - bottomReserve));
  return Math.min(preferred, maxTop);
}

/**
 * Bottom spacer min height: keep the preferred reserve when the title is short;
 * collapse toward 0 so a tall title (e.g. 200% text) is not clipped by the
 * fixed 48 px band after the top spacer has already shrunk to 0.
 */
export function conceptFrontTitleBottomSpacerMinHeight(
  faceHeight: number,
  titleBlockHeight: number,
  topSpacerHeight: number,
  preferredReserve: number = CONCEPT_FRONT_TITLE_BOTTOM_RESERVE,
): number {
  if (faceHeight <= 0) return 0;
  const available = Math.max(
    0,
    Math.round(faceHeight - titleBlockHeight - Math.max(0, topSpacerHeight)),
  );
  return Math.min(Math.max(0, preferredReserve), available);
}

/**
 * Title colour for a given rendered px size (after any shrink × font scale).
 * Concept teal at ≥24; ink below.
 */
export function titleColor(renderedSize: number): string {
  return renderedSize >= CONCEPT_FRONT_TITLE_MIN_ON_ORANGE ? color.concept : color.ink;
}

/**
 * Effective rendered size for contrast: layout fontSize × OS font scale.
 * Callers pass `PixelRatio.getFontScale()` (default 1 for unit tests).
 */
export function conceptFrontTitleRenderedSize(
  fontSize: number = CONCEPT_FRONT_TITLE_FONT_SIZE,
  fontScale: number = 1,
): number {
  return fontSize * fontScale;
}

/** Default (unscaled) front-title colour at the concept token size. */
export const CONCEPT_FRONT_TITLE_COLOR = titleColor(CONCEPT_FRONT_TITLE_FONT_SIZE);

export type MeasureTitleWidth = (text: string, fontSize: number) => number;

export type ConceptFrontTitleLayout = {
  /** Text shown on the face (may include `-\n` soft wraps). */
  displayText: string;
  fontSize: number;
  lineHeight: number;
};

/** Painted title block height for a layout at the given display font scale. */
export function conceptFrontTitleBlockHeight(
  layout: ConceptFrontTitleLayout,
  displayScale: number = 1,
): number {
  const scale = displayScale > 0 ? displayScale : 1;
  const lines = conceptFrontTitleLineCount(layout.displayText);
  const displayLineHeight = Math.round(layout.lineHeight * scale);
  return lines * displayLineHeight;
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureHost: HTMLSpanElement | null = null;

/**
 * Width of `text` at `fontSize` / weight 700 using the RN Web System stack.
 * Prefers a DOM span (same metrics as rendered Text); canvas fallback uses the
 * same family string. Native/SSR: Liberation-calibrated approx.
 */
export function measureConceptFrontTitleWidth(text: string, fontSize: number): number {
  if (text.length === 0) return 0;
  if (typeof document !== 'undefined' && document.body) {
    try {
      measureHost ??= document.createElement('span');
      const el = measureHost;
      el.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'visibility:hidden',
        'pointer-events:none',
        'white-space:pre',
        `font-family:${CONCEPT_FRONT_TITLE_FONT_STACK}`,
        'font-weight:700',
        `font-size:${fontSize}px`,
        'font-style:normal',
        'letter-spacing:normal',
        'padding:0',
        'margin:0',
        'border:0',
      ].join(';');
      el.textContent = text;
      if (!el.isConnected) document.body.appendChild(el);
      const width = el.getBoundingClientRect().width;
      if (width > 0) return width;
    } catch {
      // fall through
    }
    try {
      measureCanvas ??= document.createElement('canvas');
      const ctx = measureCanvas.getContext('2d');
      if (ctx) {
        ctx.font = `700 ${fontSize}px ${CONCEPT_FRONT_TITLE_FONT_STACK}`;
        return ctx.measureText(text).width;
      }
    } catch {
      // fall through to approx
    }
  }
  return text.length * fontSize * CONCEPT_FRONT_TITLE_CHAR_WIDTH_RATIO;
}

function tokenizeTitle(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

function isWhitespace(token: string): boolean {
  return /^\s+$/.test(token);
}

/** Greedy wrap at whitespace only — never splits a token. Soft breaks end with a space. */
export function wrapTitleAtSpaces(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: MeasureTitleWidth,
): string | null {
  const tokens = tokenizeTitle(text);
  const lines: string[] = [];
  let line = '';

  for (const token of tokens) {
    if (isWhitespace(token)) {
      if (line.length > 0) line += token;
      continue;
    }
    if (measure(token, fontSize) > maxWidth + 0.01) {
      return null;
    }
    const candidate = line.length === 0 ? token : `${line}${token}`;
    if (line.length > 0 && measure(candidate.replace(/\s+$/u, ''), fontSize) > maxWidth + 0.01) {
      // Trailing space marks a word-boundary break (M1: every \\n follows `-` or space).
      lines.push(`${line.replace(/\s+$/u, '')} `);
      line = token;
    } else {
      line = candidate;
    }
  }
  if (line.length > 0) lines.push(line.replace(/\s+$/u, ''));
  return lines.join('\n');
}

/**
 * Split one overflowing word with a visible hyphen + newline.
 * Prefers the longest prefix that still fits `prefix + '-'`.
 */
export function hyphenateWord(
  word: string,
  maxWidth: number,
  fontSize: number,
  measure: MeasureTitleWidth,
): string {
  if (measure(word, fontSize) <= maxWidth + 0.01) return word;
  if (word.length < 2) return word;

  const chunks: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    if (measure(rest, fontSize) <= maxWidth + 0.01) {
      chunks.push(rest);
      break;
    }
    let cut = rest.length - 1;
    while (cut >= 1) {
      const head = rest.slice(0, cut);
      if (measure(`${head}${CONCEPT_FRONT_TITLE_HYPHEN}`, fontSize) <= maxWidth + 0.01) {
        chunks.push(`${head}${CONCEPT_FRONT_TITLE_HYPHEN}`);
        rest = rest.slice(cut);
        break;
      }
      cut -= 1;
    }
    if (cut < 1) {
      // Pathological: even one glyph + hyphen overflows — emit one char and continue.
      chunks.push(`${rest.slice(0, 1)}${CONCEPT_FRONT_TITLE_HYPHEN}`);
      rest = rest.slice(1);
    }
  }
  return chunks.join('\n');
}

/** Wrap at spaces; hyphenate any token that still exceeds `maxWidth`. */
export function wrapTitleWithHyphens(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: MeasureTitleWidth,
): string {
  const tokens = tokenizeTitle(text);
  const lines: string[] = [];
  let line = '';

  const flush = () => {
    if (line.length > 0) {
      lines.push(line.replace(/\s+$/u, ''));
      line = '';
    }
  };

  for (const token of tokens) {
    if (isWhitespace(token)) {
      if (line.length > 0) line += token;
      continue;
    }
    if (measure(token, fontSize) <= maxWidth + 0.01) {
      const candidate = line.length === 0 ? token : `${line}${token}`;
      if (line.length > 0 && measure(candidate.replace(/\s+$/u, ''), fontSize) > maxWidth + 0.01) {
        lines.push(`${line.replace(/\s+$/u, '')} `);
        line = token;
      } else {
        line = candidate;
      }
      continue;
    }
    flush();
    const hyphenated = hyphenateWord(token, maxWidth, fontSize, measure);
    const parts = hyphenated.split('\n');
    for (let i = 0; i < parts.length; i += 1) {
      if (i < parts.length - 1) {
        lines.push(parts[i]!);
      } else {
        line = parts[i]!;
      }
    }
  }
  flush();
  return lines.join('\n');
}

/**
 * Pick font size (32→24) and display string.
 * Shrink before hyphenating; never mid-word break without a visible `-`.
 * Prefer ≤ {@link CONCEPT_FRONT_TITLE_MAX_LINES} lines (shrink toward 24 first),
 * then let the face scroll — never shrink below the teal floor (§7.2).
 *
 * `fontScale` is passed into measure as `size × fontScale` (OS / e2e glyph scale).
 * Returned `fontSize` / `lineHeight` stay unscaled for the Text style (#82).
 */
export function layoutConceptFrontTitle(
  text: string,
  maxWidth: number,
  measure: MeasureTitleWidth = measureConceptFrontTitleWidth,
  maxFontSize: number = CONCEPT_FRONT_TITLE_FONT_SIZE,
  minFontSize: number = CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
  fontScale: number = 1,
): ConceptFrontTitleLayout {
  const width = Math.max(0, maxWidth);
  const scale = fontScale > 0 ? fontScale : 1;
  const scaledMeasure: MeasureTitleWidth = (t, size) => measure(t, size * scale);

  if (width <= 0 || text.length === 0) {
    return {
      displayText: text,
      fontSize: maxFontSize,
      lineHeight: Math.round(maxFontSize * CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO),
    };
  }

  /** Last space-wrap that worked (may exceed max lines); prefers smaller size. */
  let overflowFallback: ConceptFrontTitleLayout | null = null;

  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    const wrapped = wrapTitleAtSpaces(text, width, size, scaledMeasure);
    if (wrapped == null) continue;
    const layout: ConceptFrontTitleLayout = {
      displayText: wrapped,
      fontSize: size,
      lineHeight: Math.round(size * CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO),
    };
    if (conceptFrontTitleLineCount(wrapped) <= CONCEPT_FRONT_TITLE_MAX_LINES) {
      return layout;
    }
    overflowFallback = layout;
  }

  if (overflowFallback != null) {
    return overflowFallback;
  }

  const fontSize = minFontSize;
  return {
    displayText: wrapTitleWithHyphens(text, width, fontSize, scaledMeasure),
    fontSize,
    lineHeight: Math.round(fontSize * CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO),
  };
}

// --- Native onTextLayout measure (once per title+width+fontScale; no resize loop) ---

/** Wait before showing the approx-measure fallback if onTextLayout never fires. */
export const NATIVE_TITLE_MEASURE_FALLBACK_MS = 100;

export type NativeTitleTextLayoutLine = {
  text: string;
  width: number;
};

/**
 * Cache key: title + content width + fontScale.
 * OS text-size changes (fontScale) invalidate like a width change.
 */
export function nativeTitleMeasureCacheKey(
  title: string,
  maxWidth: number,
  fontScale: number = 1,
): string {
  return `${title}\0${Math.round(maxWidth * 100) / 100}\0${Math.round(fontScale * 1000) / 1000}`;
}

const nativeTitleLayoutCache = new Map<string, ConceptFrontTitleLayout>();

/** Test hook — clears the native layout cache. */
export function clearNativeTitleMeasureCache(): void {
  nativeTitleLayoutCache.clear();
}

export function getCachedNativeTitleLayout(
  title: string,
  maxWidth: number,
  fontScale: number = 1,
): ConceptFrontTitleLayout | null {
  return (
    nativeTitleLayoutCache.get(nativeTitleMeasureCacheKey(title, maxWidth, fontScale)) ?? null
  );
}

/** One word per line so `onTextLayout` reports each token width. */
export function conceptFrontTitleNativeProbeText(title: string): string {
  return title.split(/\s+/u).filter((part) => part.length > 0).join('\n');
}

/**
 * Build a width measure from probe lines (each line = one word at `probeFontSize`).
 * Composite phrases sum token widths + an estimated space.
 */
export function measureFromNativeTextLayoutLines(
  lines: readonly NativeTitleTextLayoutLine[],
  probeFontSize: number,
): MeasureTitleWidth {
  const widths = new Map<string, number>();
  for (const line of lines) {
    const token = line.text.replace(/\n$/u, '');
    if (token.length > 0) widths.set(token, line.width);
  }
  const spaceWidth = probeFontSize * CONCEPT_FRONT_TITLE_CHAR_WIDTH_RATIO * 0.35;

  return (text, fontSize) => {
    if (text.length === 0) return 0;
    const scale = probeFontSize > 0 ? fontSize / probeFontSize : 1;
    if (widths.has(text)) return widths.get(text)! * scale;

    let total = 0;
    for (const part of text.split(/(\s+)/u)) {
      if (part.length === 0) continue;
      if (/^\s+$/u.test(part)) {
        total += spaceWidth * part.length * scale;
        continue;
      }
      const known = widths.get(part);
      if (known != null) total += known * scale;
      else total += part.length * fontSize * CONCEPT_FRONT_TITLE_CHAR_WIDTH_RATIO;
    }
    return total;
  };
}

export type ApplyNativeTitleTextLayoutResult = {
  /** True only the first time this title+width is measured. */
  applied: boolean;
  layout: ConceptFrontTitleLayout;
};

/**
 * Consume one native `onTextLayout`. Caches by title+width+fontScale and never
 * overwrites — later calls (including after the chosen font size is applied) are no-ops.
 *
 * Probe widths must be unscaled (`allowFontScaling={false}` on the probe Text).
 * Pass the full `measureFontScale` (OS × e2e) here once — never bake OS scale
 * into the probe widths and again into `fontScale` (B1 / #82).
 */
export function applyNativeTitleTextLayoutOnce(args: {
  title: string;
  maxWidth: number;
  lines: readonly NativeTitleTextLayoutLine[];
  probeFontSize?: number;
  fontScale?: number;
}): ApplyNativeTitleTextLayoutResult {
  const {
    title,
    maxWidth,
    lines,
    probeFontSize = CONCEPT_FRONT_TITLE_FONT_SIZE,
    fontScale = 1,
  } = args;
  const key = nativeTitleMeasureCacheKey(title, maxWidth, fontScale);
  const cached = nativeTitleLayoutCache.get(key);
  if (cached != null) {
    return { applied: false, layout: cached };
  }

  const measure = measureFromNativeTextLayoutLines(lines, probeFontSize);
  const layout = layoutConceptFrontTitle(
    title,
    maxWidth,
    measure,
    CONCEPT_FRONT_TITLE_FONT_SIZE,
    CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
    fontScale,
  );
  nativeTitleLayoutCache.set(key, layout);
  return { applied: true, layout };
}

/**
 * Approx layout used when onTextLayout never fires (B2). Not written into the
 * onTextLayout cache — a late probe may still populate the cache without
 * resizing a title that already showed this fallback.
 */
export function nativeTitleFallbackLayout(
  title: string,
  maxWidth: number,
  fontScale: number = 1,
): ConceptFrontTitleLayout {
  return layoutConceptFrontTitle(
    title,
    maxWidth,
    measureConceptFrontTitleWidth,
    CONCEPT_FRONT_TITLE_FONT_SIZE,
    CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
    fontScale,
  );
}

/**
 * Whether a newly measured layout may replace the visible title.
 * Once a fallback is on screen, late onTextLayout only updates the cache.
 * A new title/width/fontScale key clears the fallback flag (caller).
 */
export function shouldCommitNativeTitleLayoutToView(fallbackVisible: boolean): boolean {
  return !fallbackVisible;
}

export type NativeFrontTitlePresentation = {
  /** 0 until measured or fallback; 1 with a committed layout (no 32→final jump). */
  opacity: 0 | 1;
  layout: ConceptFrontTitleLayout | null;
  /** Keep probing until the onTextLayout cache has this key (even after fallback). */
  shouldProbe: boolean;
};

/**
 * Native presentation from cache. Opacity for the live view also follows a
 * committed fallback via the caller's state; this helper is cache-centric.
 */
export function resolveNativeFrontTitlePresentation(
  title: string,
  maxWidth: number,
  fontScale: number = 1,
): NativeFrontTitlePresentation {
  if (maxWidth <= 0 || title.length === 0) {
    return { opacity: 0, layout: null, shouldProbe: false };
  }
  const cached = getCachedNativeTitleLayout(title, maxWidth, fontScale);
  if (cached != null) {
    return { opacity: 1, layout: cached, shouldProbe: false };
  }
  return { opacity: 0, layout: null, shouldProbe: true };
}
