// ARCHITECTURE.md Section D: generic reusable component base, for repeated UI fragments (nav
// bars, modals, tables) composed into page objects rather than duplicated across them. No
// business-specific logic belongs here -- a real component (e.g. a real app's nav bar) extends
// this once that application exists.
class BaseComponent {
  /**
   * @param {import('@playwright/test').Locator} root Root locator scoping this component.
   */
  constructor(root) {
    this.root = root;
  }

  async isVisible() {
    return this.root.isVisible();
  }
}

module.exports = { BaseComponent };
