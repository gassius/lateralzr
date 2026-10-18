import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPatternSvgXml } from './patternPlacement.ts';
import { buildNoMediaEmbossXml, resolveNoMediaEmbossHeight } from './noMediaEmboss.ts';
import { color, decorative, pattern } from '@/theme/tokens.ts';

describe('resolveNoMediaEmbossHeight', () => {
  it('clamps to 55% of the card and keeps a 24 px gap above text', () => {
    const plan = resolveNoMediaEmbossHeight({ cardHeight: 560, firstTextY: 400 });
    assert.equal(plan.height, 560 * 0.55);
    assert.ok(plan.height + 24 <= 400);
    assert.ok(Math.abs(plan.fadeStart - plan.height * 0.7) < 1e-9);
  });

  it('shrinks when the first text line sits higher than 55%', () => {
    const plan = resolveNoMediaEmbossHeight({ cardHeight: 560, firstTextY: 200 });
    assert.equal(plan.height, 200 - 24);
    assert.ok(plan.height < 560 * 0.55);
  });

  it('ignores unmeasured or zero firstTextY and keeps the 55% band', () => {
    const unknown = resolveNoMediaEmbossHeight({ cardHeight: 560, firstTextY: null });
    const zero = resolveNoMediaEmbossHeight({ cardHeight: 560, firstTextY: 0 });
    const tooClose = resolveNoMediaEmbossHeight({ cardHeight: 560, firstTextY: 20 });
    assert.equal(unknown.height, 560 * 0.55);
    assert.equal(zero.height, 560 * 0.55);
    assert.equal(tooClose.height, 560 * 0.55);
  });

  it('reads the §23 no-media emboss tokens', () => {
    assert.equal(pattern.noMediaEmboss.mirror, 'horizontal');
    assert.equal(pattern.noMediaEmboss.maxHeightRatio, 0.55);
    assert.equal(pattern.noMediaEmboss.fadeRatio, 0.3);
    assert.equal(pattern.noMediaEmboss.minGapAboveTextPx, 24);
  });
});

describe('buildNoMediaEmbossXml', () => {
  it('recolors the front network as Paper relief and strips the glow', () => {
    const front = buildPatternSvgXml({
      conceptKey: 'creativity',
      titleFaceRect: null,
      faceWidth: 358,
      faceHeight: 560,
      variantOverride: 0,
    }).xml;
    const emboss = buildNoMediaEmbossXml(front);
    assert.match(emboss, new RegExp(`fill="${color.paper}"`));
    assert.match(emboss, new RegExp(decorative.reliefPaper.shade));
    assert.match(emboss, new RegExp(decorative.reliefPaper.highlight));
    assert.match(emboss, new RegExp(decorative.reliefPaper.core));
    assert.doesNotMatch(emboss, /id="connectors"/);
    assert.doesNotMatch(emboss, /#FFC98A/);
    assert.match(emboss, /data-emboss="paper"/);
  });
});
