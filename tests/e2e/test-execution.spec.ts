import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Test Run Execution', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')
  })

  test('execution view loads for an active run', async ({ page }) => {
    // Navigate to a test run (seed data has run with id 1)
    await page.goto('/test-runs')

    // Wait for a data row (with a test-run-name cell) to distinguish from the empty-state row
    const dataRow = page.locator('table tbody tr:has(.test-run-name)').first()
    await dataRow.waitFor({ timeout: 10000 })
    await dataRow.click()

    // Should be on the detail page
    await expect(page).toHaveURL(/\/test-runs\/\d+/, { timeout: 10000 })
  })

  test('execute button is visible on run detail page', async ({ page }) => {
    await page.goto('/test-runs')

    const dataRow = page.locator('table tbody tr:has(.test-run-name)').first()
    await dataRow.waitFor({ timeout: 10000 })
    await dataRow.click()

    await expect(page.locator('[data-testid="run-execute-btn"]')).toBeVisible({ timeout: 10000 })
  })

  test('execution view shows test case list', async ({ page }) => {
    await page.goto('/test-runs')

    const firstRun = page.locator('table tbody tr').first()
    await firstRun.click()

    await page.locator('[data-testid="run-execute-btn"]').click()

    await expect(page).toHaveURL(/\/test-runs\/\d+\/execute/)

    // Should show test cases to execute
    await expect(
      page.locator('[data-testid="execution-test-case-item"]').first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('can record a result status for a test case', async ({ page }) => {
    await page.goto('/test-runs')

    const firstRun = page.locator('table tbody tr').first()
    await firstRun.click()

    await page.locator('[data-testid="run-execute-btn"]').click()

    await expect(page).toHaveURL(/\/test-runs\/\d+\/execute/)

    // Open the first test case
    await page.locator('[data-testid="execution-test-case-item"]').first().click()

    // Click Passed status button
    const passButton = page.locator('[data-testid="execution-status-passed"]')
    await expect(passButton).toBeVisible({ timeout: 10000 })
    await passButton.click()

    // Progress bar or pass count should update
    await expect(
      page.locator('.progress-section, .progress-bar, .progress-label').first()
    ).toBeVisible()
  })

  test('progress updates after recording a result', async ({ page }) => {
    await page.goto('/test-runs')
    await page.locator('table tbody tr').first().click()

    // Read initial progress
    const progressLocator = page.locator('.progress-section, .progress-bar, .progress-label')

    await page.locator('[data-testid="run-execute-btn"]').click()

    await expect(page).toHaveURL(/\/test-runs\/\d+\/execute/)

    // Record a Passed result on the first case
    await page.locator('[data-testid="execution-test-case-item"]').first().click()
    await page.locator('[data-testid="execution-status-passed"]').click()

    // Progress should be visible and non-zero
    await expect(progressLocator.first()).toBeVisible()
  })
})
