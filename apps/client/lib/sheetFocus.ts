import { AccessibilityInfo, findNodeHandle, Platform, type View } from 'react-native';
import type { RefObject } from 'react';

/** Move a11y / keyboard focus onto a host View (title on open, label on close). */
export function focusSheetHost(ref: RefObject<View | null> | null | undefined): void {
  const node = ref?.current;
  if (!node) return;

  if (Platform.OS === 'web') {
    const el = node as unknown as { focus?: () => void };
    el.focus?.();
    return;
  }

  const handle = findNodeHandle(node);
  if (handle != null) {
    AccessibilityInfo.setAccessibilityFocus(handle);
  }
}
