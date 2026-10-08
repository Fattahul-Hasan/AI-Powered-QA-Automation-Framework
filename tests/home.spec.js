const { test, expect } = require('../fixtures/pages.fixture');

test('home page has expected title', async ({ homePage, page }) => {
  await homePage.open();
  await expect(page).toHaveTitle(/Playwright/);
});
