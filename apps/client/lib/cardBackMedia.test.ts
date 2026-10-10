import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARD_BACK_MEDIA_CONTAIN_INSET,
  CARD_BACK_MEDIA_FADE_RATIO,
  CARD_BACK_MEDIA_MAX_UPSCALE,
  CARD_BACK_MEDIA_MIN_BAND_RATIO,
  CARD_BACK_MEDIA_MIN_READING_STRIP,
  CARD_BACK_MEDIA_SEAM_OVERLAP,
  coverUpscaleFactor,
  mediaUrlPathname,
  mediaUrlPrefersContain,
  resolveCardBackMediaBand,
  resolveCardBackMediaFade,
  resolveCardBackMediaFit,
  resolveContainMediaBox,
} from './cardBackMedia';

test('mediaUrlPathname strips query/hash and lowercases', () => {
  assert.equal(
    mediaUrlPathname('https://cdn.example/a/Photo.PNG?x=1#frag'),
    '/a/photo.png',
  );
  assert.equal(mediaUrlPathname('/local/Diagram.SVG'), '/local/diagram.svg');
  assert.equal(mediaUrlPathname(''), '');
});

test('png and svg URLs prefer contain; jpeg/webp stay cover-eligible', () => {
  assert.equal(mediaUrlPrefersContain('https://x.test/a.png'), true);
  assert.equal(mediaUrlPrefersContain('https://x.test/a.PNG?w=1'), true);
  assert.equal(mediaUrlPrefersContain('https://x.test/a.svg'), true);
  assert.equal(mediaUrlPrefersContain('https://x.test/a.jpg'), false);
  assert.equal(mediaUrlPrefersContain('https://x.test/a.jpeg'), false);
  assert.equal(mediaUrlPrefersContain('https://x.test/a.webp'), false);
});

test('coverUpscaleFactor is the max axis scale', () => {
  assert.equal(coverUpscaleFactor(100, 100, 200, 150), 2);
  assert.equal(coverUpscaleFactor(200, 100, 100, 100), 1);
  assert.equal(coverUpscaleFactor(0, 100, 200, 150), 1);
});

test('fit: extension forces contain before upscale is known', () => {
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/fixture-transparent.png',
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'extension' },
  );
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/icon.svg',
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'contain', reason: 'extension' },
  );
});

test('fit: jpeg covers when upscale ≤ 1.5×; contain when above', () => {
  assert.deepEqual(
    resolveCardBackMediaFit({
      mediaUrl: 'https://x.test/photo.jpg',
      sourceWidth: 800,
      sourceHeight: 600,
      slotWidth: 320,
      slotHeight: 200,
    }),
    { contentFit: 'cover', reason: null },
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

test('fade starts above the reading edge with no dark/busy offset', () => {
  const band = 200;
  const fade = resolveCardBackMediaFade(band);
  assert.equal(fade.startY, band - band * CARD_BACK_MEDIA_FADE_RATIO);
  assert.equal(fade.height, band - fade.startY);
  assert.deepEqual(resolveCardBackMediaFade(0), { startY: 0, height: 0 });
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
