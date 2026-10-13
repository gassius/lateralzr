/**
 * Lz-41 accessibility pass helpers (WCAG 2.2 AA web + VoiceOver/TalkBack).
 * Focus ring tokens, sheet trap selectors, and axe gate constants live here
 * so unit + E2E tests can pin guide §6 / §18 without duplicating magic strings.
 */
import { color } from '@/theme/tokens';

/** Guide §6.2 — 2px ring with 2px offset. */
export const A11Y_PASS_FOCUS = {
  widthPx: 2,
  offsetPx: 2,
  onShell: color.paper,
  onPaperOrOrange: color.ink,
} as const;

/** Minimum touch / pointer target (guide §18 / WCAG 2.5.5). */
export const A11Y_MIN_TARGET_PX = 48;

/** Shell / petrol chrome — paper ring. */
export const A11Y_FOCUS_SHELL_TEST_IDS = [
  'card-a11y-surface',
  'a11y-nav-previous',
  'a11y-nav-complexity-down',
  'a11y-nav-flip',
  'a11y-nav-complexity-up',
  'a11y-nav-next',
  'app-menu-trigger',
  'laterality-label',
  'laterality-rail',
] as const;

/** Paper / orange surfaces — ink ring (sheet chrome + rows). */
export const A11Y_FOCUS_PAPER_TEST_IDS = [
  'laterality-sheet-close',
  'laterality-sheet-title',
  'app-menu-close',
  'app-menu-title',
  'app-menu-back',
  'app-menu-about-back',
] as const;

/** Prefix matchers for sheet / menu rows on paper. */
export const A11Y_FOCUS_PAPER_TEST_ID_PREFIXES = [
  'laterality-sheet-row-',
  'app-menu-row-',
  'app-menu-language-row-',
  'app-menu-complexity-row-',
  'app-menu-motion-row-',
] as const;

/** axe: only serious + critical fail the gate (guide AC). */
export const A11Y_AXE_FAIL_IMPACTS = ['serious', 'critical'] as const;

function testIdSelector(id: string): string {
  return `[data-testid="${id}"]`;
}

function testIdPrefixSelector(prefix: string): string {
  return `[data-testid^="${prefix}"]`;
}

/** Injected once on web for :focus-visible rings across practice + sheets. */
export function a11yPassFocusRingCss(): string {
  const w = A11Y_PASS_FOCUS.widthPx;
  const o = A11Y_PASS_FOCUS.offsetPx;
  const shell = [
    ...A11Y_FOCUS_SHELL_TEST_IDS.map(testIdSelector),
  ]
    .map((sel) => `${sel}:focus-visible`)
    .join(',\n');
  const paper = [
    ...A11Y_FOCUS_PAPER_TEST_IDS.map(testIdSelector),
    ...A11Y_FOCUS_PAPER_TEST_ID_PREFIXES.map(testIdPrefixSelector),
  ]
    .map((sel) => `${sel}:focus-visible`)
    .join(',\n');
  return `
${shell} {
  outline: ${w}px solid ${A11Y_PASS_FOCUS.onShell} !important;
  outline-offset: ${o}px;
}
${paper} {
  outline: ${w}px solid ${A11Y_PASS_FOCUS.onPaperOrOrange} !important;
  outline-offset: ${o}px;
}
`.trim();
}

/** Whether an axe violation impact fails the Lz-41 gate. */
export function a11yAxeImpactFails(impact: string | null | undefined): boolean {
  if (impact == null) return false;
  return (A11Y_AXE_FAIL_IMPACTS as readonly string[]).includes(impact);
}
