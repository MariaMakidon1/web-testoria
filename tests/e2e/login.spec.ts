import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Login', () => {
  test('redirects to dashboard after successful login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.login('admin', 'Test123')

    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="dashboard-view"]')).toBeVisible()
  })

  test('shows error toast on invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.login('admin', 'wrongpassword')

    await expect(loginPage.toastError).toBeVisible()
  })

  test('shows validation warning when fields are empty', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.submitButton.click()

    await expect(page.locator('.p-toast-message-warn')).toBeVisible()
  })

  test('redirects authenticated users away from /login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')

    // Navigate back to login while authenticated
    await page.goto('/login')
    await expect(page).toHaveURL('/')
  })

  test('redirects unauthenticated users from protected routes to /login', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
  })

  test('preserves the redirect param after login', async ({ page }) => {
    await page.goto('/reports')
    await expect(page).toHaveURL(/redirect=.*reports/)

    const loginPage = new LoginPage(page)
    await loginPage.login('admin', 'Test123')

    await expect(page).toHaveURL('/reports')
  })

  test('logout clears session and redirects to /login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')

    // Open user menu via Avatar, then click Logout
    await page.locator('.p-avatar').click()
    await page.locator('[role="menuitem"]:has-text("Logout")').click()

    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('404 Not Found', () => {
  test('shows 404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page.locator('text=404')).toBeVisible()
    await expect(page.locator('text=Page not found')).toBeVisible()
  })

  test('404 page has a working "Go to Dashboard" button', async ({ page }) => {
    // Login first so we can navigate to dashboard
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')

    await page.goto('/nonexistent-path')
    await page.locator('button:has-text("Go to Dashboard")').click()
    await expect(page).toHaveURL('/')
  })
})
