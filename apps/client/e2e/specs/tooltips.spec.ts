import { test } from '@playwright/test';

test.describe('tooltip sequence', () => {
  test('each coaching step', async () => {
    test.skip(
      true,
      'Dedicated tooltip-step captures not wired yet — enable once Critiquito wants each coach step frozen.',
    );
  });
});
