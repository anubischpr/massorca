import { expect } from '@stablyai/playwright-test'
import type { Locator, Page } from '@stablyai/playwright-test'
import { getActiveTabId } from './store'

export const SORTABLE_TAB = '[data-testid="side-panel-tab"]'

// Why: hidden worktrees keep their own side panels mounted, so the "+" has to come from the
// visible one; a closed panel is opened first through the session bar's Side panel button.
async function sidePanelRoot(page: Page): Promise<Locator> {
  const panel = page.locator('[data-side-panel="true"][data-open="true"]')
  if ((await panel.count()) === 0) {
    await page.getByRole('button', { name: 'Side panel' }).click({ force: true })
    await expect(panel).toHaveCount(1, { timeout: 5_000 })
  }
  return panel
}

export async function createTerminalTabFromMenu(page: Page): Promise<string> {
  const tabBar = await sidePanelRoot(page)
  const tabsBefore = await tabBar.locator(SORTABLE_TAB).count()
  const activeBefore = await getActiveTabId(page)

  await tabBar.getByRole('button', { name: 'New tab' }).click()
  await page
    .getByRole('menuitem', { name: /New Terminal/i })
    .first()
    .click()

  await expect
    .poll(() => tabBar.locator(SORTABLE_TAB).count(), {
      timeout: 10_000,
      message: 'New Terminal did not render a new tab in the tab bar'
    })
    .toBe(tabsBefore + 1)

  await expect
    .poll(
      async () => {
        const current = await getActiveTabId(page)
        return Boolean(current && current !== activeBefore)
      },
      { timeout: 10_000, message: 'New Terminal did not become the active tab' }
    )
    .toBe(true)

  const tabId = await getActiveTabId(page)
  if (!tabId) {
    throw new Error('New Terminal tab id was unavailable after creation')
  }
  return tabId
}
