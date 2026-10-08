// ARCHITECTURE.md Section D: Page Object Model Architecture.
// Generic, reusable browser/page functionality only — no business-specific logic belongs here.
class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto(path = '/') {
    await this.page.goto(path);
  }

  async title() {
    return this.page.title();
  }

  async reload() {
    await this.page.reload();
  }

  async waitForLoadState(state = 'load') {
    await this.page.waitForLoadState(state);
  }
}

module.exports = { BasePage };
