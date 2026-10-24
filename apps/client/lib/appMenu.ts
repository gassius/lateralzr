import { layout } from '../theme/tokens';
import type { MessageKey } from './i18n';

/** Menu row min height (guide §12.2 / `layout.sheetRowHeight`). */
export const APP_MENU_ROW_MIN_HEIGHT = layout.sheetRowHeight;

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
  | 'sound'
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
 * Language / Complexity / Motion / Sound / About land in Lz-44…Lz-47 + Sound 2.
 */
export const APP_MENU_ROW_ORDER: readonly AppMenuRowDef[] = [
  { key: 'language', labelKey: 'menuLanguage', opensView: true },
  { key: 'complexity', labelKey: 'menuComplexity', opensView: true },
  { key: 'motion', labelKey: 'menuMotion', opensView: true },
  { key: 'sound', labelKey: 'menuSound', opensView: true },
  { key: 'about', labelKey: 'menuAbout', opensView: true },
  { key: 'replayTips', labelKey: 'menuReplayTips', opensView: false },
] as const;

/** About lockup width on paper (guide §5.3 / Lz-47). */
export const ABOUT_LOGO_WIDTH = 160;

/** Language + Complexity + Motion + Sound + About + Replay gesture tips. */
export const DEFAULT_APP_MENU_FEATURES: AppMenuFeatures = {
  language: true,
  complexity: true,
  motion: true,
  sound: true,
  about: true,
  replayTips: true,
};

/** In-sheet view keys. Sub-views replace content; never stack modals. */
export type AppMenuView = 'root' | 'language' | 'complexity' | 'motion' | 'sound' | 'about';

/** Visual groups in the floating Paper menu (§12.2). */
export type AppMenuGroupKey = 'settings' | 'replay';

export const APP_MENU_GROUP_ORDER: readonly AppMenuGroupKey[] = ['settings', 'replay'];

export const APP_MENU_ROW_GROUP: Record<AppMenuRowKey, AppMenuGroupKey> = {
  language: 'settings',
  complexity: 'settings',
  motion: 'settings',
  sound: 'settings',
  about: 'settings',
  replayTips: 'replay',
};

export type AppMenuRowGroup = {
  key: AppMenuGroupKey;
  rows: AppMenuRowDef[];
};

/** Rows whose feature is enabled, preserving {@link APP_MENU_ROW_ORDER}. */
export function visibleAppMenuRows(
  features: AppMenuFeatures = DEFAULT_APP_MENU_FEATURES,
): AppMenuRowDef[] {
  return APP_MENU_ROW_ORDER.filter((row) => features[row.key]);
}

/** Settings group then Replay group; empty groups omitted. */
export function groupedAppMenuRows(
  rows: readonly AppMenuRowDef[] = visibleAppMenuRows(),
): AppMenuRowGroup[] {
  return APP_MENU_GROUP_ORDER.map((key) => ({
    key,
    rows: rows.filter((row) => APP_MENU_ROW_GROUP[row.key] === key),
  })).filter((group) => group.rows.length > 0);
}

/** Whether `view` is a nested in-sheet picker (not root). */
export function isAppMenuNestedView(view: AppMenuView): boolean {
  return view !== 'root';
}

/** Chevron is drawn only when the row opens a nested view. */
export function appMenuRowShowsChevron(row: Pick<AppMenuRowDef, 'opensView'>): boolean {
  return row.opensView === true;
}

/** F7: opening the menu or a nested view moves focus onto the sheet title. */
export function focusSheetTitleOnOpen<T>(
  focus: (ref: { current: T | null }) => void,
  titleRef: { current: T | null },
): void {
  focus(titleRef);
}

/** F7: closing the Motion view returns focus to the Motion row. */
export function focusMotionRowOnClose<T>(
  focus: (ref: { current: T | null }) => void,
  motionRowRef: { current: T | null },
): void {
  focus(motionRowRef);
}

/** F7: closing the Sound view returns focus to the Sound row. */
export function focusSoundRowOnClose<T>(
  focus: (ref: { current: T | null }) => void,
  soundRowRef: { current: T | null },
): void {
  focus(soundRowRef);
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
