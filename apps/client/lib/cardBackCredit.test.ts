import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cardBackCreditHasRow,
  cardBackLicenceHitSlop,
  resolveCardBackCredit,
} from './cardBackCredit.ts';

describe('resolveCardBackCredit', () => {
  it('uses creator, licence name/url, and known change notices', () => {
    const credit = resolveCardBackCredit({
      url: 'https://upload.wikimedia.org/wikipedia/commons/e2e/photo.jpg',
      kind: 'image',
      creator: 'Jane Doe',
      licenceName: 'CC0',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      changeNotice: 'cropped',
    });
    assert.equal(credit.creator, 'Jane Doe');
    assert.equal(credit.licenceName, 'CC0');
    assert.equal(credit.licenceUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
    assert.equal(credit.changeNoticeKey, 'cropped');
    assert.equal(credit.changeNoticeRaw, null);
    assert.equal(cardBackCreditHasRow(credit), true);
  });

  it('falls back to license when licenceName is absent and skips a bad URL', () => {
    const credit = resolveCardBackCredit({
      url: 'https://upload.wikimedia.org/wikipedia/commons/e2e/photo.jpg',
      kind: 'image',
      license: 'Public domain',
      licenceUrl: 'not-a-url',
    });
    assert.equal(credit.licenceName, 'Public domain');
    assert.equal(credit.licenceUrl, null);
    assert.equal(credit.creator, 'Wikimedia Commons');
  });

  it('gives the 13 px meta licence a >=48 px target', () => {
    const fontSize = 13;
    const slop = cardBackLicenceHitSlop(fontSize);
    assert.ok(fontSize + slop * 2 >= 48);
    assert.ok(13 * 2 + cardBackLicenceHitSlop(13 * 2) * 2 >= 48);
  });

  it('tolerates a row with no provenance', () => {
    const credit = resolveCardBackCredit({
      url: 'https://example.test/x.jpg',
      kind: 'image',
    });
    assert.equal(cardBackCreditHasRow(credit), false);
    assert.equal(credit.creator, null);
    assert.equal(credit.licenceName, null);
  });
});
