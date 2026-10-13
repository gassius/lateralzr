/**
 * Card-front connector pulse (Lz-40 / guide §11.3).
 *
 * Decorative only: one short connector + terminal node, opacity breath on the
 * existing `#connectors` glow layer (#FFB867). No geometry movement.
 */

import { PATTERN_PULSE_GLOW_FILL } from '@/theme/pattern';
import { motion } from '@/theme/tokens';
import type { PatternRect, PatternVariantIndex } from '@/lib/patternPlacement';
import { PATTERN_VARIANT_PLACEMENTS } from '@/lib/patternVariantPlacements';

/** Peak fill-opacity for the breath — barely perceptible at arm's length. */
export const CONNECTOR_PULSE_PEAK_OPACITY = 0.22;

/** Documented glow fill (must stay the pattern pulse orange, never white/cyan). */
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
};

/** Pin helpers to theme tokens (unit tests). */
export function connectorPulseTiming(): ConnectorPulseTiming {
  return {
    cycleMs: motion.pulseCycleMs,
    pauseMs: motion.pulsePauseMs,
    concurrentPulses: motion.concurrentPulses,
    peakOpacity: CONNECTOR_PULSE_PEAK_OPACITY,
  };
}

/**
 * Whether the decorative pulse may run.
 * Fully off under reduced motion / Motion=Reduced (`shouldPulse` token).
 */
export function connectorPulseAllowed(gate: ConnectorPulseGate): boolean {
  if (gate.reduceMotion) return false;
  if (!gate.settled || !gate.frontShowing) return false;
  if (gate.dragging || gate.scrolling || gate.sheetOpen) return false;
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
  const [lo, hi] = motion.pulseCycleMs;
  return randomIntInclusive(lo, hi, random);
}

export function randomPulsePauseMs(random: () => number = Math.random): number {
  const [lo, hi] = motion.pulsePauseMs;
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
  const re = new RegExp(
    `(<g\\b[^>]*\\bid="${connectorId}"[^>]*\\bfill-opacity=")[^"]*(")`,
  );
  if (!re.test(xml)) return xml;
  return xml.replace(re, `$1${value}$2`);
}

/** Read fill-opacity for a connector group (tests / e2e helpers). */
export function readConnectorPulseOpacity(xml: string, connectorId: string): number | null {
  const re = new RegExp(
    `<g\\b[^>]*\\bid="${connectorId}"[^>]*\\bfill-opacity="([^"]*)"`,
  );
  const match = re.exec(xml);
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
