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

/** Selectors that must receive :focus-visible rings (shell vs paper/orange). */
export const A11Y_FOCUS_SHELL_TEST_IDS = [
  'card-a11y-surface',
  'a11y-nav-previous',
  'a11y-nav-complexity-down',
  'a11y-nav-flip',
  'a11y-nav-complexity-up',
  'a11y-nav-next',
  'app-menu-trigger',
  'laterality-control',
] as const;

export const A11Y_FOCUS_PAPER_TEST_IDS = [
  'sheet-close',
  'laterality-sheet-close',
  'app-menu-close',
  'laterality-sheet-back',
  'app-menu-back',
] as const;

/** axe: only serious + critical fail the gate (guide AC). */
export const A11Y_AXE_FAIL_IMPACTS = ['serious', 'critical'] as const;
