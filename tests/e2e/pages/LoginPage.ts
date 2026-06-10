import { type Page, type Locator } from '@playwright/test'

export class LoginPage {
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator

  constructor(private page: Page) {
    this.usernameInput = page.locator('[data-testid="login-username"]')
    this.passwordInput = page.locator('[data-testid="login-password"] input')
    this.submitButton = page.locator('[data-testid="login-submit"]')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  get toastError() {
    return this.page.locator('.p-toast-message-error')
  }
}
