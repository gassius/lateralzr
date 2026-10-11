import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APP_MENU_ROW_MIN_HEIGHT,
  APP_MENU_ROW_ORDER,
  APP_MENU_VALUE_FONT_SIZE,
  appMenuRowA11yLabel,
  appMenuRowShowsChevron,
  DEFAULT_APP_MENU_FEATURES,
  visibleAppMenuRows,
  withAppMenuRowPress,
  type AppMenuFeatures,
} from './appMenu.ts';
import { t } from './i18n.ts';

describe('visibleAppMenuRows', () => {
  it('v3.3 defaults to Language + Replay gesture tips', () => {
    const rows = visibleAppMenuRows();
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.key, 'language');
    assert.equal(rows[0]!.labelKey, 'menuLanguage');
    assert.equal(rows[0]!.opensView, true);
    assert.equal(rows[1]!.key, 'replayTips');
    assert.equal(rows[1]!.labelKey, 'menuReplayTips');
    assert.equal(rows[1]!.opensView, false);
  });

  it('filters out disabled features and keeps fixed order', () => {
    const features: AppMenuFeatures = {
      language: true,
      complexity: false,
      motion: true,
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
    const language = visibleAppMenuRows()[0]!;
    const replay = visibleAppMenuRows()[1]!;
    assert.equal(appMenuRowShowsChevron(language), true);
    assert.equal(appMenuRowShowsChevron(replay), false);
  });
});

describe('appMenuRowA11yLabel', () => {
  it('uses label alone when there is no value', () => {
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
});

describe('withAppMenuRowPress', () => {
  it('binds onPress per row key without requiring sheet key switches', () => {
    let replayCalls = 0;
    const rows = withAppMenuRowPress(visibleAppMenuRows(), {
      replayTips: () => {
        replayCalls += 1;
      },
    });
    assert.equal(rows.length, 2);
    const replay = rows.find((r) => r.key === 'replayTips');
    assert.equal(typeof replay?.onPress, 'function');
    replay!.onPress!();
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

describe('app menu metrics', () => {
  it('pins row min height 56 and value size 15', () => {
    assert.equal(APP_MENU_ROW_MIN_HEIGHT, 56);
    assert.equal(APP_MENU_VALUE_FONT_SIZE, 15);
  });

  it('matches DEFAULT_APP_MENU_FEATURES to §4.5 v3.3 scope (Language + Replay)', () => {
    assert.deepEqual(DEFAULT_APP_MENU_FEATURES, {
      language: true,
      complexity: false,
      motion: false,
      about: false,
      replayTips: true,
    });
  });
});
