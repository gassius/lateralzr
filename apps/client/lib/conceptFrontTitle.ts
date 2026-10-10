import { color, type } from '../theme/tokens';

/**
 * Card-front concept title (Lz-26 / Art Direction v3.3 §7.3 + §6.1).
 *
 * Left-aligned in the pattern-master title clear area. Default size is
 * `type.concept` (32). Concept teal on orange is contrast-safe only at
 * ≥ `type.conceptMinOnOrange` (24); below that, fall back to ink.
 *
 * Wrap policy (art director): never split a word without a visible hyphen.
 * Prefer space wraps; if a word overflows at 32, step size down to 24; only
 * then insert `-\n`. Pattern clearing (Lz-25) consumes the title rect.
 */

export const CONCEPT_FRONT_TITLE_FONT_SIZE = type.concept;

export const CONCEPT_FRONT_TITLE_MIN_ON_ORANGE = type.conceptMinOnOrange;

export const CONCEPT_FRONT_TITLE_TEXT_ALIGN = 'left' as const;

/** Line-height ratio for the front title (v3.3 concept role). */
export const CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO = 1.15;

/** Visible hyphen used when a word still overflows at the 24 px floor. */
export const CONCEPT_FRONT_TITLE_HYPHEN = '-';

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
 */
export const CONCEPT_FRONT_TITLE_TOP_RATIO = 0.47;

export type ConceptFrontTitleRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    const wrapped = wrapTitleAtSpaces(text, width, size, scaledMeasure);
    if (wrapped != null) {
      return {
        displayText: wrapped,
        fontSize: size,
        lineHeight: Math.round(size * CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO),
      };
    }
  }

  const fontSize = minFontSize;
  return {
    displayText: wrapTitleWithHyphens(text, width, fontSize, scaledMeasure),
    fontSize,
    lineHeight: Math.round(fontSize * CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO),
  };
}
