/**
 * Web focus trap for bottom sheets (Lz-41): keep Tab/Shift+Tab inside the panel.
 * Backdrop stays click-to-dismiss only (tabIndex -1), not a Tab stop.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.hasAttribute('disabled')) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Focusable descendants inside a sheet panel (excludes backdrop siblings). */
export function listSheetFocusables(root: HTMLElement): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (!isVisible(el)) return false;
    let parent: HTMLElement | null = el;
    while (parent && parent !== root) {
      if (parent.hasAttribute('inert')) return false;
      if (parent.getAttribute('aria-hidden') === 'true') return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

/**
 * Pure Tab wrap index: null = let the browser move; otherwise focus that index.
 * `activeIndex` is -1 when focus is outside the list.
 */
export function sheetTabWrapIndex(
  length: number,
  activeIndex: number,
  shiftKey: boolean,
): number | null {
  if (length <= 0) return null;
  if (shiftKey) {
    if (activeIndex <= 0) return length - 1;
    return null;
  }
  if (activeIndex < 0 || activeIndex >= length - 1) return 0;
  return null;
}

export type SheetTabEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
};

/**
 * When Tab would leave the panel, wrap to the other end.
 * No-op for non-Tab keys or empty focusable sets (still preventDefault when empty).
 */
export function trapSheetTabKey(root: HTMLElement, event: SheetTabEvent): void {
  if (event.key !== 'Tab') return;
  const focusables = listSheetFocusables(root);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement as HTMLElement | null;
  const activeIndex = active ? focusables.indexOf(active) : -1;
  const next = sheetTabWrapIndex(focusables.length, activeIndex, event.shiftKey);
  if (next == null) return;
  event.preventDefault();
  focusables[next]?.focus();
}
