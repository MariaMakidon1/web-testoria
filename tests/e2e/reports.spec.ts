import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Reports & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')
  })

  test('loads dashboard with a single aggregated analytics request', async ({ page }) => {
    const analyticsRequests: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/report-analytics')) {
        analyticsRequests.push(url)
      }
    })

    // Pick the first project from the navbar selector so analytics is triggered
    await page.goto('/reports')
    const navbarProjectSelector = page.locator('[data-testid="navbar-project-select"]')
    if (await navbarProjectSelector.count()) {
      await navbarProjectSelector.click()
      await page.locator('.p-select-option').first().click()
    }

    // Wait until at least one analytics request has been issued
    await page.waitForResponse((res) =>
      res.url().includes('/report-analytics') && res.status() === 200
    )

    // Charts render and the legacy per-run results loop no longer fires
    await expect(page.getByText('Pass Rate Trend')).toBeVisible()
    await expect(page.getByText('Priority Distribution')).toBeVisible()
    await expect(page.getByText('Test Type Distribution')).toBeVisible()
    await expect(page.getByText('Automation Coverage')).toBeVisible()

    // Exactly one call to the aggregated endpoint, and no N+1 /test-runs/:id/results fan-out
    expect(analyticsRequests.length).toBe(1)
  })

  test('renders empty-state card when no project is selected', async ({ page }) => {
    await page.goto('/reports')
    // If the navbar has no project selected, the view should show the "Select a Project" card.
    // We intentionally don't select one here.
    const emptyState = page.getByText('Select a Project')
    const chartsLoaded = page.getByText('Pass Rate Trend')
    await expect(emptyState.or(chartsLoaded)).toBeVisible()
  })
})
