/**
 * Non-swipe accessible controls (ClickUp Lz-39 / 869ff5gep).
 *
 * Keyboard, switch, and screen-reader paths share the same commit functions as
 * gestures (Lz-33). Action labels come from Lz-43 i18n keys.
 */

import {
  A11Y_PASS_FOCUS,
  a11yPassFocusRingCss,
} from '@/lib/a11yPass';
import type { MessageKey } from '@/lib/i18n';
import { layout } from '@/theme/tokens';

/** Compact nav / a11y target size (guide §10 / layout.recommendedTouchTarget). */
export const ACCESSIBLE_NAV_TARGET_PX = layout.recommendedTouchTarget;

/** Minimum row height when the optional assistive nav is visible (48 px targets). */
export const ACCESSIBLE_NAV_ROW_MIN_HEIGHT = ACCESSIBLE_NAV_TARGET_PX;

/** @deprecated Prefer ACCESSIBLE_NAV_ROW_MIN_HEIGHT — row grows when labels wrap. */
export const ACCESSIBLE_NAV_ROW_HEIGHT = ACCESSIBLE_NAV_ROW_MIN_HEIGHT;

export type CardAction =
  | 'next'
  | 'previous'
  | 'flip'
  | 'complexityUp'
  | 'complexityDown';

/** RN accessibilityAction `name` values declared on the active card. */
export type CardAccessibilityActionName =
  | 'activate'
  | 'next'
  | 'previous'
  | 'complexityUp'
  | 'complexityDown';

export type CardActionGate = {
  currentIndex: number;
  /** Laterality sheet (or any modal) open — ignore card keys / actions. */
  sheetOpen?: boolean;
  /** Commit / flip animation already in flight. */
  animating?: boolean;
  /** End-of-deck status card — no next / complexity / flip (previous still ok). */
  showDeckStatus?: boolean;
};

export type CardAccessibilityActionDef = {
  name: CardAccessibilityActionName;
  labelKey: MessageKey;
};

/** Ordered a11y actions + i18n label keys (en/es via Lz-43). */
export const CARD_ACCESSIBILITY_ACTION_DEFS: readonly CardAccessibilityActionDef[] = [
  { name: 'activate', labelKey: 'actionTurn' },
  { name: 'next', labelKey: 'actionNext' },
  { name: 'previous', labelKey: 'actionPrevious' },
  { name: 'complexityUp', labelKey: 'actionComplexityUp' },
  { name: 'complexityDown', labelKey: 'actionComplexityDown' },
] as const;

const KEY_TO_ACTION: Readonly<Record<string, CardAction>> = {
  ArrowRight: 'next',
  ArrowLeft: 'previous',
  Enter: 'flip',
  ' ': 'flip',
  Space: 'flip',
  Spacebar: 'flip',
  ArrowUp: 'complexityUp',
  ArrowDown: 'complexityDown',
};

const A11Y_NAME_TO_ACTION: Readonly<Record<string, CardAction>> = {
  activate: 'flip',
  turn: 'flip',
  next: 'next',
  previous: 'previous',
  complexityUp: 'complexityUp',
  complexityDown: 'complexityDown',
  // Optional magicTap → flip (ES exploration note).
  magicTap: 'flip',
};

/** Map a web keyboard key to a card action, or null when unrecognized. */
export function cardActionFromKey(key: string): CardAction | null {
  return KEY_TO_ACTION[key] ?? null;
}

/** Map an RN accessibilityAction name to a card action, or null. */
export function cardActionFromAccessibilityName(name: string): CardAction | null {
  return A11Y_NAME_TO_ACTION[name] ?? null;
}

/**
 * Whether an action may run given deck / sheet / animation gates.
 * Previous is disabled at the start of history (index 0).
 * During deck status, only previous (index > 0) remains available so the loop can finish.
 */
export function canRunCardAction(action: CardAction, gate: CardActionGate): boolean {
  if (gate.sheetOpen || gate.animating) return false;
  if (action === 'previous') {
    return gate.currentIndex > 0;
  }
  if (gate.showDeckStatus) {
    return false;
  }
  return true;
}

/** Shared disabled gate for the assistive nav row and `runAction`. */
export function isCardActionDisabled(action: CardAction, gate: CardActionGate): boolean {
  return !canRunCardAction(action, gate);
}

/** Vertical swipe direction for complexity actions (mirrors gesture commit). */
export function complexityDirectionForAction(
  action: Extract<CardAction, 'complexityUp' | 'complexityDown'>,
): 'up' | 'down' {
  return action === 'complexityUp' ? 'up' : 'down';
}

/**
 * Show the compact nav row only for keyboard modality or screen reader —
 * never for plain touch users without assistive tech.
 * On web, callers must pass `screenReaderEnabled: false` (RN-web always reports true).
 */
export function shouldShowAccessibleNavRow(opts: {
  screenReaderEnabled: boolean;
  keyboardModality: boolean;
}): boolean {
  return opts.screenReaderEnabled || opts.keyboardModality;
}

/** Web must not trust AccessibilityInfo.isScreenReaderEnabled (always true on RN-web). */
export function shouldQueryScreenReaderForNav(platformOS: string): boolean {
  return platformOS !== 'web';
}

/**
 * Keys that establish keyboard modality for revealing the assistive nav row.
 * Pointer/touch after this clears modality (unless screen reader stays on).
 */
export function keyEstablishesKeyboardModality(key: string): boolean {
  return (
    key === 'Tab' ||
    key === 'Enter' ||
    key === ' ' ||
    key === 'Space' ||
    key === 'Spacebar' ||
    key.startsWith('Arrow')
  );
}

/** Clear keyboard modality only when the pointer/touch lands outside the nav row. */
export function shouldClearKeyboardModalityOnPointer(
  target: EventTarget | null,
  rowElement: { contains: (node: Node) => boolean } | null,
): boolean {
  if (rowElement == null || target == null) return true;
  return !rowElement.contains(target as Node);
}

/**
 * Card surface key handler. RN-web often targets an inner heading while the
 * surface is focused; still handle those. Nested controls (Wikipedia, credits)
 * keep Enter/Space.
 */
export function shouldHandleCardSurfaceKey(
  target: EventTarget | null | undefined,
  currentTarget: EventTarget | null | undefined,
): boolean {
  if (target == null || currentTarget == null) return false;
  if (target === currentTarget) return true;
  const currentEl = currentTarget as { contains?: (node: unknown) => boolean };
  if (typeof currentEl.contains !== 'function') return false;
  if (!currentEl.contains(target)) return false;
  const maybeEl = target as { closest?: (sel: string) => unknown; parentElement?: { closest?: (sel: string) => unknown } };
  const targetEl = typeof maybeEl.closest === 'function' ? maybeEl : maybeEl.parentElement;
  if (targetEl == null || typeof targetEl.closest !== 'function') return false;
  if (targetEl.closest('[data-testid="card-back-wikipedia"]')) return false;
  if (targetEl.closest('[data-testid="card-back-credit"]')) return false;
  if (targetEl.closest('a[href]')) return false;
  return true;
}

/** Resolve an a11y action name through the shared gate into a runnable CardAction. */
export function resolveRunnableAccessibilityAction(
  actionName: string,
  gate: CardActionGate,
): CardAction | null {
  const action = cardActionFromAccessibilityName(actionName);
  if (action == null) return null;
  if (!canRunCardAction(action, gate)) return null;
  return action;
}

/** Web tabIndex for the card surface (previous stays reachable on deck status). */
export function cardWebTabIndex(gate: Pick<CardActionGate, 'sheetOpen' | 'showDeckStatus' | 'currentIndex'>): number {
  if (gate.sheetOpen) return -1;
  if (gate.showDeckStatus && gate.currentIndex <= 0) return -1;
  return 0;
}

/** Whether the card surface merges into one accessible button (not when flipped — link must stay reachable). */
export function cardSurfaceIsAccessibleButton(opts: {
  showDeckStatus: boolean;
  flipped: boolean;
}): boolean {
  return !opts.showDeckStatus && !opts.flipped;
}

/** Build labeled accessibilityActions for the card (locale-sensitive via `translate`). */
export function buildCardAccessibilityActions(
  translate: (key: MessageKey) => string,
): { name: CardAccessibilityActionName; label: string }[] {
  return CARD_ACCESSIBILITY_ACTION_DEFS.map((def) => ({
    name: def.name,
    label: translate(def.labelKey),
  }));
}

/** Nav-row button a11y props — roles/labels/disabled tested against mutations. */
export function navButtonA11yProps(opts: {
  action: CardAction;
  label: string;
  gate: CardActionGate;
}): {
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityState: { disabled: boolean };
  disabled: boolean;
} {
  const disabled = isCardActionDisabled(opts.action, opts.gate);
  return {
    accessibilityRole: 'button',
    accessibilityLabel: opts.label,
    accessibilityState: { disabled },
    disabled,
  };
}

/** Height to reserve under the card when the assistive nav row is visible. */
export function accessibleNavChromeReserve(visible: boolean): number {
  return visible ? ACCESSIBLE_NAV_ROW_MIN_HEIGHT : 0;
}

/** Guide §6 focus ring: 2px stroke + 2px gap. Paper on shell; Ink on orange/light. */
export const A11Y_FOCUS_RING = {
  widthPx: A11Y_PASS_FOCUS.widthPx,
  offsetPx: A11Y_PASS_FOCUS.offsetPx,
  onShell: A11Y_PASS_FOCUS.onShell,
  onOrangeOrLight: A11Y_PASS_FOCUS.onPaperOrOrange,
} as const;

export const A11Y_FOCUS_STYLE_ID = 'lateralzr-a11y-focus-ring';

/** Injected once on web for :focus-visible rings (practice + sheets — Lz-41). */
export function a11yFocusRingCss(): string {
  return a11yPassFocusRingCss();
}

export function ensureA11yFocusRingStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(A11Y_FOCUS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = A11Y_FOCUS_STYLE_ID;
  style.textContent = a11yFocusRingCss();
  document.head.appendChild(style);
}
