import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Test Cases page empty state (TES-73)', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')
  })

  test('empty state surfaces Add Section as the primary CTA when project has no suites', async ({
    page,
  }) => {
    // Mock the suite list to return empty for every project so the empty state is
    // forced regardless of seed data.
    await page.route(/\/api\/v1\/projects\/\d+\/test-suites(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Navigate to the project's test cases page — pick the first project from the picker.
    await page.goto('/test-cases')

    // The empty-state Add Section CTA must be visible without scrolling and before any cases exist.
    const addSection = page.locator('[data-testid="empty-add-section-btn"]')
    await expect(addSection).toBeVisible({ timeout: 10000 })

    // Clicking it opens the create-section dialog.
    await addSection.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  })
})
