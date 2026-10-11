/**
 * Non-swipe accessible controls (ClickUp Lz-39 / 869ff5gep).
 *
 * Keyboard, switch, and screen-reader paths share the same commit functions as
 * gestures (Lz-33). Action labels come from Lz-43 i18n keys.
 */

import type { MessageKey } from '@/lib/i18n';
import { layout } from '@/theme/tokens';

/** Compact nav / a11y target size (guide §10 / layout.recommendedTouchTarget). */
export const ACCESSIBLE_NAV_TARGET_PX = layout.recommendedTouchTarget;

/** Row height when the optional assistive nav is visible (48 px targets, no extra chrome). */
export const ACCESSIBLE_NAV_ROW_HEIGHT = ACCESSIBLE_NAV_TARGET_PX;

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
  /** End-of-deck status card — no next / complexity / flip. */
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
 */
export function canRunCardAction(action: CardAction, gate: CardActionGate): boolean {
  if (gate.sheetOpen || gate.animating) return false;
  if (gate.showDeckStatus) {
    return false;
  }
  if (action === 'previous') {
    return gate.currentIndex > 0;
  }
  return true;
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
 */
export function shouldShowAccessibleNavRow(opts: {
  screenReaderEnabled: boolean;
  keyboardModality: boolean;
}): boolean {
  return opts.screenReaderEnabled || opts.keyboardModality;
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

/** Height to reserve under the card when the assistive nav row is visible. */
export function accessibleNavChromeReserve(visible: boolean): number {
  return visible ? ACCESSIBLE_NAV_ROW_HEIGHT : 0;
}
