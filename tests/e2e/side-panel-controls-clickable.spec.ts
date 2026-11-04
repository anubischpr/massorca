import type { Page } from '@stablyai/playwright-test'
import { isDraggableAtCentre } from './helpers/electron-drag-region'
import { expect, test } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

const PANEL = '[data-side-panel="true"]'
const panelTabs = (page: Page) => page.locator(`${PANEL} [data-testid="side-panel-tab"]`)

// Why: a hidden test window holds animation frames back, so a pane's focus-on-reveal can land
// late and close a menu opened in between; let pending frames run first.
async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
}

test.beforeEach(async ({ orcaPage }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  const toggle = orcaPage.getByRole('button', { name: 'Side panel', exact: true })
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await toggle.click()
  }
  await expect(orcaPage.locator(`${PANEL}[data-open="true"]`)).toBeVisible()
  await expect(panelTabs(orcaPage).first()).toBeVisible({ timeout: 30_000 })
})

test('no side panel control is a window drag region, with the terminal focused or not', async ({
  orcaPage
}) => {
  const controls = [
    `${PANEL} button[aria-label="New tab"]`,
    `${PANEL} [role="tab"]`,
    `${PANEL} button[aria-label="Close tab"]`
  ]
  for (const terminalFocused of [true, false]) {
    // Why: main.css turns focus-release surfaces into drag regions unless xterm owns focus, so a
    // click on a surface that carried the attribute only worked while the terminal had focus.
    await orcaPage.evaluate((focused) => {
      const root = document.documentElement
      if (focused) {
        root.setAttribute('data-regular-terminal-input-focused', '')
      } else {
        root.removeAttribute('data-regular-terminal-input-focused')
      }
    }, terminalFocused)
    for (const selector of controls) {
      expect(
        await isDraggableAtCentre(orcaPage, selector),
        `${selector} focused=${terminalFocused}`
      ).toBe(false)
    }
  }
})

test('the + menu creates a terminal, a browser tab, a markdown file and a mobile emulator', async ({
  orcaPage
}) => {
  for (const item of [
    /New Terminal/i,
    /New Browser Tab/i,
    /New Markdown/i,
    /New Mobile Emulator/i
  ]) {
    const before = await panelTabs(orcaPage).count()
    await settleFrames(orcaPage)
    await orcaPage.locator(PANEL).getByRole('button', { name: 'New tab' }).click()
    await orcaPage.getByRole('menuitem', { name: item }).click()
    await expect.poll(() => panelTabs(orcaPage).count(), { message: String(item) }).toBe(before + 1)
  }
})
