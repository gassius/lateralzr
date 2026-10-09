import { test } from '@playwright/test';

test.describe('status screens', () => {
  test('loading card', async () => {
    test.skip(
      true,
      'End-of-deck loading card needs a delayed hasMore fixture path — enable with a deterministic load-more mock.',
    );
  });

  test('offline line', async () => {
    test.skip(true, 'Offline line UI not on main yet (context.setOffline when it ships).');
  });

  test('no next idea', async () => {
    test.skip(true, '"No next idea" empty-state UI not on main yet — empty-batch.json fixture is ready.');
  });

  test('end of deck', async () => {
    test.skip(true, 'End-of-deck dedicated capture not wired yet.');
  });
});
