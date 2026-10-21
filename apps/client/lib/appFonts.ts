/**
 * Bundled Inter (SIL OFL 1.1). Explicit family names — do not rely on
 * Android `fontWeight` synthesis. Load with expo-font `useFonts` in
 * `hooks/appFontsContext.tsx`.
 */
import { font } from '@/theme/tokens';

export const APP_FONT_FAMILIES = {
  regular: font.family.regular,
  medium: font.family.medium,
  semiBold: font.family.semiBold,
  bold: font.family.bold,
} as const;

/** True once every bundled weight is in, or loading failed (momentary system fallback). */
export function appFontsReady(loaded: boolean, error: Error | null): boolean {
  return loaded || error != null;
}
