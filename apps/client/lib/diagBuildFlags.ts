/**
 * Diagnostic-only build flags for Android UI-stall A/B (ClickUp 1amjtrex67j).
 * Default OFF so production / unset builds keep current behaviour.
 * Opt in with EXPO_PUBLIC_*=1|true|on|yes (case-insensitive).
 */

export function parseDiagOptIn(value: string | undefined | null): boolean {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') return false;
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
}

/**
 * When true, PatternLayer renders same-size View placeholders instead of SvgXml
 * (card pattern + connector glow). Animations / stack motion are unchanged.
 */
export const DIAG_STUB_CARD_SVG = parseDiagOptIn(
  process.env.EXPO_PUBLIC_DIAG_STUB_CARD_SVG,
);
