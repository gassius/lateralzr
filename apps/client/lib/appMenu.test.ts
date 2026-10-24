import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ABOUT_LOGO_WIDTH,
  APP_MENU_ROW_CLUSTER_JUSTIFY_CONTENT,
  APP_MENU_ROW_LABEL_FLEX_SHRINK,
  APP_MENU_ROW_LABEL_MIN_WIDTH_WEB,
  APP_MENU_ROW_MIN_HEIGHT,
  APP_MENU_ROW_ORDER,
  APP_MENU_ROW_VALUE_FLEX_GROW,
  APP_MENU_ROW_VALUE_FLEX_SHRINK,
  APP_MENU_VALUE_FONT_SIZE,
  appMenuRowA11yLabel,
  appMenuRowShowsChevron,
  DEFAULT_APP_MENU_FEATURES,
  focusMotionRowOnClose,
  focusSheetTitleOnOpen,
  focusSoundRowOnClose,
  groupedAppMenuRows,
  visibleAppMenuRows,
  withAppMenuRowPress,
  type AppMenuFeatures,
} from './appMenu.ts';
import { layout } from '../theme/tokens.ts';
import { t } from './i18n.ts';

describe('visibleAppMenuRows', () => {
  it('defaults to Language + Complexity + Motion + Sound + About + Replay gesture tips', () => {
    const rows = visibleAppMenuRows();
    assert.equal(rows.length, 6);
    assert.deepEqual(
      rows.map((r) => r.key),
      ['language', 'complexity', 'motion', 'sound', 'about', 'replayTips'],
    );
    assert.equal(rows[0]!.opensView, true);
    assert.equal(rows[1]!.opensView, true);
    assert.equal(rows[1]!.labelKey, 'menuComplexity');
    assert.equal(rows[2]!.key, 'motion');
    assert.equal(rows[2]!.labelKey, 'menuMotion');
    assert.equal(rows[2]!.opensView, true);
    assert.equal(rows[3]!.key, 'sound');
    assert.equal(rows[3]!.labelKey, 'menuSound');
    assert.equal(rows[3]!.opensView, true);
    assert.equal(rows[4]!.opensView, true);
    assert.equal(rows[4]!.valueKey, undefined);
    assert.equal(rows[5]!.opensView, false);
  });

  it('filters out disabled features and keeps fixed order', () => {
    const features: AppMenuFeatures = {
      language: true,
      complexity: false,
      motion: true,
      sound: false,
      about: false,
      replayTips: true,
    };
    const keys = visibleAppMenuRows(features).map((r) => r.key);
    assert.deepEqual(keys, ['language', 'motion', 'replayTips']);
  });

  it('returns empty when every feature is off', () => {
    const none: AppMenuFeatures = {
      language: false,
      complexity: false,
      motion: false,
      sound: false,
      about: false,
      replayTips: false,
    };
    assert.deepEqual(visibleAppMenuRows(none), []);
  });
});

describe('appMenuRowShowsChevron', () => {
  it('draws chevrons only for opensView rows', () => {
    for (const row of APP_MENU_ROW_ORDER) {
      assert.equal(appMenuRowShowsChevron(row), row.opensView);
    }
    const language = visibleAppMenuRows().find((r) => r.key === 'language')!;
    const complexity = visibleAppMenuRows().find((r) => r.key === 'complexity')!;
    const motion = visibleAppMenuRows().find((r) => r.key === 'motion')!;
    const sound = visibleAppMenuRows().find((r) => r.key === 'sound')!;
    const about = visibleAppMenuRows().find((r) => r.key === 'about')!;
    const replay = visibleAppMenuRows().find((r) => r.key === 'replayTips')!;
    assert.equal(appMenuRowShowsChevron(language), true);
    assert.equal(appMenuRowShowsChevron(complexity), true);
    assert.equal(appMenuRowShowsChevron(motion), true);
    assert.equal(appMenuRowShowsChevron(sound), true);
    assert.equal(appMenuRowShowsChevron(about), true);
    assert.equal(appMenuRowShowsChevron(replay), false);
  });
});

describe('appMenuRowA11yLabel', () => {
  it('uses label alone when there is no value', () => {
    assert.equal(
      appMenuRowA11yLabel({ key: 'about', labelKey: 'menuAbout', opensView: true }, t),
      t('menuAbout'),
    );
    assert.equal(
      appMenuRowA11yLabel({ key: 'replayTips', labelKey: 'menuReplayTips', opensView: false }, t),
      t('menuReplayTips'),
    );
  });

  it('joins label and value with a comma', () => {
    assert.equal(
      appMenuRowA11yLabel(
        {
          key: 'language',
          labelKey: 'menuLanguage',
          valueKey: 'languageEn',
          opensView: true,
        },
        t,
      ),
      `${t('menuLanguage')}, ${t('languageEn')}`,
    );
  });

  it('prefers value over valueKey for interpolated complexity', () => {
    const value = t('complexityGrade', { grade: '4' });
    assert.equal(
      appMenuRowA11yLabel(
        {
          key: 'complexity',
          labelKey: 'menuComplexity',
          valueKey: 'languageEn',
          value,
          opensView: true,
        },
        t,
      ),
      `${t('menuComplexity')}, ${value}`,
    );
  });
});

describe('withAppMenuRowPress', () => {
  it('binds onPress per row key without requiring sheet key switches', () => {
    let replayCalls = 0;
    let aboutCalls = 0;
    const rows = withAppMenuRowPress(visibleAppMenuRows(), {
      about: () => {
        aboutCalls += 1;
      },
      replayTips: () => {
        replayCalls += 1;
      },
    });
    assert.equal(rows.length, 6);
    rows.find((r) => r.key === 'about')!.onPress!();
    const replay = rows.find((r) => r.key === 'replayTips');
    assert.equal(typeof replay?.onPress, 'function');
    replay!.onPress!();
    assert.equal(aboutCalls, 1);
    assert.equal(replayCalls, 1);
  });
});

describe('appMenuRowA11yLabel value field', () => {
  it('prefers explicit value string over valueKey', () => {
    assert.equal(
      appMenuRowA11yLabel(
        {
          key: 'language',
          labelKey: 'menuLanguage',
          valueKey: 'languageEn',
          value: 'Español',
          opensView: true,
        },
        t,
      ),
      `${t('menuLanguage')}, Español`,
    );
  });
});

describe('groupedAppMenuRows', () => {
  it('puts Language / Complexity / Motion / Sound / About in one group and Replay alone', () => {
    const groups = groupedAppMenuRows();
    assert.deepEqual(
      groups.map((g) => g.key),
      ['settings', 'replay'],
    );
    assert.deepEqual(
      groups[0]!.rows.map((r) => r.key),
      ['language', 'complexity', 'motion', 'sound', 'about'],
    );
    assert.deepEqual(
      groups[1]!.rows.map((r) => r.key),
      ['replayTips'],
    );
  });

  it('omits empty groups when features hide Replay', () => {
    const groups = groupedAppMenuRows(
      visibleAppMenuRows({
        language: true,
        complexity: true,
        motion: true,
        sound: true,
        about: true,
        replayTips: false,
      }),
    );
    assert.deepEqual(
      groups.map((g) => g.key),
      ['settings'],
    );
  });
});

describe('focusSheetTitleOnOpen / focusMotionRowOnClose / focusSoundRowOnClose (F7)', () => {
  it('10× nested open focuses the title host, Motion/Sound close focuses their rows (not Back)', () => {
    const titleRef = { current: { id: 'title' } };
    const backRef = { current: { id: 'back' } };
    const motionRowRef = { current: { id: 'motion-row' } };
    const soundRowRef = { current: { id: 'sound-row' } };
    for (let i = 0; i < 10; i += 1) {
      const focused: Array<{ id: string }> = [];
      const focus = (ref: { current: { id: string } | null }) => {
        if (ref.current) focused.push(ref.current);
      };
      focusSheetTitleOnOpen(focus, titleRef);
      assert.equal(focused.at(-1)?.id, 'title');
      assert.notEqual(focused.at(-1)?.id, backRef.current.id);
      focusMotionRowOnClose(focus, motionRowRef);
      assert.equal(focused.at(-1)?.id, 'motion-row');
      focusSoundRowOnClose(focus, soundRowRef);
      assert.equal(focused.at(-1)?.id, 'sound-row');
    }
  });
});

describe('app menu metrics', () => {
  it('pins row min height 56 and value size 15', () => {
    assert.equal(APP_MENU_ROW_MIN_HEIGHT, 56);
    assert.equal(APP_MENU_ROW_MIN_HEIGHT, layout.sheetRowHeight);
    assert.equal(APP_MENU_VALUE_FONT_SIZE, 15);
  });

  it('has no Reference links row (build switch lives in Lz-60)', () => {
    for (const row of APP_MENU_ROW_ORDER) {
      assert.equal(row.key.includes('reference'), false);
      assert.equal(row.labelKey.toLowerCase().includes('reference'), false);
    }
  });

  it('lets labels shrink for space-wrap but pins web minWidth to longest word (PRR B3)', () => {
    assert.equal(APP_MENU_ROW_LABEL_FLEX_SHRINK, 1);
    assert.equal(APP_MENU_ROW_VALUE_FLEX_SHRINK, 1);
    assert.equal(APP_MENU_ROW_LABEL_MIN_WIDTH_WEB, 'min-content');
  });

  it('keeps values flush-right on a shared line and left-packed when wrapped (AD Lz-45)', () => {
    assert.equal(APP_MENU_ROW_CLUSTER_JUSTIFY_CONTENT, 'space-between');
    assert.equal(APP_MENU_ROW_VALUE_FLEX_GROW, 0);
  });

  it('matches DEFAULT_APP_MENU_FEATURES to Language + Complexity + Motion + Sound + About + Replay', () => {
    assert.deepEqual(DEFAULT_APP_MENU_FEATURES, {
      language: true,
      complexity: true,
      motion: true,
      sound: true,
      about: true,
      replayTips: true,
    });
  });

  it('pins About lockup width at 160', () => {
    assert.equal(ABOUT_LOGO_WIDTH, 160);
  });

  it('labels Motion as Motion (not Motion & haptics)', () => {
    assert.equal(t('menuMotion'), 'Motion');
    assert.equal(t('menuMotion').includes('haptic'), false);
  });

  it('labels Sound as Sound', () => {
    assert.equal(t('menuSound'), 'Sound');
  });
});
