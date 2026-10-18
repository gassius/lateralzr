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
import { color, pattern } from '../theme/tokens.ts';
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
const masterDir = join(here, '../assets/pattern');

// Masters committed byte-identical from ClickUp 1amjtreveb6 (Lz-58).
const MASTER_SHA256 = {
  'pattern-master-v3.4.png':
    'ed9ad7d677b266a6e3cc0cfc4ac6e4a5d20ffe2901f2285948845131aed539dc',
  'lateralzr-pattern-network-descending-v3.4-study.svg':
    '9c4d4c0b8cfeea8d93dc85d319c1a1e973d3ecaaf82e07f672864f383d65c28b',
  'lateralzr-pattern-network-ascending-v3.4.svg':
    '00b913afa5dd671b78b2405c5f0282fd19ea18a468e2651da34fe089f9ae45b9',
  'lateralzr-pattern-network-edge-v3.4.svg':
    '8ab25757b5e89f5e3bc8b4ba96f4fad293c00bb4e23dcac25e4cb2c4b7f8ee8f',
} as const;

const EXPECTED_SHA256 = {
  'lateralzr-pattern-01-descending-current.svg':
    '675a5417ed040160d772f882c2f4770355415208e37e012c819fc7ab4e32b22c',
  'lateralzr-pattern-02-ascending-current.svg':
    '95e31214fa64b564da8520b31c1604c83b7bf5d1a320ed7d92ffc77a78a86f6d',
  'lateralzr-pattern-03-edge-current.svg':
    'b89eacc258fbb4c34539de3073af64ce7d53ee1c6c3ca0c4d417e21ea49cd809',
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

describe('pattern SVG assets (v3.4 masters + regenerated production)', () => {
  it('commits the v3.4 masters byte-identical (ClickUp 1amjtreveb6)', () => {
    for (const [name, expected] of Object.entries(MASTER_SHA256)) {
      const bytes = readFileSync(join(masterDir, name));
      const digest = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest, expected, name);
    }
  });

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
    assert.doesNotMatch(PATTERN_SVG_01_DESCENDING, /feGaussianBlur|glow-halo/);
    assert.doesNotMatch(PATTERN_SVG_02_ASCENDING, /feGaussianBlur|glow-halo/);
    assert.doesNotMatch(PATTERN_SVG_03_EDGE, /feGaussianBlur|glow-halo/);
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

function motifScale(m: { sx: number; sy: number }): number {
  return Math.max(Math.abs(m.sx), Math.abs(m.sy));
}

function segmentsProperlyCross(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  const same = (x: number, y: number, u: number, v: number) =>
    Math.hypot(x - u, y - v) < 0.01;
  if (
    same(a.x1, a.y1, b.x1, b.y1) ||
    same(a.x1, a.y1, b.x2, b.y2) ||
    same(a.x2, a.y2, b.x1, b.y1) ||
    same(a.x2, a.y2, b.x2, b.y2)
  ) {
    return false;
  }
  const orient = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ) => (y2 - y1) * (x3 - x2) - (x2 - x1) * (y3 - y2);
  const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

describe('v3.4 network constraints', () => {
  // Master counts (ClickUp 1amjtrevebb): descending 10+2, ascending 8+2, edge 7+2.
  const MASTER_COUNTS = [
    { current: 10, echo: 2, connectors: 10 },
    { current: 8, echo: 2, connectors: 8 },
    { current: 7, echo: 2, connectors: 8 },
  ] as const;

  it('pins motif counts to the v3.4 masters', () => {
    for (const [index, table] of PATTERN_VARIANT_PLACEMENTS.entries()) {
      const current = table.motifs.filter((m) => m.cy <= 400);
      const echo = table.motifs.filter((m) => m.cy > 400);
      const expected = MASTER_COUNTS[index]!;
      assert.equal(current.length, expected.current, `variant ${index} current`);
      assert.equal(echo.length, expected.echo, `variant ${index} echo`);
      assert.equal(table.connectors.length, expected.connectors, `variant ${index} connectors`);
      const ids = new Set(table.motifs.map((m) => m.id));
      for (const c of table.connectors) {
        assert.ok(ids.has(c.from) && ids.has(c.to), `${c.id} must be node-to-node`);
        assert.notEqual(c.from, c.to);
      }
    }
  });

  it('keeps connectors from crossing and arms within 1.6× stretch', () => {
    for (const [index, table] of PATTERN_VARIANT_PLACEMENTS.entries()) {
      const scales = table.motifs.map(motifScale);
      const minScale = Math.min(...scales);
      for (const motif of table.motifs) {
        assert.ok(
          motifScale(motif) / minScale <= pattern.maxArmStretch + 1e-9,
          `variant ${index} ${motif.id} stretch ${motifScale(motif) / minScale}`,
        );
      }
      const lines = table.connectors.map((c) => {
        const from = table.motifs.find((m) => m.id === c.from)!;
        const to = table.motifs.find((m) => m.id === c.to)!;
        return { id: c.id, x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy };
      });
      for (let i = 0; i < lines.length; i += 1) {
        for (let j = i + 1; j < lines.length; j += 1) {
          assert.equal(
            segmentsProperlyCross(lines[i]!, lines[j]!),
            false,
            `variant ${index} ${lines[i]!.id} crosses ${lines[j]!.id}`,
          );
        }
      }
    }
  });

  it('keeps every motif outside the SVG default clear area', () => {
    for (const variant of [0, 1, 2] as const) {
      const clear = defaultTitleClearForVariant(variant);
      assert.deepEqual(motifsIntersectingClearArea(variant, clear), []);
    }
  });
});

describe('motifBoundingBox (exact ±0.5)', () => {
  it('matches rotated+mirrored v0 m02 (rotate 0.8, sx −0.3163)', () => {
    const m02 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm02')!;
    assert.equal(m02.rotate, 0.8);
    assert.equal(m02.sx, -0.3163);
    assertRectClose(motifBoundingBox(m02), {
      x: 78.6666116190604,
      y: 17.74092734222627,
      width: 62.88966947427144,
      height: 65.38449291989441,
    });
  });

  it('matches unmirrored v0 m01', () => {
    const m01 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm01')!;
    assert.ok(m01.sx > 0);
    assertRectClose(motifBoundingBox(m01), {
      x: 9.424796002431634,
      y: 21.67254113735624,
      width: 63.56363710757077,
      height: 65.50889976593217,
    });
  });

  it('hides only the motif that crosses a tight clear boundary (~2 units)', () => {
    const m10 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm10')!;
    const m08 = PATTERN_VARIANT_PLACEMENTS[0].motifs.find((m) => m.id === 'm08')!;
    const bb10 = motifBoundingBox(m10);
    const bb08 = motifBoundingBox(m08);
    const clearTop = bb10.y + bb10.height - 2;
    const clear: PatternRect = {
      x: 20,
      y: clearTop,
      width: 318,
      height: 168,
    };
    assert.ok(bb10.y + bb10.height > clear.y, 'm10 must cross into clear');
    assert.ok(bb10.y + bb10.height - clear.y < 2.5, 'crossing depth ~2');
    assert.ok(bb08.y + bb08.height <= clear.y + 0.5, 'm08 stays above clear');
    const hidden = motifsIntersectingClearArea(0, clear);
    assert.ok(hidden.includes('m10'));
    assert.equal(hidden.includes('m08'), false);
  });
});

describe('title clearing', () => {
  it('pins the default clear area to the SVG table', () => {
    for (const variant of [0, 1, 2] as const) {
      const clear = defaultTitleClearForVariant(variant);
      assert.deepEqual(clear, PATTERN_VARIANT_PLACEMENTS[variant].titleClear);
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
      assert.ok(els.length >= 15, `${id} should appear in relief uses`);
      if (hiddenSet.has(id)) {
        for (const el of els) {
          assert.match(el, /display="none"/, `hidden ${id}: ${el.slice(0, 120)}`);
        }
        continue;
      }
      for (const el of els) {
        const end = /\bdata-motif-end="(m\d+)"/.exec(el)?.[1];
        // Inter-bulb connectors hide when either end is in the title clearing.
        if (end && hiddenSet.has(end)) {
          assert.match(el, /display="none"/, `connector into hidden ${end}`);
          continue;
        }
        assert.doesNotMatch(el, /display="none"/, `visible ${id} must not be hidden`);
      }
    }
    // Pulse groups specifically (mutation: skip <g> tags).
    for (const id of hiddenMotifs) {
      const groups = [...xml.matchAll(new RegExp(`<g\\b[^>]*data-motif="${id}"[^>]*>`, 'g'))];
      for (const g of groups) {
        assert.match(g[0]!, /display="none"/);
      }
    }
    assert.match(xml, /id="motif-bulb"/);
    assert.equal(hideMotifsInPatternSvg(PATTERN_SVG_01_DESCENDING, []), PATTERN_SVG_01_DESCENDING);
  });
});

describe('patternVariantPlacements ↔ SVG (M1)', () => {
  it('matches every use.bulb transform and #title-clear-area from the v3.4 files', () => {
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
