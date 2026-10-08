const base = require('@playwright/test');
const { HomePage } = require('../pages/HomePage');

exports.test = base.test.extend({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
});

exports.expect = base.expect;
