import type { MessageKey } from './i18n';

/** Menu row min height (guide §12.2 / Critiquito Lz-32). */
export const APP_MENU_ROW_MIN_HEIGHT = 56;

/** Value column size — not a §23 type role; Critiquito pins 15 px. */
export const APP_MENU_VALUE_FONT_SIZE = 15;
export const APP_MENU_VALUE_LINE_HEIGHT = Math.round(APP_MENU_VALUE_FONT_SIZE * 1.4);

/**
 * Label may shrink so multi-word ES copy wraps at spaces (PRR B3), but web
 * `minWidth: min-content` keeps it at least as wide as its longest word so
 * Compleji/dad never appears (AD Lz-45). Value still yields first, then stacks.
 */
export const APP_MENU_ROW_LABEL_FLEX_SHRINK = 1;
export const APP_MENU_ROW_VALUE_FLEX_SHRINK = 1;

/**
 * Cluster uses space-between so the value sits flush-right beside the chevron
 * when it shares the label's line (Lz-44). A lone wrapped value packs to the
 * start (left-aligned stack) — do not flexGrow the value (that left-sticks copy).
 */
export const APP_MENU_ROW_CLUSTER_JUSTIFY_CONTENT = 'space-between' as const;
export const APP_MENU_ROW_VALUE_FLEX_GROW = 0;

/** Web-only: never narrower than the longest word in the label. */
export const APP_MENU_ROW_LABEL_MIN_WIDTH_WEB = 'min-content' as const;

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
  /** Optional pre-resolved value label (dynamic rows; wins over valueKey for display). */
  value?: string;
  /** When true the row shows a chevron and opens an in-sheet view. */
  opensView: boolean;
  /** Bound by the sheet / {@link withAppMenuRowPress}; action rows call this on press. */
  onPress?: () => void;
};

/** Per-row press handlers keyed by {@link AppMenuRowKey}. */
export type AppMenuRowActions = Partial<Record<AppMenuRowKey, () => void>>;

/** Attach `onPress` from `actions` so the sheet never switches on `row.key`. */
export function withAppMenuRowPress(
  rows: readonly AppMenuRowDef[],
  actions: AppMenuRowActions,
): AppMenuRowDef[] {
  return rows.map((row) => {
    const onPress = actions[row.key];
    if (!onPress) return { ...row };
    return { ...row, onPress };
  });
}

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

/** About lockup width on paper (guide §5.3 / Lz-47). */
export const ABOUT_LOGO_WIDTH = 160;

/** Language + Complexity + About + Replay gesture tips. */
export const DEFAULT_APP_MENU_FEATURES: AppMenuFeatures = {
  language: true,
  complexity: true,
  motion: false,
  about: true,
  replayTips: true,
};

/** In-sheet view keys. Sub-views replace content; never stack modals. */
export type AppMenuView = 'root' | 'language' | 'complexity' | 'about';

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

/** AC: opening the language picker moves focus into the view (Back control). */
export function focusLanguagePickerOnOpen<T>(
  focus: (ref: { current: T | null }) => void,
  backRef: { current: T | null },
): void {
  focus(backRef);
}

/** Screen-reader label: “Name” or “Name, value”. */
export function appMenuRowA11yLabel(
  row: AppMenuRowDef,
  translate: (key: MessageKey) => string,
): string {
  const label = translate(row.labelKey);
  const value = row.value ?? (row.valueKey != null ? translate(row.valueKey) : null);
  if (value == null) return label;
  return `${label}, ${value}`;
}
