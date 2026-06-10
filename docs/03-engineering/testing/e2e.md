# E2E Testing

Playwright setup and patterns for Testoria.

---

## Setup

```bash
npm run test:e2e        # run all e2e tests
npx playwright install  # install browsers (first-time setup)
```

Playwright config: `playwright.config.ts` in project root.

---

## Running against a backend

E2e tests require a running backend. Set `VITE_API_URL` to point at the backend:
```bash
VITE_API_URL=http://localhost:8000/api/v1 npm run test:e2e
```

---

## Test structure

```ts
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Login', () => {
  test('redirects to dashboard after successful login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="username"]', 'admin')
    await page.fill('[data-testid="password"]', 'admin')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="username"]', 'admin')
    await page.fill('[data-testid="password"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('.p-message-error')).toBeVisible()
  })
})
```

---

## `data-testid` attributes

Add `data-testid` to elements that e2e tests need to select. This decouples tests from CSS classes and component structure.

**Naming convention:** `<feature>-<element>` — e.g. `login-username`, `create-next-btn`, `execution-status-passed`.

```vue
<Button data-testid="login-submit" label="Sign In" @click="login" />
<InputText data-testid="login-username" v-model="form.username" />
```

Prefer `data-testid` over CSS selectors or text content for stability. Current `data-testid` values in use:

| Value | Element |
|-------|---------|
| `login-username` | Username input on LoginView |
| `login-password` | Password input on LoginView |
| `login-submit` | Submit button on LoginView |
| `dashboard-view` | Root div on DashboardView |
| `create-project-select` | Project dropdown on TestRunCreateView |
| `create-name-input` | Name input on TestRunCreateView |
| `create-next-btn` | Next step button on TestRunCreateView |
| `create-submit-btn` | Create Test Run button on TestRunCreateView |
| `run-execute-btn` | Execute Tests button on TestRunDetailView |
| `execution-test-case-item` | Test case row in execution list |
| `execution-status-passed` | Passed result button in execution view |

---

## Critical flows to cover

| Flow | Test file |
|------|----------|
| Login / logout | `login.spec.ts` |
| Create a test case | `test-cases.spec.ts` |
| Create a test run | `test-runs.spec.ts` |
| Execute a test run (record results) | `test-run-execution.spec.ts` |
| View reports | `reports.spec.ts` |
| Dark mode toggle | `ui.spec.ts` |

---

## Page Object pattern

For complex flows, use Page Objects to avoid duplication:

```ts
// tests/e2e/pages/LoginPage.ts
import { Page } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async login(username: string, password: string) {
    await this.page.goto('/login')
    await this.page.fill('[data-testid="username"]', username)
    await this.page.fill('[data-testid="password"]', password)
    await this.page.click('[data-testid="login-button"]')
  }

  async expectLoginError() {
    return this.page.locator('.p-message-error')
  }
}
```

---

## CI integration

Add to GitHub Actions:

```yaml
- name: Run E2E tests
  run: |
    npx playwright install --with-deps chromium
    npm run build
    npm run preview &
    sleep 3
    npm run test:e2e
```

Run e2e against the production build (`npm run preview`) for maximum fidelity.
