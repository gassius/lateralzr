import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { motion } from '@/theme/tokens';
import {
  FLIP_EASING,
  FLIP_MS,
  FLIP_REDUCED_MOTION_CROSSFADE_MS,
  cardFlipA11yFace,
  cardFlipFaceStyle,
  cardFlipTransformHasRotateOrPerspective,
  flipDurationMs,
  flipUses3d,
} from '@/lib/cardFlip';
import { resolveReducedMotion } from '@/lib/reducedMotion';

const here = path.dirname(fileURLToPath(import.meta.url));
const stackSrc = readFileSync(path.join(here, '../components/ConceptCardStack.tsx'), 'utf8');
const cueSrc = readFileSync(path.join(here, '../components/ComplexityCue.tsx'), 'utf8');
const coachSrc = readFileSync(path.join(here, '../hooks/useDiscoveryCoaching.ts'), 'utf8');
const lateralitySheetSrc = readFileSync(
  path.join(here, '../components/LateralitySheet.tsx'),
  'utf8',
);
const hookSrc = readFileSync(path.join(here, '../hooks/useReducedMotion.ts'), 'utf8');

describe('card flip tokens', () => {
  it('pins flip duration to motion.flip.ms (360, bidirectional)', () => {
    assert.equal(FLIP_MS, motion.flip.ms);
    assert.equal(FLIP_MS, motion.flipMs);
    assert.equal(FLIP_MS, 360);
    assert.equal(motion.flip.bidirectional, true);
    assert.equal(FLIP_REDUCED_MOTION_CROSSFADE_MS, motion.reducedMotionCrossfadeMs);
    assert.equal(FLIP_REDUCED_MOTION_CROSSFADE_MS, 150);
  });
});

describe('flip duration / 3D gate', () => {
  it('uses 360 ms full flip and 150 ms RM cross-fade', () => {
    assert.equal(flipDurationMs(false), 360);
    assert.equal(flipDurationMs(true), 150);
    assert.equal(flipUses3d(false), true);
    assert.equal(flipUses3d(true), false);
  });

  it('app Reduced preference selects the RM flip path when OS/web are off (PRR B1)', () => {
    const reduceMotion = resolveReducedMotion({
      os: false,
      web: false,
      appPref: 'reduced',
    });
    assert.equal(reduceMotion, true);
    assert.equal(flipUses3d(reduceMotion), false);
    assert.equal(flipDurationMs(reduceMotion), FLIP_REDUCED_MOTION_CROSSFADE_MS);
  });

  it('FLIP_EASING is cubic ease-out', () => {
    assert.equal(FLIP_EASING(0), 0);
    assert.equal(FLIP_EASING(1), 1);
    assert.ok(FLIP_EASING(0.5) > 0.5);
    assert.ok(Math.abs(FLIP_EASING(0.5) - (1 - 0.5 ** 3)) < 1e-12);
  });
});

describe('app-wide Motion preference wiring (PRR B1)', () => {
  it('card stack, cue, coaching, Laterality sheet call useReducedMotion() (context)', () => {
    assert.match(stackSrc, /useReducedMotion\(\)/);
    assert.match(cueSrc, /useReducedMotion\(\)/);
    assert.match(coachSrc, /useReducedMotion\(\)/);
    assert.match(lateralitySheetSrc, /useReducedMotion\(\)/);
    assert.match(lateralitySheetSrc, /reduceMotion=\{reduceMotion\}/);
    assert.match(hookSrc, /useMotionPreference\(\)/);
  });
});

describe('back→front flip progress lives on the stack (AD B1)', () => {
  it('stack animates flipProgress on toggle and passes the shared value into the card', () => {
    const cardSrc = readFileSync(path.join(here, '../components/ConceptCard.tsx'), 'utf8');
    const flipSrc = readFileSync(path.join(here, 'cardFlip.ts'), 'utf8');
    assert.match(stackSrc, /const flipProgress = useSharedValue\(0\)/);
    assert.match(stackSrc, /flipProgress\.value = withTiming\(next \? 1 : 0/);
    assert.match(stackSrc, /flipProgress=\{flipProgress\}/);
    assert.match(cardSrc, /flipProgressShared/);
    assert.match(flipSrc, /rotateY: `\$\{-180 \+ 180 \* p\}deg`/);
  });
});

describe('cardFlipFaceStyle', () => {
  it('under RM: opacity only, no rotate / perspective', () => {
    const front = cardFlipFaceStyle(0.4, 'front', true);
    const back = cardFlipFaceStyle(0.4, 'back', true);
    assert.equal(front.opacity, 0.6);
    assert.equal(back.opacity, 1);
    assert.deepEqual(front.transform, []);
    assert.deepEqual(back.transform, []);
    assert.equal(cardFlipTransformHasRotateOrPerspective(front.transform), false);
    assert.equal(cardFlipTransformHasRotateOrPerspective(back.transform), false);
  });

  it('under RM: lower face stays fully opaque at mid cross-fade (no navy flash)', () => {
    const front = cardFlipFaceStyle(0.5, 'front', true);
    const back = cardFlipFaceStyle(0.5, 'back', true);
    assert.equal(Math.max(front.opacity, back.opacity), 1);
    assert.equal(front.opacity, 0.5);
    assert.equal(back.opacity, 1);
    assert.equal(cardFlipFaceStyle(0, 'back', true).opacity, 0);
    assert.equal(cardFlipFaceStyle(0.01, 'back', true).opacity, 1);
  });

  it('under RM: settled hidden face uses scale(0) so layout box collapses', () => {
    assert.deepEqual(cardFlipFaceStyle(1, 'front', true).transform, [{ scale: 0 }]);
    assert.deepEqual(cardFlipFaceStyle(0, 'back', true).transform, [{ scale: 0 }]);
    assert.deepEqual(cardFlipFaceStyle(0, 'front', true).transform, []);
    assert.deepEqual(cardFlipFaceStyle(1, 'back', true).transform, []);
    assert.equal(
      cardFlipTransformHasRotateOrPerspective(cardFlipFaceStyle(1, 'front', true).transform),
      false,
    );
  });

  it('full motion: rotateY + perspective at mid flip', () => {
    const front = cardFlipFaceStyle(0.5, 'front', false);
    const back = cardFlipFaceStyle(0.5, 'back', false);
    assert.equal(cardFlipTransformHasRotateOrPerspective(front.transform), true);
    assert.equal(cardFlipTransformHasRotateOrPerspective(back.transform), true);
    assert.ok(front.transform.some((s) => 'rotateY' in s));
    assert.ok(back.transform.some((s) => 'perspective' in s));
  });

  it('pins rotateY 0→180 front and −180→0 back (symmetric both directions)', () => {
    const rotateY = (
      progress: number,
      face: 'front' | 'back',
    ): string => {
      const step = cardFlipFaceStyle(progress, face, false).transform.find(
        (s): s is { rotateY: string } => 'rotateY' in s,
      );
      assert.ok(step, `expected rotateY at p=${progress} ${face}`);
      return step.rotateY;
    };

    assert.equal(rotateY(0, 'front'), '0deg');
    assert.equal(rotateY(0.5, 'front'), '90deg');
    assert.equal(rotateY(1, 'front'), '180deg');

    assert.equal(rotateY(0, 'back'), '-180deg');
    assert.equal(rotateY(0.5, 'back'), '-90deg');
    assert.equal(rotateY(1, 'back'), '0deg');

    assert.equal(rotateY(0.99, 'front'), `${180 * 0.99}deg`);
    assert.equal(rotateY(0.99, 'back'), `${-180 + 180 * 0.99}deg`);
    assert.notEqual(rotateY(1, 'back'), '360deg');
    assert.notEqual(rotateY(0, 'back'), '180deg');
  });

  it('exposes only one AT face after the midpoint', () => {
    assert.equal(cardFlipA11yFace(0), 'front');
    assert.equal(cardFlipA11yFace(0.49), 'front');
    assert.equal(cardFlipA11yFace(0.5), 'back');
    assert.equal(cardFlipA11yFace(1), 'back');
  });

  it('endpoints: front visible at 0, back at 1 (both modes)', () => {
    for (const rm of [false, true]) {
      assert.equal(cardFlipFaceStyle(0, 'front', rm).opacity, 1);
      assert.equal(cardFlipFaceStyle(0, 'back', rm).opacity, 0);
      assert.equal(cardFlipFaceStyle(1, 'front', rm).opacity, 0);
      assert.equal(cardFlipFaceStyle(1, 'back', rm).opacity, 1);
    }
  });
});
