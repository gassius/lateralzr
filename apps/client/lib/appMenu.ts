import type { MessageKey } from './i18n';

/** Menu row min height (guide §12.2 / Critiquito Lz-32). */
export const APP_MENU_ROW_MIN_HEIGHT = 56;

/** Value column size — not a §23 type role; Critiquito pins 15 px. */
export const APP_MENU_VALUE_FONT_SIZE = 15;
export const APP_MENU_VALUE_LINE_HEIGHT = Math.round(APP_MENU_VALUE_FONT_SIZE * 1.4);

export type AppMenuRowKey =
  | 'language'
  | 'complexity'
  | 'motion'
  | 'about'
  | 'replayTips';

export type AppMenuRowDef = {
  key: AppMenuRowKey;
  labelKey: MessageKey;
  valueKey?: MessageKey;
  /** When true the row shows a chevron and opens an in-sheet view. */
  opensView: boolean;
};

export type AppMenuFeatures = Record<AppMenuRowKey, boolean>;

/**
 * Fixed order. Each row ships only when its feature flag is on (§4.5).
 * Language / Complexity / Motion / About land in Lz-44…Lz-47.
 */
export const APP_MENU_ROW_ORDER: readonly AppMenuRowDef[] = [
  { key: 'language', labelKey: 'menuLanguage', opensView: true },
  { key: 'complexity', labelKey: 'menuComplexity', opensView: true },
  { key: 'motion', labelKey: 'menuMotion', opensView: true },
  { key: 'about', labelKey: 'menuAbout', opensView: true },
  { key: 'replayTips', labelKey: 'menuReplayTips', opensView: false },
] as const;

/** v3.3: only Replay gesture tips is enabled. */
export const DEFAULT_APP_MENU_FEATURES: AppMenuFeatures = {
  language: false,
  complexity: false,
  motion: false,
  about: false,
  replayTips: true,
};

/** In-sheet view keys. Sub-views replace content; never stack modals. */
export type AppMenuView = 'root';

/** Rows whose feature is enabled, preserving {@link APP_MENU_ROW_ORDER}. */
export function visibleAppMenuRows(
  features: AppMenuFeatures = DEFAULT_APP_MENU_FEATURES,
): AppMenuRowDef[] {
  return APP_MENU_ROW_ORDER.filter((row) => features[row.key]);
}

/** Chevron is drawn only when the row opens a nested view. */
export function appMenuRowShowsChevron(row: Pick<AppMenuRowDef, 'opensView'>): boolean {
  return row.opensView === true;
}

/** Screen-reader label: “Name” or “Name, value”. */
export function appMenuRowA11yLabel(
  row: AppMenuRowDef,
  translate: (key: MessageKey) => string,
): string {
  const label = translate(row.labelKey);
  if (row.valueKey == null) return label;
  return `${label}, ${translate(row.valueKey)}`;
}
