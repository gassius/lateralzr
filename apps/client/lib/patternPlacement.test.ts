import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  PATTERN_SVG_01_DESCENDING,
  PATTERN_SVG_02_ASCENDING,
  PATTERN_SVG_03_EDGE,
  PATTERN_SVG_BY_VARIANT,
  PATTERN_SVG_FILENAMES,
} from '../assets/images/pattern/patternXml.ts';
import { PATTERN_CARD_FILL, PATTERN_RELIEF, PATTERN_TITLE_CLEAR_MARGIN_PX } from '../theme/pattern.ts';
import { color } from '../theme/tokens.ts';
import {
  buildPatternSvgXml,
  defaultTitleClearForVariant,
  expandRect,
  faceRectToCardUnits,
  hideMotifsInPatternSvg,
  motifBoundingBox,
  motifsIntersectingClearArea,
  patternVariantName,
  resolvePatternClearArea,
  variantFor,
  type PatternRect,
} from './patternPlacement.ts';
import { PATTERN_VARIANT_PLACEMENTS } from './patternVariantPlacements.ts';

const here = dirname(fileURLToPath(import.meta.url));
const patternDir = join(here, '../assets/images/pattern');

const EXPECTED_SHA256 = {
  'lateralzr-pattern-01-descending-current.svg':
    '7046310f0938d30b863671e44ea80192b97f4ad02b3d89f0892354991b7b1276',
  'lateralzr-pattern-02-ascending-current.svg':
    'afa7d92096936da9ca0c7eff5c65501ed9d723c3220826fef24a9439846a552b',
  'lateralzr-pattern-03-edge-current.svg':
    '2f5c34364c3c0002b3ad8de338c80517f10825f638ce96ca3d0a78d59ba938b6',
} as const;

function assertRectClose(actual: PatternRect, expected: PatternRect, tol = 0.5) {
  assert.ok(Math.abs(actual.x - expected.x) <= tol, `x ${actual.x} vs ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= tol, `y ${actual.y} vs ${expected.y}`);
  assert.ok(Math.abs(actual.width - expected.width) <= tol, `w ${actual.width} vs ${expected.width}`);
  assert.ok(
    Math.abs(actual.height - expected.height) <= tol,
    `h ${actual.height} vs ${expected.height}`,
  );
}

function motifElementsById(xml: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const re = /<(?:use|g)\b[^>]*\sdata-motif="(m\d+)"[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) != null) {
    const id = match[1]!;
    const list = map.get(id) ?? [];
    list.push(match[0]!);
    map.set(id, list);
  }
  return map;
}

describe('pattern SVG assets (byte-identical to Critiquito v3.3.1)', () => {
  it('ships the three production files with locked checksums', () => {
    for (const name of PATTERN_SVG_FILENAMES) {
      const bytes = readFileSync(join(patternDir, name));
      const digest = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest, EXPECTED_SHA256[name], name);
    }
  });

  it('keeps SvgXml string exports identical to the on-disk SVG files', () => {
    const exported = [
      PATTERN_SVG_01_DESCENDING,
      PATTERN_SVG_02_ASCENDING,
      PATTERN_SVG_03_EDGE,
    ];
    for (let i = 0; i < PATTERN_SVG_FILENAMES.length; i += 1) {
      const disk = readFileSync(join(patternDir, PATTERN_SVG_FILENAMES[i]!), 'utf8');
      assert.equal(exported[i], disk);
      assert.equal(PATTERN_SVG_BY_VARIANT[i], disk);
    }
  });

  it('keeps pattern relief colours out of UI tokens and on the SVG', () => {
    assert.equal(PATTERN_CARD_FILL, color.front);
    assert.equal(PATTERN_RELIEF.shade.fill, '#C9670F');
    assert.equal(PATTERN_RELIEF.highlight.fill, '#FFB867');
    assert.equal(PATTERN_RELIEF.core.fill, '#EC8318');
    assert.match(PATTERN_SVG_01_DESCENDING, /id="relief-shade"[^>]*fill="#C9670F"/);
    assert.doesNotMatch(JSON.stringify(color), /C9670F|FFB867|EC8318/);
  });
});

describe('variantFor', () => {
  it('is deterministic and stable for the same concept key', () => {
    assert.equal(variantFor('Mushroom'), variantFor('mushroom'));
    assert.equal(variantFor('  Tide '), variantFor('tide'));
    assert.equal(variantFor('mushroom'), variantFor('mushroom'));
  });

  it('locks fixture labels to placement indices (product keys, not URL aliases)', () => {
    // E2E long-label fixture uses the full phrase — that hashes to edge (2), not 0.
    assert.equal(
      variantFor('extraordinarily elaborate multidisciplinary conceptual framework'),
      2,
    );
    assert.equal(variantFor('tide'), 1);
    assert.equal(patternVariantName(1), 'ascending-current');
    assert.equal(variantFor('mushroom'), 2);
    assert.equal(patternVariantName(2), 'edge-current');
    assert.equal(variantFor('creativity'), 0);
    assert.equal(patternVariantName(0), 'descending-current');
  });

  it('covers all three buckets over a sample of keys', () => {
    const keys = [
      'a',
      'b',
      'c',
      'creativity',
      'diagram',
      'seta',
      'psychedelics',
      'collective intelligence',
      'intergenerational',
      'transparent',
      'loading-deck',
    ];
    const seen = new Set(keys.map((k) => variantFor(k)));
    assert.equal(seen.size, 3);
  });
});

describe('motifBoundingBox (exact ±0.5)', () => {
  it('matches rotated+mirrored v0 m02 (rotate 8, sx −0.3571)', () => {
    const m02 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm02')!;
    assert.equal(m02.rotate, 8);
    assert.equal(m02.sx, -0.3571);
    // Locked against drop-rotation / ignore-mirroring / collapse-right-edge mutations.
    assertRectClose(motifBoundingBox(m02), {
      x: 76.76734524472573,
      y: 24.093330207035052,
      width: 79.44898428811172,
      height: 81.88039239206992,
    });
  });

  it('matches unmirrored v0 m01', () => {
    const m01 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm01')!;
    assert.ok(m01.sx > 0);
    assertRectClose(motifBoundingBox(m01), {
      x: 4.492222313424108,
      y: 4.584898743203063,
      width: 74.05560831032624,
      height: 76.00461325677779,
    });
  });

  it('hides only the motif that crosses a tight clear boundary (~2 units)', () => {
    // v0 m10 bottom ≈ 224.7; neighbour m05 bottom ≈ 211.7. Clear clips m10 by ~2 only.
    const m10 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm10')!;
    const m05 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm05')!;
    const bb10 = motifBoundingBox(m10);
    const bb05 = motifBoundingBox(m05);
    const clearTop = bb10.y + bb10.height - 2;
    const clear: PatternRect = {
      x: 20,
      y: clearTop,
      width: 318,
      height: 168,
    };
    assert.ok(bb10.y + bb10.height > clear.y, 'm10 must cross into clear');
    assert.ok(bb10.y + bb10.height - clear.y < 2.5, 'crossing depth ~2');
    assert.ok(bb05.y + bb05.height <= clear.y + 0.5, 'm05 stays above clear');
    const hidden = motifsIntersectingClearArea(0, clear);
    assert.ok(hidden.includes('m10'));
    assert.equal(hidden.includes('m05'), false);
  });
});

describe('title clearing', () => {
  it('keeps every motif outside the SVG default clear area', () => {
    for (const variant of [0, 1, 2] as const) {
      const clear = defaultTitleClearForVariant(variant);
      assert.deepEqual(clear, PATTERN_VARIANT_PLACEMENTS[variant].titleClear);
      assert.deepEqual(motifsIntersectingClearArea(variant, clear), []);
      for (const motif of PATTERN_VARIANT_PLACEMENTS[variant].motifs) {
        assert.ok(motifBoundingBox(motif).width > 0);
      }
    }
  });

  it('hides motifs that intersect a tall measured title box + 16 px', () => {
    const tallTitle = { x: 20, y: 180, width: 318, height: 220 };
    const clear = expandRect(tallTitle, PATTERN_TITLE_CLEAR_MARGIN_PX);
    const hidden = motifsIntersectingClearArea(0, clear);
    assert.ok(hidden.length > 0, 'expected at least one motif under a tall title');
    assert.equal(hidden.includes('m11'), false);
    assert.equal(hidden.includes('m12'), false);
  });

  it('maps face-pixel title rects through xMidYMid slice into card units', () => {
    const face = { width: 358, height: 560 };
    const title = { x: 44, y: 260, width: 280, height: 40 };
    const inCard = faceRectToCardUnits(title, face.width, face.height);
    assert.ok(Math.abs(inCard.x - 44) < 0.01);
    assert.ok(Math.abs(inCard.y - 260) < 0.01);

    const resolved = resolvePatternClearArea({
      variant: 0,
      titleFaceRect: title,
      faceWidth: face.width,
      faceHeight: face.height,
    });
    assert.ok(Math.abs(resolved.x - (title.x - 16)) < 0.01);
    assert.ok(Math.abs(resolved.y - (title.y - 16)) < 0.01);
  });

  it('does not hide edge motifs for a short ink-hugging title on variant 03', () => {
    const shortInk = { x: 24, y: 280, width: 160, height: 37 };
    const clear = resolvePatternClearArea({
      variant: 2,
      titleFaceRect: shortInk,
      faceWidth: 358,
      faceHeight: 560,
    });
    assert.deepEqual(motifsIntersectingClearArea(2, clear), []);
  });

  it('sets display="none" on every data-motif element for hidden ids (incl. pulse <g>)', () => {
    const { xml, hiddenMotifs, variant } = buildPatternSvgXml({
      conceptKey: 'creativity',
      titleFaceRect: { x: 20, y: 160, width: 318, height: 240 },
      faceWidth: 358,
      faceHeight: 560,
      variantOverride: 0,
    });
    assert.equal(variant, 0);
    assert.ok(hiddenMotifs.length > 0);
    const byId = motifElementsById(xml);
    const hiddenSet = new Set(hiddenMotifs);
    for (const [id, els] of byId) {
      assert.ok(els.length >= 19, `${id} should appear in relief uses + pulse groups`);
      if (hiddenSet.has(id)) {
        for (const el of els) {
          assert.match(el, /display="none"/, `hidden ${id}: ${el.slice(0, 120)}`);
        }
      } else {
        for (const el of els) {
          assert.doesNotMatch(el, /display="none"/, `visible ${id} must not be hidden`);
        }
      }
    }
    // Pulse groups specifically (mutation: skip <g> tags).
    for (const id of hiddenMotifs) {
      const groups = [...xml.matchAll(new RegExp(`<g\\b[^>]*data-motif="${id}"[^>]*>`, 'g'))];
      assert.ok(groups.length > 0, `expected pulse <g> for ${id}`);
      for (const g of groups) {
        assert.match(g[0]!, /display="none"/);
      }
    }
    assert.match(xml, /id="motif-bulb"/);
    assert.equal(hideMotifsInPatternSvg(PATTERN_SVG_01_DESCENDING, []), PATTERN_SVG_01_DESCENDING);
  });
});

describe('patternVariantPlacements ↔ SVG (M1)', () => {
  it('matches every use.bulb transform and #title-clear-area from the v3.3.1 files', () => {
    for (let v = 0; v < 3; v += 1) {
      const svg = PATTERN_SVG_BY_VARIANT[v]!;
      const table = PATTERN_VARIANT_PLACEMENTS[v]!;
      const clear = svg.match(
        /id="title-clear-area"\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/,
      );
      assert.ok(clear, `variant ${v} title-clear-area`);
      assert.equal(Number(clear[1]), table.titleClear.x);
      assert.equal(Number(clear[2]), table.titleClear.y);
      assert.equal(Number(clear[3]), table.titleClear.width);
      assert.equal(Number(clear[4]), table.titleClear.height);

      const core = svg.match(
        /<g id="relief-core"[^>]*>([\s\S]*?)<\/g>\s*<g id="connectors"/,
      );
      assert.ok(core, `variant ${v} relief-core`);
      const bulbs = [
        ...core[1]!.matchAll(
          /<use class="bulb" data-motif="(m\d+)" href="#motif-bulb" transform="translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\(([-\d.]+) ([-\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)"\/>/g,
        ),
      ];
      assert.equal(bulbs.length, table.motifs.length, `variant ${v} motif count`);
      for (const row of bulbs) {
        const id = row[1]!;
        const placed = table.motifs.find((m) => m.id === id);
        assert.ok(placed, `table missing ${id}`);
        assert.equal(placed.cx, Number(row[2]));
        assert.equal(placed.cy, Number(row[3]));
        assert.equal(placed.rotate, Number(row[4]));
        assert.equal(placed.sx, Number(row[5]));
        assert.equal(placed.sy, Number(row[6]));
        assert.equal(placed.ox, Number(row[7]));
        assert.equal(placed.oy, Number(row[8]));
      }
    }
  });
});
