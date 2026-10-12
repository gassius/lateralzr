/**
 * Android hardware-back while a Sheet is open (Lz-45 nested views).
 * Nested `onBack` wins over dismiss; Escape stays dismiss-only in Sheet.
 */
export type SheetHardwareBackAction = 'nestedBack' | 'dismiss';

export function resolveSheetHardwareBack(hasNestedBack: boolean): SheetHardwareBackAction {
  return hasNestedBack ? 'nestedBack' : 'dismiss';
}
