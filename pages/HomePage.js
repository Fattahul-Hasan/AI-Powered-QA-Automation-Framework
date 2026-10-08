const { BasePage } = require('./BasePage');

class HomePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.getStartedLink = page.getByRole('link', { name: 'Get started' });
  }

  async open() {
    await this.goto('/');
  }

  async clickGetStarted() {
    await this.getStartedLink.click();
  }
}

module.exports = { HomePage };
