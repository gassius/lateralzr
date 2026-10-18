/**
 * Card-front connector glow (Lz-58 / guide §11.3).
 *
 * Decorative only: one inter-bulb connector + terminal node. Opacity breath on
 * `#connectors` (#FFC98A). No geometry movement.
 */

import { PATTERN_CARD_UNITS, PATTERN_PULSE_GLOW_FILL } from '@/theme/pattern';
import { motion } from '@/theme/tokens';
import type { PatternRect, PatternVariantIndex } from '@/lib/patternPlacement';
import { PATTERN_VARIANT_PLACEMENTS } from '@/lib/patternVariantPlacements';

/** Peak opacity for the required glow (settled on device inside 0.45–0.60). */
export const CONNECTOR_PULSE_PEAK_OPACITY = motion.glow.peakOpacity;

/** First glow no sooner than this after settle. */
export const CONNECTOR_PULSE_FIRST_DELAY_MS = motion.glow.firstDelayMs;

/** Documented glow fill (warm light orange, never white/cyan). */
export const CONNECTOR_PULSE_GLOW_FILL = PATTERN_PULSE_GLOW_FILL;

export type PulseConnector = {
  id: string;
  motifId: string;
  arm: string;
};

export type ConnectorPulseGate = {
  /** Card finished settle enter (or landed without settle animation). */
  settled: boolean;
  /** Front face showing (not reverse). */
  frontShowing: boolean;
  /** Pan / swipe drag active. */
  dragging: boolean;
  /** Front-face ScrollView is being scrolled. */
  scrolling: boolean;
  /** Laterality / app-menu sheet open. */
  sheetOpen: boolean;
  /** Laterality reshuffle cue in progress (Lz-57; reserved on main). */
  reshuffling?: boolean;
  /** AppState === 'active'. */
  appActive: boolean;
  /** Shared RM gate (OS + web + Lz-46 Motion preference). */
  reduceMotion: boolean;
};

export type ConnectorPulseTiming = {
  cycleMs: readonly [number, number];
  pauseMs: readonly [number, number];
  concurrentPulses: number;
  peakOpacity: number;
  firstDelayMs: number;
};

/** Pin helpers to theme tokens (unit tests). */
export function connectorPulseTiming(): ConnectorPulseTiming {
  const glow = motion.glow;
  return {
    cycleMs: [glow.cycleMs, glow.cycleMs],
    pauseMs: glow.pauseMs,
    concurrentPulses: glow.concurrent,
    peakOpacity: glow.peakOpacity,
    firstDelayMs: glow.firstDelayMs,
  };
}

/**
 * Whether the decorative pulse may run.
 * Fully off under reduced motion / Motion=Reduced (`shouldPulse` token).
 */
export function connectorPulseAllowed(gate: ConnectorPulseGate): boolean {
  if (gate.reduceMotion) return false;
  if (!gate.settled || !gate.frontShowing) return false;
  if (gate.dragging || gate.scrolling || gate.sheetOpen || gate.reshuffling) return false;
  if (!gate.appActive) return false;
  return true;
}

/** Inclusive random integer in `[min, max]`. */
export function randomIntInclusive(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(random() * (hi - lo + 1));
}

export function randomPulseCycleMs(random: () => number = Math.random): number {
  const glow = motion.glow;
  return randomIntInclusive(glow.cycleMs, glow.cycleMs, random);
}

export function randomPulsePauseMs(random: () => number = Math.random): number {
  const [lo, hi] = motion.glow.pauseMs;
  return randomIntInclusive(lo, hi, random);
}

/**
 * Ease-in-out sine opacity for one breath (0 → peak → 0) over `t` in [0, 1].
 */
export function pulseOpacityAt(t: number, peak = CONNECTOR_PULSE_PEAK_OPACITY): number {
  const x = Math.min(1, Math.max(0, t));
  // Half-cycle up, half-cycle down.
  const wave = x <= 0.5 ? x * 2 : (1 - x) * 2;
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * wave);
  return peak * eased;
}

/** Visible pulse groups (skips display="none" from title clearing). */
export function listVisiblePulseConnectors(xml: string): PulseConnector[] {
  const out: PulseConnector[] = [];
  const re =
    /<g\b([^>]*\bdata-connector="(c\d+)"[^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) != null) {
    const attrs = match[1] ?? '';
    const id = match[2] ?? '';
    if (!id || /\bdisplay\s*=\s*["']none["']/.test(attrs)) continue;
    const motif = /\bdata-motif="(m\d+)"/.exec(attrs)?.[1];
    const arm = /\bdata-arm="([^"]+)"/.exec(attrs)?.[1];
    if (!motif || !arm) continue;
    out.push({ id, motifId: motif, arm });
  }
  return out;
}

export type ConnectorGlowLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  /** Terminal node ring the connector ends on — always (`x2`,`y2`), never the bulb centre. */
  endX: number;
  endY: number;
  endR: number;
};

/** Mark node ring in card units (§11.3). Never a whole bulb. */
export const CONNECTOR_GLOW_NODE_R = 2.5;
export const CONNECTOR_GLOW_NODE_R_MAX = 4;

/**
 * Fake a 3 px soft halo without SVG filters.
 * Line extras +2/+4/+6; node rings r+1/+2/+3. Inner → outer opacities.
 * Overlay-only (not the 57 KB pattern).
 */
export const CONNECTOR_GLOW_HALO_OPACITIES = [0.55, 0.35, 0.18] as const;
export const CONNECTOR_GLOW_LINE_EXTRAS = [2, 4, 6] as const;
export const CONNECTOR_GLOW_NODE_RING_EXTRAS = [1, 2, 3] as const;
export const CONNECTOR_GLOW_NODE_RING_STROKE = 2;

/** Core inter-bulb line + terminal node for the UI-thread glow overlay (no SVG rewrite). */
export function readConnectorGlowLine(
  xml: string,
  connectorId: string,
): ConnectorGlowLine | null {
  if (!connectorId) return null;
  const groupRe = new RegExp(
    `<g\\b([^>]*\\bid="${connectorId}"[^>]*)>[\\s\\S]*?<line class="core"([^/]*)/>`,
  );
  const match = groupRe.exec(xml);
  if (!match) return null;
  const attrs = match[2] ?? '';
  const num = (name: string, source: string = attrs): number | null => {
    const found = new RegExp(`\\b${name}="([^"]+)"`).exec(source);
    const n = found ? Number(found[1]) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const x1 = num('x1');
  const y1 = num('y1');
  const x2 = num('x2');
  const y2 = num('y2');
  const strokeWidth = num('stroke-width') ?? 1.1;
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const endR = Math.min(CONNECTOR_GLOW_NODE_R_MAX, CONNECTOR_GLOW_NODE_R);
  return { x1, y1, x2, y2, strokeWidth, endX: x2, endY: y2, endR };
}

/** Tiny overlay SVG: connector + terminal node, stacked-stroke halo. No `<filter>`. */
export function buildConnectorGlowOverlayXml(geometry: ConnectorGlowLine): string {
  const fill = PATTERN_PULSE_GLOW_FILL;
  const endR = Math.min(CONNECTOR_GLOW_NODE_R_MAX, geometry.endR);
  const line = (width: number, opacity: number) =>
    `<line x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.x2}" y2="${geometry.y2}" stroke="${fill}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" fill="none"/>`;
  const ring = (r: number, opacity: number) =>
    `<circle cx="${geometry.endX}" cy="${geometry.endY}" r="${r}" fill="none" stroke="${fill}" stroke-width="${CONNECTOR_GLOW_NODE_RING_STROKE}" stroke-opacity="${opacity}"/>`;
  const layers: string[] = [];
  for (let i = CONNECTOR_GLOW_LINE_EXTRAS.length - 1; i >= 0; i -= 1) {
    const extra = CONNECTOR_GLOW_LINE_EXTRAS[i]!;
    const opacity = CONNECTOR_GLOW_HALO_OPACITIES[i]!;
    layers.push(line(geometry.strokeWidth + extra, opacity));
  }
  for (let i = CONNECTOR_GLOW_NODE_RING_EXTRAS.length - 1; i >= 0; i -= 1) {
    const extra = CONNECTOR_GLOW_NODE_RING_EXTRAS[i]!;
    const opacity = CONNECTOR_GLOW_HALO_OPACITIES[i]!;
    layers.push(ring(endR + extra, opacity));
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PATTERN_CARD_UNITS.width} ${PATTERN_CARD_UNITS.height}" preserveAspectRatio="xMidYMid slice">`,
    ...layers,
    line(geometry.strokeWidth, 1),
    `<circle cx="${geometry.endX}" cy="${geometry.endY}" r="${endR}" fill="${fill}" fill-opacity="1" stroke="none"/>`,
    `</svg>`,
  ].join('');
}

function motifCenter(
  variant: PatternVariantIndex,
  motifId: string,
): { cx: number; cy: number } | null {
  const motif = PATTERN_VARIANT_PLACEMENTS[variant].motifs.find((m) => m.id === motifId);
  if (!motif) return null;
  return { cx: motif.cx, cy: motif.cy };
}

/**
 * Pick one connector away from the title clearing.
 * Stable per conceptKey among visible candidates (max 1 concurrent pulse).
 */
export function pickPulseConnectorId(options: {
  xml: string;
  variant: PatternVariantIndex;
  clearArea: PatternRect;
  conceptKey: string;
}): string | null {
  const candidates = listVisiblePulseConnectors(options.xml);
  if (candidates.length === 0) return null;

  const clearCx = options.clearArea.x + options.clearArea.width / 2;
  const clearCy = options.clearArea.y + options.clearArea.height / 2;

  type Scored = { id: string; dist2: number };
  const scored: Scored[] = [];
  for (const c of candidates) {
    const center = motifCenter(options.variant, c.motifId);
    if (center == null) continue;
    const dx = center.cx - clearCx;
    const dy = center.cy - clearCy;
    scored.push({ id: c.id, dist2: dx * dx + dy * dy });
  }
  if (scored.length === 0) return candidates[0]?.id ?? null;

  // Prefer farthest from title clear; break ties with concept hash for stability.
  scored.sort((a, b) => b.dist2 - a.dist2 || a.id.localeCompare(b.id));
  const top = scored.slice(0, Math.min(8, scored.length));
  let h = 5381;
  const key = options.conceptKey.trim().toLowerCase();
  for (let i = 0; i < key.length; i += 1) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return top[h % top.length]!.id;
}

function formatOpacity(opacity: number): string {
  const clamped = Math.min(1, Math.max(0, opacity));
  if (clamped <= 0) return '0';
  if (clamped >= 1) return '1';
  // Trim trailing zeros for stable SVG diffs in tests.
  return String(Math.round(clamped * 1000) / 1000);
}

/**
 * Set fill-opacity on one pulse `<g id="cNN">`. Geometry unchanged.
 * No-op when connector id is missing.
 */
export function applyConnectorPulseOpacity(
  xml: string,
  connectorId: string,
  opacity: number,
): string {
  if (!connectorId) return xml;
  const value = formatOpacity(opacity);
  let next = xml;
  const fillRe = new RegExp(
    `(<g\\b[^>]*\\bid="${connectorId}"[^>]*\\bfill-opacity=")[^"]*(")`,
  );
  if (fillRe.test(next)) {
    next = next.replace(fillRe, `$1${value}$2`);
  }
  const opacityRe = new RegExp(
    `(<g\\b[^>]*\\bid="${connectorId}"[^>]*\\bopacity=")[^"]*(")`,
  );
  if (opacityRe.test(next)) {
    next = next.replace(opacityRe, `$1${value}$2`);
  }
  return next;
}

/** Read fill-opacity / opacity for a connector group (tests / e2e helpers). */
export function readConnectorPulseOpacity(xml: string, connectorId: string): number | null {
  const opacityRe = new RegExp(
    `<g\\b[^>]*\\bid="${connectorId}"[^>]*\\bopacity="([^"]*)"`,
  );
  const fillRe = new RegExp(
    `<g\\b[^>]*\\bid="${connectorId}"[^>]*\\bfill-opacity="([^"]*)"`,
  );
  const match = opacityRe.exec(xml) ?? fillRe.exec(xml);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function assertPulseGlowFill(xml: string): boolean {
  return (
    xml.includes(`id="connectors"`) &&
    xml.includes(`fill="${CONNECTOR_PULSE_GLOW_FILL}"`)
  );
}
