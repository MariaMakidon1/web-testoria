import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Projects: Show archived toggle (TES-82)', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('admin', 'Test123')
    await expect(page).toHaveURL('/')
  })

  test('project detail page exposes Edit and Delete; Delete-then-confirm returns to /projects (TES-71)', async ({ page }) => {
    const projectName = `E2E Delete-from-detail ${Date.now()}`

    // Create a fresh project to own
    await page.goto('/projects')
    await page.getByRole('button', { name: 'Create Project' }).click()
    await page.locator('#create-name').fill(projectName)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Open the detail page by clicking the row
    const row = page.locator('tbody tr', { hasText: projectName })
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.click()
    await expect(page).toHaveURL(/\/projects\/\d+/, { timeout: 10000 })

    // Edit + Delete buttons visible for admin
    const editBtn = page.locator('[data-testid="project-detail-edit-btn"]')
    const deleteBtn = page.locator('[data-testid="project-detail-delete-btn"]')
    await expect(editBtn).toBeVisible({ timeout: 10000 })
    await expect(deleteBtn).toBeVisible()

    // Open Edit, confirm pre-fill, cancel
    await editBtn.click()
    const nameInput = page.locator('[data-testid="edit-project-name"]')
    await expect(nameInput).toHaveValue(projectName)
    await page.locator('[data-testid="edit-project-cancel"]').click()

    // Click Delete, confirm via PrimeVue ConfirmDialog, expect navigation to /projects
    await deleteBtn.click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect(page).toHaveURL(/\/projects$/, { timeout: 10000 })

    // The deleted project is no longer in the list
    await expect(page.locator('tbody tr', { hasText: projectName })).toHaveCount(0)
  })

  test('archived project is hidden by default and revealed when Show archived is checked', async ({ page }) => {
    const projectName = `E2E Archive Toggle ${Date.now()}`

    await page.goto('/projects')

    // Create a fresh project so the test owns its data
    await page.getByRole('button', { name: 'Create Project' }).click()
    await page.locator('#create-name').fill(projectName)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Row should be visible (project starts unarchived)
    const newRow = page.locator('tbody tr', { hasText: projectName })
    await expect(newRow).toBeVisible({ timeout: 10000 })

    // Open edit dialog for our project, archive it, save (shared EditProjectDialog — plan-091)
    await newRow.locator('button[aria-label], button').filter({ has: page.locator('.pi-pencil') }).first().click()
    await page.locator('[data-testid="edit-project-archived"]').check()
    await page.locator('[data-testid="edit-project-save"]').click()

    // With Show archived OFF (default), the project should disappear from the list
    await expect(page.locator('tbody tr', { hasText: projectName })).toHaveCount(0, { timeout: 10000 })

    // Toggle Show archived ON; archived project should appear with the Archived tag
    await page.locator('[data-testid="show-archived-checkbox"]').click()
    const archivedRow = page.locator('tbody tr', { hasText: projectName })
    await expect(archivedRow).toBeVisible({ timeout: 10000 })
    await expect(archivedRow.locator('text=Archived')).toBeVisible()

    // Toggle off again; row should hide
    await page.locator('[data-testid="show-archived-checkbox"]').click()
    await expect(page.locator('tbody tr', { hasText: projectName })).toHaveCount(0, { timeout: 10000 })
  })
})
