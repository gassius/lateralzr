import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { media } from '../theme/tokens.ts';
import {
  CARD_BACK_MEDIA_CONTAIN_INSET,
  CARD_BACK_MEDIA_FADE_RATIO,
  CARD_BACK_MEDIA_MAX_UPSCALE,
  CARD_BACK_MEDIA_MIN_BAND_RATIO,
  CARD_BACK_MEDIA_MIN_READING_STRIP,
  CARD_BACK_MEDIA_SEAM_OVERLAP,
  coverUpscaleFactor,
  mediaTypeIsJpegOrWebp,
  mediaUrlIsJpegOrWebp,
  mediaUrlPathname,
  CARD_BACK_MEDIA_REPEAT,
  resolveCardBackCoverPosition,
  resolveCardBackMediaBand,
  resolveCardBackMediaFade,
  resolveCardBackMediaFit,
  resolveCardBackMediaPaintSpec,
  resolveContainMediaBox,
  resolveInformativeAlt,
} from './cardBackMedia';

test('mediaUrlPathname strips query/hash and lowercases', () => {
  assert.equal(
    mediaUrlPathname('https://cdn.example/a/Photo.PNG?x=1#frag'),
    '/a/photo.png',
  );
  assert.equal(mediaUrlPathname('/local/Diagram.SVG'), '/local/diagram.svg');
  assert.equal(mediaUrlPathname(''), '');
});

test('measured format gate is jpeg/webp only — never an extension-as-purpose heuristic', () => {
  assert.equal(mediaUrlIsJpegOrWebp('https://x.test/a.png'), false);
  assert.equal(mediaUrlIsJpegOrWebp('https://x.test/a.PNG?w=1'), false);
  assert.equal(mediaUrlIsJpegOrWebp('https://x.test/a.svg'), false);
  assert.equal(mediaUrlIsJpegOrWebp('https://x.test/a.jpg'), true);
  assert.equal(mediaUrlIsJpegOrWebp('https://x.test/a.jpeg'), true);
  assert.equal(mediaUrlIsJpegOrWebp('https://x.test/a.webp'), true);
  assert.equal(mediaTypeIsJpegOrWebp('image/jpeg'), true);
  assert.equal(mediaTypeIsJpegOrWebp('image/webp'), true);
  assert.equal(mediaTypeIsJpegOrWebp('image/png'), false);
});

test('coverUpscaleFactor is the max axis scale', () => {
  assert.equal(coverUpscaleFactor(100, 100, 200, 150), 2);
  assert.equal(coverUpscaleFactor(200, 100, 100, 100), 1);
  assert.equal(coverUpscaleFactor(0, 100, 200, 150), 1);
});

test('fit: purpose photo covers; diagram/map/artwork/text-bearing contain', () => {
  const slot = { slotWidth: 320, slotHeight: 200, mediaUrl: 'https://x.test/photo.jpg' };
  assert.deepEqual(resolveCardBackMediaFit({ ...slot, purpose: 'photo' }), {
    contentFit: 'cover',
    reason: 'purpose',
  });
  for (const purpose of ['diagram', 'map', 'artwork', 'text-bearing'] as const) {
    assert.deepEqual(
      resolveCardBackMediaFit({ ...slot, mediaUrl: 'https://x.test/x.jpg', purpose }),
      { contentFit: 'contain', reason: 'purpose' },
    );
  }
});

test('fit: purpose wins over a jpeg URL that would otherwise cover', () => {
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/photo.jpg',
      purpose: 'diagram',
      sourceWidth: 800,
      sourceHeight: 600,
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'purpose' },
  );
});

test('fit: unknown purpose never uses extension-only; png/svg contain via format', () => {
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/fixture-transparent.png',
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'format' },
  );
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/icon.svg',
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'format' },
  );
});

test('fit: decoded mediaType wins; extension only when mediaType is null', () => {
  const slot = { slotWidth: 320, slotHeight: 200, sourceWidth: 800, sourceHeight: 600 };
  assert.deepEqual(
    resolveCardBackMediaFit({
      ...slot,
      mediaUrl: 'https://x.test/photo.jpg',
      mediaType: 'image/png',
    }),
    { contentFit: 'contain', reason: 'format' },
  );
  assert.deepEqual(
    resolveCardBackMediaFit({
      ...slot,
      mediaUrl: 'https://x.test/diagram.png',
      mediaType: 'image/jpeg',
    }),
    { contentFit: 'cover', reason: 'measured' },
  );
  assert.deepEqual(
    resolveCardBackMediaFit({
      ...slot,
      mediaUrl: 'https://x.test/photo.jpg',
      mediaType: null,
    }),
    { contentFit: 'cover', reason: 'measured' },
  );
});

test('fit: unknown jpeg covers when aspect 0.6–1.8 and upscale ≤ 1.5×', () => {
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/photo.jpg',
      sourceWidth: 800,
      sourceHeight: 600,
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'cover', reason: 'measured' },
  );
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/photo.jpg',
      sourceWidth: 100,
      sourceHeight: 80,
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'upscale' },
  );
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/pano.jpg',
      sourceWidth: 2000,
      sourceHeight: 400,
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'aspect' },
  );
});

test('band prefers leftover height and floors at 28%', () => {
  const face = 500;
  const minBand = face * CARD_BACK_MEDIA_MIN_BAND_RATIO;
  assert.equal(CARD_BACK_MEDIA_MIN_BAND_RATIO, 0.28);
  assert.equal(CARD_BACK_MEDIA_SEAM_OVERLAP, 2);

  const unmeasured = resolveCardBackMediaBand(face, 0);
  assert.equal(unmeasured.dropImage, false);
  assert.equal(unmeasured.bandHeight, minBand);

  const shortText = resolveCardBackMediaBand(face, 120);
  assert.equal(shortText.dropImage, false);
  assert.equal(shortText.bandHeight, face - 120);

  const withInset = resolveCardBackMediaBand(face, 120, 24);
  assert.equal(withInset.dropImage, false);
  assert.equal(withInset.bandHeight, face - 120 - 24);

  const tallText = resolveCardBackMediaBand(face, 400, 24);
  assert.equal(tallText.dropImage, false);
  assert.equal(tallText.bandHeight, minBand);
  assert.ok(tallText.bandHeight >= minBand);
});

test('band drops the image when a 28% floor leaves no reading strip', () => {
  // face so small that 72% < one body line (+ optional inset)
  const face = CARD_BACK_MEDIA_MIN_READING_STRIP;
  const result = resolveCardBackMediaBand(face, 10);
  assert.equal(result.dropImage, true);
  assert.equal(result.bandHeight, 0);

  const withInset = resolveCardBackMediaBand(
    CARD_BACK_MEDIA_MIN_READING_STRIP + 20,
    10,
    24,
  );
  assert.equal(withInset.dropImage, true);

  assert.deepEqual(resolveCardBackMediaBand(0, 100), { bandHeight: 0, dropImage: true });
  assert.deepEqual(resolveCardBackMediaBand(Number.NaN, 100), {
    bandHeight: 0,
    dropImage: true,
  });
});

test('fade is cover-only and raises the start for dark/busy tone', () => {
  const band = 200;
  const face = 500;
  const cover = resolveCardBackMediaFade({
    bandHeight: band,
    faceHeight: face,
    contentFit: 'cover',
  });
  assert.equal(cover.kind, 'cover');
  assert.equal(cover.startY, band - band * CARD_BACK_MEDIA_FADE_RATIO);
  assert.equal(cover.height, band - cover.startY);

  const raised = resolveCardBackMediaFade({
    bandHeight: band,
    faceHeight: face,
    contentFit: 'cover',
    tone: 'dark',
  });
  assert.equal(raised.kind, 'raised');
  assert.equal(raised.startY, cover.startY - face * 0.15);
  assert.equal(raised.height, band - raised.startY);
  assert.ok(raised.startY < cover.startY);

  const busy = resolveCardBackMediaFade({
    bandHeight: band,
    faceHeight: face,
    contentFit: 'cover',
    tone: 'busy',
  });
  assert.equal(busy.kind, 'raised');
  assert.deepEqual(
    resolveCardBackMediaFade({ bandHeight: band, contentFit: 'contain' }),
    { startY: 0, height: 0, kind: 'none' },
  );
  assert.deepEqual(
    resolveCardBackMediaFade({ bandHeight: 0, contentFit: 'cover' }),
    { startY: 0, height: 0, kind: 'none' },
  );
});

test('cover position maps focalX/focalY the same way on every platform', () => {
  assert.equal(resolveCardBackCoverPosition(), 'center');
  assert.equal(resolveCardBackCoverPosition(null, null), 'center');
  assert.deepEqual(resolveCardBackCoverPosition(0.5, 0.5), {
    left: '50%',
    top: '50%',
  });
  assert.deepEqual(resolveCardBackCoverPosition(0.2, 0.8), {
    left: '20%',
    top: '80%',
  });
  assert.deepEqual(resolveCardBackCoverPosition(1.4, -0.2), {
    left: '100%',
    top: '0%',
  });
});

test('card media never tiles — tokens, paint spec, and ConceptCard agree', () => {
  assert.equal(media.repeat, 'never');
  assert.equal(media.singleInstance, true);
  const cardSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../components/ConceptCard.tsx'),
    'utf8',
  );
  assert.doesNotMatch(cardSrc, /resizeMode\s*=\s*['"]repeat['"]/);
  assert.doesNotMatch(cardSrc, /contentFit\s*=\s*['"](?:repeat|none)['"]/);
  assert.doesNotMatch(cardSrc, /mediaDecoder/);
  assert.doesNotMatch(cardSrc, /card-back-media-decoder/);
  assert.match(cardSrc, /card-back-media-image/);
  assert.match(cardSrc, /resolveCardBackMediaPaintSpec/);
  const imageTags = cardSrc.match(/<Image\b/g) ?? [];
  assert.equal(imageTags.length, 2, 'contain and cover branches are mutually exclusive');
});

test('paint spec is one instance, never tiles, and clips to the fade floor', () => {
  assert.equal(CARD_BACK_MEDIA_REPEAT, 'never');
  const fade = resolveCardBackMediaFade({
    bandHeight: 200,
    contentFit: 'cover',
  });
  const spec = resolveCardBackMediaPaintSpec({
    contentFit: 'cover',
    bandHeight: 200,
    fade,
  });
  assert.equal(spec.visibleInstanceCount, 1);
  assert.equal(spec.repeat, 'never');
  assert.equal(spec.contentFit, 'cover');
  assert.equal(spec.imageClipHeight, 200);
  assert.equal(spec.imageClipHeight, fade.startY + fade.height);
});

test('informative alt is exposed once and skipped when it repeats the description', () => {
  assert.equal(
    resolveInformativeAlt('diagram', 'Lattice of linked nodes', 'A diagram-like map'),
    'Lattice of linked nodes',
  );
  assert.equal(resolveInformativeAlt('map', 'City plan', 'City plan'), null);
  assert.equal(resolveInformativeAlt('photo', 'A portrait', 'A portrait of X'), null);
  assert.equal(resolveInformativeAlt('diagram', '  ', 'Something'), null);
  assert.equal(resolveInformativeAlt('artwork', 'Etching', 'An etching'), null);
});

test('contain box is centred, inset, and capped at 1.5×', () => {
  assert.equal(CARD_BACK_MEDIA_CONTAIN_INSET, 16);
  assert.equal(CARD_BACK_MEDIA_MAX_UPSCALE, 1.5);

  const tiny = resolveContainMediaBox({
    sourceWidth: 40,
    sourceHeight: 30,
    slotWidth: 320,
    slotHeight: 200,
  });
  // Would fit larger, but cap at 1.5× → 60×45, centred.
  assert.equal(tiny.width, 60);
  assert.equal(tiny.height, 45);
  assert.equal(tiny.left, (320 - 60) / 2);
  assert.equal(tiny.top, (200 - 45) / 2);

  const large = resolveContainMediaBox({
    sourceWidth: 800,
    sourceHeight: 600,
    slotWidth: 320,
    slotHeight: 200,
  });
  // Fit inside 288×168 → scale 168/600 = 0.28 → 224×168, centred horizontally.
  assert.ok(large.width <= 320 - 32);
  assert.ok(large.height <= 200 - 32);
  assert.equal(large.height, 168);
  assert.equal(large.width, 224);
  assert.equal(large.left, (320 - 224) / 2);
  assert.equal(large.top, (200 - 168) / 2);
});
