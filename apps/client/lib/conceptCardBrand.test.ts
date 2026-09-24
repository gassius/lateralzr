import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  MARK_LIGHTBULB_PATH_IDS,
  MARK_NODE_PATH_IDS,
  MARK_PATHS,
  MARK_PATH_IDS,
  MARK_VIEWBOX,
  WORDMARK_PATH_IDS,
  markTextureSvg,
  markViewBoxAttr,
} from '../assets/images/lateralzrMark.ts';
import { Palette } from '../constants/Colors.ts';
import { CONCEPT_FRONT_LABEL_FONT_SIZE } from './conceptFrontLabelAlign.ts';
import { contrastRatio } from './coachHintPresentation.ts';
import {
  CARD_BRAND_BACK_OPACITY,
  CARD_BRAND_BACK_WIDTH_RATIO,
  CARD_BRAND_FACE_COLOR,
  CARD_BRAND_FILL,
  CARD_BRAND_FRONT_OPACITY,
  CARD_BRAND_FRONT_WIDTH_RATIO,
  CARD_BRAND_INK,
  CARD_BRAND_TITLE_COLOR,
  CARD_BRAND_TITLE_MIN_CONTRAST,
  cardBrandBlendedFace,
  cardBrandInkTitleContrast,
  cardBrandIsInteractive,
  cardBrandIsSecondaryToTitle,
  cardBrandPlainTitleContrast,
  cardBrandSize,
  cardBrandTitleContrast,
  cardBrandUsesMotion,
} from './conceptCardBrand.ts';

const here = dirname(fileURLToPath(import.meta.url));
const logoSvg = readFileSync(join(here, '../assets/images/lateralzr_logo.svg'), 'utf8');

describe('concept card brand mark identity', () => {
  it('uses the logo node graph and lightbulb, never the wordmark letters', () => {
    assert.equal(MARK_PATHS.length, MARK_PATH_IDS.length);
    assert.ok(MARK_NODE_PATH_IDS.length >= 8);
    assert.deepEqual([...MARK_LIGHTBULB_PATH_IDS], ['path207', 'path208', 'path210', 'path212']);
    assert.deepEqual([...WORDMARK_PATH_IDS], [
      'path179',
      'path180',
      'path181',
      'path182',
      'path183',
      'path184',
      'path185',
      'path186',
      'path187',
    ]);

    const ids = MARK_PATHS.map((path) => path.id);
    for (const reserved of WORDMARK_PATH_IDS) {
      assert.equal(ids.includes(reserved), false);
    }
    for (const path of MARK_PATHS) {
      assert.match(logoSvg, new RegExp(`id="${path.id}"`));
      assert.ok(logoSvg.includes(path.d));
      assert.ok(logoSvg.includes(path.transform));
    }
    for (const bulb of MARK_LIGHTBULB_PATH_IDS) {
      assert.ok(ids.includes(bulb));
    }
  });

  it('crops to the mark lockup instead of the full word + graph logo', () => {
    assert.ok(MARK_VIEWBOX.y + MARK_VIEWBOX.height <= 208);
    assert.ok(MARK_VIEWBOX.width / MARK_VIEWBOX.height < 1.2);
    assert.equal(
      markViewBoxAttr(),
      `${MARK_VIEWBOX.x} ${MARK_VIEWBOX.y} ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`,
    );
  });

  it('emits a static monochrome SVG with the mark paths', () => {
    const xml = markTextureSvg(CARD_BRAND_FILL, CARD_BRAND_FRONT_OPACITY);
    assert.match(xml, /viewBox="48 4 196 204"/);
    assert.match(xml, new RegExp(`fill="${CARD_BRAND_FILL}"`));
    assert.match(xml, new RegExp(`opacity="${CARD_BRAND_FRONT_OPACITY}"`));
    assert.match(xml, /id="path188"/);
    assert.match(xml, /id="path212"/);
    assert.doesNotMatch(xml, /id="path179"/);
    assert.doesNotMatch(xml, /<animate/i);
  });
});

describe('concept card brand hierarchy', () => {
  it('stays secondary to the 48px concept title', () => {
    assert.ok(cardBrandIsSecondaryToTitle());
    assert.ok(CARD_BRAND_FRONT_OPACITY <= 0.18);
    assert.ok(CARD_BRAND_FRONT_WIDTH_RATIO <= 0.58);
    assert.ok(CARD_BRAND_FRONT_WIDTH_RATIO >= 0.4);
    assert.ok(CARD_BRAND_FRONT_WIDTH_RATIO > CARD_BRAND_BACK_WIDTH_RATIO);
    assert.ok(CARD_BRAND_BACK_OPACITY <= CARD_BRAND_FRONT_OPACITY);
    assert.equal(CONCEPT_FRONT_LABEL_FONT_SIZE, 48);
  });

  it('is decorative texture, not a control and not motion', () => {
    assert.equal(cardBrandIsInteractive(), false);
    assert.equal(cardBrandUsesMotion(), false);
  });

  it('sizes the front mark from the orange face, not the laterality bar', () => {
    const front = cardBrandSize(340, 'front');
    const back = cardBrandSize(340, 'back');
    assert.ok(Math.abs(front.width - 340 * CARD_BRAND_FRONT_WIDTH_RATIO) < 0.01);
    assert.ok(back.width < front.width);
    assert.ok(front.height > 0);
  });
});

describe('concept card brand contrast', () => {
  it('uses a light watermark so title contrast does not regress', () => {
    assert.equal(CARD_BRAND_FACE_COLOR, Palette.orange);
    assert.equal(CARD_BRAND_TITLE_COLOR, Palette.darkBlue);
    assert.equal(CARD_BRAND_INK, Palette.ink);
    assert.equal(CARD_BRAND_FILL, '#ffffff');

    const plain = cardBrandPlainTitleContrast();
    const overFront = cardBrandTitleContrast('front');
    const overBack = cardBrandTitleContrast('back');
    assert.ok(plain >= CARD_BRAND_TITLE_MIN_CONTRAST);
    assert.ok(overFront >= plain);
    assert.ok(overBack >= plain);
    assert.ok(overFront >= CARD_BRAND_TITLE_MIN_CONTRAST);
    assert.ok(cardBrandInkTitleContrast('front') >= 4.5);

    const blended = cardBrandBlendedFace('front');
    assert.ok(contrastRatio(Palette.darkBlue, blended) >= plain);
  });
});
