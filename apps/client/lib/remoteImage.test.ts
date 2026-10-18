import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  displayMediaUrl,
  isProxyableMediaUrl,
  mediaUrlLooksLikeSvg,
  proxiedMediaUrl,
  remoteImageHeadersForPlatform,
  remoteImageSource,
  requestedMediaWidth,
  resolveCardMediaUrl,
  rewriteWikimediaRequestUrl,
  snapWikimediaThumbWidth,
  WIKIMEDIA_THUMB_WIDTHS,
  REMOTE_IMAGE_HEADERS,
} from './remoteImage';

const wiki =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/320px-Example.jpg';

test('isProxyableMediaUrl allows HTTPS Wikimedia upload hosts only', () => {
  assert.equal(isProxyableMediaUrl(wiki), true);
  assert.equal(isProxyableMediaUrl('http://upload.wikimedia.org/foo.jpg'), false);
  assert.equal(isProxyableMediaUrl('https://evil.example/foo.jpg'), false);
  assert.equal(isProxyableMediaUrl('https://user:pass@upload.wikimedia.org/foo.jpg'), false);
  assert.equal(isProxyableMediaUrl('not a url'), false);
});

test('displayMediaUrl proxies Wikimedia on web and leaves native unchanged', () => {
  assert.equal(displayMediaUrl(wiki, 'web', 'http://localhost'), proxiedMediaUrl(wiki, 'http://localhost'));
  assert.equal(displayMediaUrl(wiki, 'ios', 'http://localhost'), wiki);
  assert.equal(displayMediaUrl(wiki, 'android', 'http://localhost'), wiki);
  assert.equal(displayMediaUrl(null, 'web', 'http://localhost'), '');
  assert.equal(displayMediaUrl('  ', 'web', 'http://localhost'), '');
  assert.equal(
    displayMediaUrl('https://cdn.example/pic.jpg', 'web', 'http://localhost'),
    'https://cdn.example/pic.jpg',
  );
});

test('proxiedMediaUrl encodes the original URL and strips a trailing API slash', () => {
  assert.equal(
    proxiedMediaUrl(wiki, 'http://localhost/'),
    `http://localhost/api/media?url=${encodeURIComponent(wiki)}`,
  );
});

test('web does not attach custom User-Agent headers (they fail Wikimedia CORS preflight)', () => {
  assert.equal(remoteImageHeadersForPlatform('web'), undefined);
  assert.deepEqual(remoteImageHeadersForPlatform('ios'), REMOTE_IMAGE_HEADERS);
  assert.equal(remoteImageSource(wiki, 'web', 'http://localhost')?.headers, undefined);
  assert.deepEqual(remoteImageSource(wiki, 'ios', 'http://localhost')?.headers, REMOTE_IMAGE_HEADERS);
  assert.equal(remoteImageSource(null, 'web', 'http://localhost'), null);
});

test('requestedMediaWidth is band × pixel ratio capped at 1600', () => {
  assert.equal(requestedMediaWidth(320, 2, 1600), 640);
  assert.equal(requestedMediaWidth(900, 3, 1600), 1600);
  assert.equal(requestedMediaWidth(0, 2, 1600), 1600);
});

test('snapWikimediaThumbWidth rounds up to a served size and caps at stored/1600', () => {
  assert.deepEqual([...WIKIMEDIA_THUMB_WIDTHS], [330, 500, 960, 1280, 1920]);
  assert.equal(snapWikimediaThumbWidth(1098, 1280), 1280);
  assert.equal(snapWikimediaThumbWidth(640, 1280), 960);
  assert.equal(snapWikimediaThumbWidth(1600, 1280), 1280);
  assert.equal(snapWikimediaThumbWidth(1600, null), 1280);
  assert.equal(snapWikimediaThumbWidth(800, 320), 320);
});

test('rewriteWikimediaRequestUrl uses standard thumb widths and rasterises SVG originals', () => {
  assert.equal(
    rewriteWikimediaRequestUrl(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/1280px-Example.jpg',
      960,
    ),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/960px-Example.jpg',
  );
  assert.equal(
    rewriteWikimediaRequestUrl(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/320px-Example.jpg',
      800,
    ),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/320px-Example.jpg',
  );
  assert.equal(
    rewriteWikimediaRequestUrl(
      'https://upload.wikimedia.org/wikipedia/commons/4/4a/Diagram.svg',
      1200,
    ),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Diagram.svg/1280px-Diagram.svg.png',
  );
  assert.equal(
    rewriteWikimediaRequestUrl('https://cdn.example/pic.jpg', 800),
    'https://cdn.example/pic.jpg',
  );
  assert.equal(mediaUrlLooksLikeSvg('https://upload.wikimedia.org/wikipedia/commons/4/4a/Diagram.svg'), true);
});

test('resolveCardMediaUrl keeps a 1280px thumb at 3× 366 (does not ask 1098)', () => {
  const thumb =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/1280px-Example.jpg';
  assert.equal(requestedMediaWidth(366, 3), 1098);
  assert.equal(
    resolveCardMediaUrl({
      mediaUrl: thumb,
      platform: 'ios',
      apiBaseUrl: 'http://localhost',
      requestWidth: requestedMediaWidth(366, 3),
    }),
    thumb,
  );
});

test('resolveCardMediaUrl rasterises SVG on native and still proxies Wikimedia on web', () => {
  const svg = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Diagram.svg';
  const raster = rewriteWikimediaRequestUrl(svg, 800);
  assert.match(raster, /\/960px-Diagram\.svg\.png$/);
  assert.equal(
    resolveCardMediaUrl({
      mediaUrl: svg,
      platform: 'ios',
      apiBaseUrl: 'http://localhost',
      requestWidth: 800,
    }),
    raster,
  );
  assert.equal(
    resolveCardMediaUrl({
      mediaUrl: svg,
      platform: 'web',
      apiBaseUrl: 'http://localhost',
      requestWidth: 800,
    }),
    proxiedMediaUrl(raster, 'http://localhost'),
  );
});
