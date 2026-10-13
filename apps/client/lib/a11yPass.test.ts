import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  A11Y_AXE_FAIL_IMPACTS,
  A11Y_FOCUS_PAPER_TEST_IDS,
  A11Y_FOCUS_SHELL_TEST_IDS,
  A11Y_MIN_TARGET_PX,
  A11Y_PASS_FOCUS,
  a11yAxeImpactFails,
  a11yPassFocusRingCss,
} from '@/lib/a11yPass';
import { color } from '@/theme/tokens';

describe('a11yPass focus tokens', () => {
  it('pins 2px ring + 2px offset and guide colours', () => {
    assert.equal(A11Y_PASS_FOCUS.widthPx, 2);
    assert.equal(A11Y_PASS_FOCUS.offsetPx, 2);
    assert.equal(A11Y_PASS_FOCUS.onShell, color.paper);
    assert.equal(A11Y_PASS_FOCUS.onPaperOrOrange, color.ink);
    assert.equal(A11Y_MIN_TARGET_PX, 48);
  });

  it('emits paper rings on shell controls and ink rings on paper sheets', () => {
    const css = a11yPassFocusRingCss();
    for (const id of A11Y_FOCUS_SHELL_TEST_IDS) {
      assert.match(css, new RegExp(`\\[data-testid="${id}"\\]:focus-visible`));
    }
    for (const id of A11Y_FOCUS_PAPER_TEST_IDS) {
      assert.match(css, new RegExp(`\\[data-testid="${id}"\\]:focus-visible`));
    }
    assert.match(css, /data-testid\^="laterality-sheet-row-"/);
    assert.match(css, /outline: 2px solid #F5F1E8/);
    assert.match(css, /outline: 2px solid #172126/);
    assert.match(css, /outline-offset: 2px/);
  });
});

describe('a11yAxeImpactFails', () => {
  it('fails only serious and critical', () => {
    assert.deepEqual([...A11Y_AXE_FAIL_IMPACTS], ['serious', 'critical']);
    assert.equal(a11yAxeImpactFails('critical'), true);
    assert.equal(a11yAxeImpactFails('serious'), true);
    assert.equal(a11yAxeImpactFails('moderate'), false);
    assert.equal(a11yAxeImpactFails('minor'), false);
    assert.equal(a11yAxeImpactFails(null), false);
  });
});
