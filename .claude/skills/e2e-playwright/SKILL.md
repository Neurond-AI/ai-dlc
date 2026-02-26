---
name: e2e-playwright
description: AI-powered end-to-end testing with Playwright. Generate and run browser tests from natural language or specs. Use when writing E2E tests, browser automation, visual validation, cross-browser testing, or converting user flows from specs into executable test suites.
license: MIT
---

# E2E Playwright Testing Skill

AI-powered end-to-end testing that bridges AI agents to live browser sessions through Playwright.

## When to Use

- Writing end-to-end browser tests
- Converting spec-defined user flows into executable tests
- Cross-browser testing (Chromium, Firefox, WebKit)
- Visual validation and screenshot comparison
- Form submission and user interaction testing
- API endpoint testing through browser context
- Accessibility testing in real browsers

## Core Principle

AI generates and runs browser tests from natural language or SDD specs. Tests are generated WITHOUT requiring access to source code - AI sees the running app.

## Workflow Integration

### From SDD Specs
1. Specs define user flows (from `/neurond:spec-tasks`)
2. This skill converts flows into executable E2E tests
3. AI runs tests in real browser
4. Self-healing: AI adapts tests when UI changes

### From Natural Language
1. Describe the user flow in plain language
2. AI generates Playwright test code
3. Execute and validate

## Test Generation Patterns

### Page Object Model
```typescript
// pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId('login-email-input');
    this.passwordInput = page.getByTestId('login-password-input');
    this.submitButton = page.getByTestId('login-submit-button');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

### Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature: User Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill('user@example.com');
    await page.getByTestId('login-password-input').fill('password123');
    await page.getByTestId('login-submit-button').click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByTestId('welcome-message')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email-input').fill('invalid@example.com');
    await page.getByTestId('login-password-input').fill('wrong');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('error-message')).toContainText('Invalid');
  });
});
```

## Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Best Practices

### Locator Strategy (Priority Order)
1. `data-testid` attributes (most stable)
2. ARIA roles: `getByRole('button', { name: 'Submit' })`
3. Label text: `getByLabel('Email')`
4. Placeholder: `getByPlaceholder('Enter email')`
5. Text content: `getByText('Welcome')`
6. CSS selectors (last resort)

### Test Organization
- Group by feature/user flow
- Use `test.describe` for logical grouping
- Implement Page Object Model for reusable components
- Keep tests independent (no shared state)
- Use fixtures for common setup

### AI Self-Healing
- When UI changes, AI detects broken selectors
- Suggests updated selectors based on current DOM
- Validates visual regression with screenshot comparison
- Adapts to layout changes automatically

## Commands

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Generate test from recording
npx playwright codegen http://localhost:3000

# Show HTML report
npx playwright show-report
```

## Related Skills (Use Together for Full Coverage)

| Skill | Purpose | Best For |
|-------|---------|----------|
| `e2e-playwright` (this) | Structured test suites | Spec-to-test conversion, CI/CD integration |
| `playwright-skill` | Custom browser automation | Dev server detection, custom scripts, responsive testing |
| `playwright-cli` | Interactive CLI sessions | Quick visual checks, snapshots, live debugging, tracing |
| `chrome-devtools` | DevTools integration | Performance profiling, network analysis, console debugging |

## Screenshot & Artifact Storage

All E2E test artifacts are saved to `plans/e2e/` for review, audit, and comparison:

```
plans/e2e/
└── [YYYY-MM-DD-HHmmss]-[test-topic]/
    ├── report.md                    # Test summary with pass/fail
    ├── screenshots/
    │   ├── desktop-*.png            # Full page desktop captures
    │   ├── tablet-*.png             # Tablet responsive captures
    │   ├── mobile-*.png             # Mobile responsive captures
    │   └── *-error.png              # Error state captures
    ├── snapshots/
    │   └── page-*.yaml              # DOM state snapshots (playwright-cli)
    ├── traces/
    │   └── trace.zip                # Playwright trace files
    └── videos/
        └── test-run.webm            # Video recordings
```

### How to Save Artifacts

```typescript
// In Playwright test files - save to plans/e2e/
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const artifactDir = `plans/e2e/${timestamp}-auth-flow`;

// Ensure directory exists
import { mkdirSync } from 'fs';
mkdirSync(`${artifactDir}/screenshots`, { recursive: true });

// Save screenshots during tests
await page.screenshot({
  path: `${artifactDir}/screenshots/desktop-login.png`,
  fullPage: true
});
```

```bash
# Using playwright-cli - save snapshots to plans/e2e/
mkdir -p plans/e2e/$(date +%Y-%m-%d-%H%M%S)-quick-check/snapshots
playwright-cli snapshot --filename=plans/e2e/$(date +%Y-%m-%d-%H%M%S)-quick-check/snapshots/page.yaml
playwright-cli screenshot --filename=plans/e2e/$(date +%Y-%m-%d-%H%M%S)-quick-check/screenshots/page.png
```

## Integration with TDD

### Red-Green-Refactor for E2E
1. **Red**: Write failing E2E test from spec
2. **Green**: Implement feature until test passes
3. **Refactor**: Clean up test and implementation
4. **Screenshot**: Capture final state to `plans/e2e/` for the audit trail

### Vertical Slicing
- Each E2E test drives a complete user flow
- Test covers frontend -> API -> database -> response
- No mocking in E2E (test real integrations)
- All artifacts saved for review and comparison
