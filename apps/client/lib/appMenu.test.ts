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
  it('v3.3 defaults to Replay gesture tips only', () => {
    const rows = visibleAppMenuRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.key, 'replayTips');
    assert.equal(rows[0]!.labelKey, 'menuReplayTips');
    assert.equal(rows[0]!.opensView, false);
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
    const replay = visibleAppMenuRows()[0]!;
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
    assert.equal(rows.length, 1);
    assert.equal(typeof rows[0]!.onPress, 'function');
    rows[0]!.onPress!();
    assert.equal(replayCalls, 1);
  });
});

describe('app menu metrics', () => {
  it('pins row min height 56 and value size 15', () => {
    assert.equal(APP_MENU_ROW_MIN_HEIGHT, 56);
    assert.equal(APP_MENU_VALUE_FONT_SIZE, 15);
  });

  it('matches DEFAULT_APP_MENU_FEATURES to §4.5 v3.3 scope', () => {
    assert.deepEqual(DEFAULT_APP_MENU_FEATURES, {
      language: false,
      complexity: false,
      motion: false,
      about: false,
      replayTips: true,
    });
  });
});
