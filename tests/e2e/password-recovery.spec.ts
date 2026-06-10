import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

// These cover the frontend-only behaviour of the recovery flow — link
// navigation, the no-enumeration confirmation, and the invalid-link recovery
// state — none of which depend on a live reset endpoint. The full happy paths
// (forgot → reset → login, and set-password from a real invite token) need the
// backend from api-testoria plan 048 and are marked `fixme` below until it ships.

test.describe('Password recovery', () => {
  test('the login page links to forgot-password', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await page.locator('[data-testid="login-forgot-link"]').click()

    await expect(page).toHaveURL(/\/forgot-password/)
    await expect(page.locator('[data-testid="forgot-email"]')).toBeVisible()
  })

  test('forgot-password shows the same confirmation regardless of the email', async ({
    page,
  }) => {
    await page.goto('/forgot-password')

    await page.locator('[data-testid="forgot-email"]').fill('nobody@example.com')
    await page.locator('[data-testid="forgot-submit"]').click()

    // No-enumeration: the confirmation appears whether or not the address exists.
    await expect(
      page.locator('[data-testid="forgot-confirmation"]'),
    ).toBeVisible()
  })

  test('reset-password with no token shows the invalid-link state', async ({
    page,
  }) => {
    await page.goto('/reset-password')

    await expect(page.locator('[data-testid="reset-invalid"]')).toBeVisible()
    await expect(page.locator('[data-testid="reset-form"]')).toHaveCount(0)
  })

  test('reset-password with a bogus token shows the invalid-link state', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=definitely-not-a-real-token')

    await expect(page.locator('[data-testid="reset-invalid"]')).toBeVisible()
  })

  test('set-password renders the welcome heading', async ({ page }) => {
    await page.goto('/set-password?token=definitely-not-a-real-token')

    await expect(page.getByText('Set your password')).toBeVisible()
  })

  // --- Backend-dependent happy paths (require api-testoria plan 048) ----------

  test.fixme(
    'forgot → reset → login (needs real reset token from api 048)',
    async ({ page }) => {
      // 1. Request a reset for a seeded user.
      // 2. Read the token from the outbox / test mailbox.
      // 3. Visit /reset-password?token=..., set a new password, expect redirect to /login.
      // 4. Log in with the new password.
      void page
    },
  )

  test.fixme(
    'set-password from a welcome invite link (needs real invite token from api 048)',
    async ({ page }) => {
      // 1. Create a user without a password (invite flow).
      // 2. Read the invite token from the outbox / test mailbox.
      // 3. Visit /set-password?token=..., set a password, expect redirect to /login.
      void page
    },
  )
})
