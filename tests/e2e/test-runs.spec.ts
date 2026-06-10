import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Test Run Creation', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')
  })

  test('navigates to test run creation form', async ({ page }) => {
    await page.goto('/test-runs/create')
    await expect(page.getByRole('heading', { name: 'Create Test Run' })).toBeVisible()
  })

  test('create form has required project and name fields', async ({ page }) => {
    await page.goto('/test-runs/create')
    await expect(page.locator('[data-testid="create-project-select"]')).toBeVisible()
    await expect(page.locator('[data-testid="create-name-input"]')).toBeVisible()
  })

  test('success toast appears in the bottom half of the viewport, not over header buttons (TES-74)', async ({ page }) => {
    // Trigger a toast by completing the create flow
    await page.goto('/test-runs/create')
    await page.locator('[data-testid="create-project-select"]').click()
    await page.locator('.p-select-option').first().click()
    await page.locator('[data-testid="create-name-input"]').fill('Toast-position Run')
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    await page.waitForSelector('table tbody tr')
    await page.locator('table tbody tr').first().locator('[type="checkbox"]').click()
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    await page.locator('[data-testid="create-submit-btn"]').click()

    // Toast should now be visible somewhere — assert it's in the bottom half
    const toast = page.locator('.p-toast').first()
    await expect(toast).toBeVisible({ timeout: 10000 })

    const viewport = page.viewportSize()
    const box = await toast.boundingBox()
    if (viewport && box) {
      expect(box.y).toBeGreaterThan(viewport.height / 2)
    }
  })

  test('Cancel button is present on every wizard step and exits to /test-runs (TES-72)', async ({ page }) => {
    await page.goto('/test-runs/create')

    const cancel = page.locator('[data-testid="create-cancel-btn"]')

    // Step 1: Cancel visible
    await expect(cancel).toBeVisible({ timeout: 10000 })

    // Fill the project + name to advance to Step 2
    await page.locator('[data-testid="create-project-select"]').click()
    await page.locator('.p-select-option').first().click()
    await page.locator('[data-testid="create-name-input"]').fill('Cancel-test Run')
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    // Step 2: Cancel still visible
    await expect(cancel).toBeVisible({ timeout: 10000 })

    // Click Cancel — should land on /test-runs (the runs-list entry path)
    await cancel.click()
    await expect(page).toHaveURL(/\/test-runs$/, { timeout: 10000 })
  })

  test('wizard blocks proceed buttons on step 2 when project has no cases (TES-76)', async ({ page }) => {
    // Force every project's suite list to be empty for this test, so step 2
    // resolves into the projectHasNoCases state regardless of seed data.
    await page.route(/\/api\/v1\/projects\/\d+\/test-suites(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/test-runs/create')

    await page.locator('[data-testid="create-project-select"]').click()
    await page.locator('.p-select-option').first().click()
    await page.locator('[data-testid="create-name-input"]').fill('No-cases Run')
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    // Step 2: empty-state hint and disabled proceed buttons
    await expect(page.locator('[data-testid="create-empty-message"]')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('[data-testid="create-skip-cases-btn"]:visible')).toBeDisabled()
    await expect(page.locator('[data-testid="create-next-btn"]:visible')).toBeDisabled()
  })

  test('wizard step badges are 1-indexed (TES-75)', async ({ page }) => {
    await page.goto('/test-runs/create')

    const stepNumbers = page.locator('.p-stepper .p-step-number')
    await expect(stepNumbers.first()).toBeVisible({ timeout: 10000 })

    // The three step badges should read 1, 2, 3 — not 0, 1, 2
    await expect(stepNumbers.nth(0)).toHaveText('1')
    await expect(stepNumbers.nth(1)).toHaveText('2')
    await expect(stepNumbers.nth(2)).toHaveText('3')
  })

  test('Next button advances to test case selection step', async ({ page }) => {
    await page.goto('/test-runs/create')

    // Select first available project
    await page.locator('[data-testid="create-project-select"]').click()
    await page.locator('.p-select-option').first().click()

    // Fill in run name
    await page.locator('[data-testid="create-name-input"]').fill('E2E Test Run')

    // Advance to next step
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    // Should be on step 2 (test case selection)
    await expect(page.getByText('Select Test Cases')).toBeVisible()
  })

  test('created run appears in test runs list', async ({ page }) => {
    await page.goto('/test-runs/create')

    // Step 1: fill project + name
    await page.locator('[data-testid="create-project-select"]').click()
    await page.locator('.p-select-option').first().click()
    await page.locator('[data-testid="create-name-input"]').fill('Automated E2E Run')
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    // Step 2: select first available test case via its checkbox, then advance
    await page.waitForSelector('table tbody tr')
    await page.locator('table tbody tr').first().locator('[type="checkbox"]').click()
    await page.locator('[data-testid="create-next-btn"]:visible').click()

    // Step 3: confirm + create
    await page.locator('[data-testid="create-submit-btn"]').click()

    // Should navigate to the run list or detail
    await expect(page).toHaveURL(/\/test-runs/)
  })

  test('test runs list page loads and shows runs', async ({ page }) => {
    await page.goto('/test-runs')
    // Either a table of runs or an empty state should be visible
    await expect(
      page.locator('table, .empty-state, [class*="run"], [class*="test-run"]').first()
    ).toBeVisible()
  })

  test('back button reads "Back to Project Overview" when launched from a project (TES-80)', async ({ page }) => {
    await page.goto('/projects')

    const firstProjectRow = page.locator('tbody tr').first()
    await firstProjectRow.waitFor({ timeout: 10000 })
    await firstProjectRow.click()

    await expect(page).toHaveURL(/\/projects\/\d+/, { timeout: 10000 })
    const projectUrl = page.url()

    await page.getByRole('button', { name: 'New Test Run' }).click()

    await expect(page).toHaveURL(/\/test-runs\/create\?projectId=\d+/, { timeout: 10000 })

    const backBtn = page.locator('[data-testid="create-back-btn"]')
    await expect(backBtn).toBeVisible({ timeout: 10000 })
    await expect(backBtn).toHaveText(/Back to Project Overview/)

    await backBtn.click()
    await expect(page).toHaveURL(projectUrl, { timeout: 10000 })
  })

  test('back button reads "Back to Test Runs" when launched from the runs list (TES-80)', async ({ page }) => {
    await page.goto('/test-runs')

    const newRunBtn = page.getByRole('button', { name: /New Test Run|Create Test Run/i }).first()
    await newRunBtn.click()

    await expect(page).toHaveURL(/\/test-runs\/create$/, { timeout: 10000 })

    const backBtn = page.locator('[data-testid="create-back-btn"]')
    await expect(backBtn).toBeVisible({ timeout: 10000 })
    await expect(backBtn).toHaveText(/Back to Test Runs/)

    await backBtn.click()
    await expect(page).toHaveURL(/\/test-runs$/, { timeout: 10000 })
  })

  test('Blocked and Passed result badges have visibly different backgrounds (TES-78)', async ({ page }) => {
    // Walk to a test run, ensure at least one Blocked + one Passed result exists
    // by recording fresh ones, then assert the rendered tags differ visually.
    await page.goto('/test-runs')

    const dataRow = page.locator('table tbody tr:has(.test-run-name)').first()
    await dataRow.waitFor({ timeout: 10000 })
    await dataRow.click()
    await expect(page).toHaveURL(/\/test-runs\/\d+/, { timeout: 10000 })

    // Open execute view to record a Passed and a Blocked result
    await page.locator('[data-testid="run-execute-btn"]').click()
    await expect(page).toHaveURL(/\/test-runs\/\d+\/execute/, { timeout: 10000 })

    const cases = page.locator('[data-testid="execution-test-case-item"]')
    await expect(cases.first()).toBeVisible({ timeout: 10000 })

    // First case → Passed
    await cases.nth(0).click()
    await page.locator('[data-testid="execution-status-passed"]').click()

    // Second case (if present) → Blocked
    if ((await cases.count()) >= 2) {
      await cases.nth(1).click()
      // The Blocked verdict button is labelled "Blocked" in TestRunExecutionView
      await page.getByRole('button', { name: 'Blocked', exact: true }).click()
    }

    // Back to the run detail view to see the rendered result badges side by side
    await page.goBack()
    await expect(page).toHaveURL(/\/test-runs\/\d+/, { timeout: 10000 })

    // The status-badge component is rendered as <Tag class="status-badge ...">
    // with inline style. Find a passed and a blocked badge and compare backgrounds.
    const passedBadge = page.locator('.status-badge', { hasText: /^Passed$/i }).first()
    const blockedBadge = page.locator('.status-badge', { hasText: /^Blocked$/i }).first()

    // If neither blocked nor a second case existed, skip the comparison
    if (await blockedBadge.count() === 0) {
      test.skip(true, 'No blocked result available in seed/run; comparison not applicable')
    }

    await expect(passedBadge).toBeVisible({ timeout: 10000 })
    await expect(blockedBadge).toBeVisible({ timeout: 10000 })

    const passedBg = await passedBadge.evaluate((el) => getComputedStyle(el).backgroundColor)
    const blockedBg = await blockedBadge.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(passedBg).not.toEqual(blockedBg)
    // Sanity: blocked is the slate-600 we picked
    expect(blockedBg).toBe('rgb(75, 85, 99)')
  })

  test('Edit button in the result detail pane opens the test case editor (TES-79)', async ({ page }) => {
    await page.goto('/test-runs')

    const dataRow = page.locator('table tbody tr:has(.test-run-name)').first()
    await dataRow.waitFor({ timeout: 10000 })
    await dataRow.click()

    await expect(page).toHaveURL(/\/test-runs\/\d+/, { timeout: 10000 })

    const resultRow = page.locator('[data-testid="suite-tree-result-row"]').first()
    await resultRow.waitFor({ timeout: 10000 })
    await resultRow.click()

    const editBtn = page.locator('[data-testid="result-detail-edit-test-case"]')
    await expect(editBtn).toBeVisible({ timeout: 10000 })
    await editBtn.click()

    await expect(page).toHaveURL(/\/test-cases\/\d+\/edit/, { timeout: 10000 })
  })
})
