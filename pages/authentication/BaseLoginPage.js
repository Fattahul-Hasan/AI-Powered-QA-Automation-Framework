const { BasePage } = require('../BasePage');

// ARCHITECTURE.md Section D/B: generic authentication foundation at the POM layer. Every
// selector and the login path are supplied by the caller -- this class has no knowledge of any
// real application's login page. A real login page object extends this once the target
// application and its real selectors are known and approved.
class BaseLoginPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{ loginPath: string, usernameInput: string, passwordInput: string, submitButton: string }} config
   */
  constructor(page, config) {
    super(page);
    const { loginPath, usernameInput, passwordInput, submitButton } = config;
    this.loginPath = loginPath;
    this.usernameInput = page.locator(usernameInput);
    this.passwordInput = page.locator(passwordInput);
    this.submitButton = page.locator(submitButton);
  }

  async open() {
    await this.goto(this.loginPath);
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

module.exports = { BaseLoginPage };
