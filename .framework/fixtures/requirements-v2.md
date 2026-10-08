# Synthetic Requirement Document — Version 2 (Dry-Run Fixture)

**This is not a real customer requirement document.** It is a deliberately-modified second
version of `.framework/fixtures/requirements.md`, used only to exercise the Requirement Change
Detection capability (PHASE 4, A1) against real, structured diffs — added / removed / modified /
unchanged — without inventing a new business domain. Same public Playwright documentation site
as the original fixture.

## REQ-DEMO-1: Homepage "Get Started" Navigation

As a visitor to the Playwright documentation homepage, I want a clearly labeled "Get started"
link, so that I can begin using Playwright's documentation.

**Acceptance Criteria:**
- The homepage exposes a link with the accessible name "Get started".
- Activating the link navigates the visitor away from the homepage toward the documentation.

**Actors:** Visitor
**Module:** Documentation Site
**Feature:** Homepage Navigation

*(Unchanged from v1 — deliberately identical content, to exercise the "unchanged" classification.)*

## REQ-DEMO-2: Documentation Search

As a visitor to the Playwright documentation site, I want a search entry point that also
supports keyboard-only navigation, so that I can find topics without a mouse.

**Acceptance Criteria:**
- The site exposes a search control reachable from the homepage.
- The search control is reachable and operable using only the keyboard.

**Actors:** Visitor
**Module:** Documentation Site
**Feature:** Search

*(Modified from v1 — the keyboard-accessibility acceptance criterion was added, to exercise the
"modified" classification.)*

## REQ-DEMO-4: Homepage Dark Mode Toggle

As a visitor to the Playwright documentation homepage, I want a dark-mode toggle, so that I can
read the documentation comfortably in low light.

**Acceptance Criteria:**
- The homepage exposes a control that switches between light and dark color themes.

**Actors:** Visitor
**Module:** Documentation Site
**Feature:** Appearance

*(New in v2 — did not exist in v1, to exercise the "added" classification. REQ-DEMO-3 from v1 is
intentionally dropped here, to exercise the "removed" classification.)*
