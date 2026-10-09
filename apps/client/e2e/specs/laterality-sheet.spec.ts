import { test } from '@playwright/test';

test.describe('laterality sheet', () => {
  test('sheet open', async () => {
    test.skip(
      true,
      'Laterality sheet UI not on main yet — enable when the epic ships the sheet (remove skip + capture).',
    );
  });
});
