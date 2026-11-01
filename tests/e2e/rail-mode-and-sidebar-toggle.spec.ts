import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

/**
 * Electron resolves -webkit-app-region in DOM order (later elements win), and a drag region
 * swallows the click. This reads the same rule at a button's centre.
 */
async function isDraggableAtCentre(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((target) => {
    const button = document.querySelector(target)
    if (!button) {
      throw new Error(`Missing ${target}`)
    }
    const rect = button.getBoundingClientRect()
    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height / 2
    let draggable = false
    for (const element of document.querySelectorAll('*')) {
      const region = getComputedStyle(element).webkitAppRegion
      if (region !== 'drag' && region !== 'no-drag') {
        continue
      }
      const box = element.getBoundingClientRect()
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        draggable = region === 'drag'
      }
    }
    return draggable
  }, selector)
}

test.beforeEach(async ({ orcaPage }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
})

test('the sidebar toggle stays clickable after hiding the sidebar from Tasks and coming back', async ({
  orcaPage
}) => {
  const rail = orcaPage.locator('nav[data-app-rail="true"]')
  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await orcaPage.getByRole('button', { name: 'Toggle sidebar' }).first().click()
  await expect
    .poll(() => orcaPage.evaluate(() => window.__store?.getState().sidebarOpen))
    .toBe(false)

  await rail.getByRole('button', { name: 'Workspaces', exact: true }).click()
  await expect(orcaPage.locator('header[data-session-bar="true"]')).toBeVisible()
  // Why: the session bar sits later in the DOM than the floating sidebar header, so it must leave that spot undraggable.
  expect(await isDraggableAtCentre(orcaPage, 'button[aria-label="Toggle sidebar"]')).toBe(false)

  await orcaPage.getByRole('button', { name: 'Toggle sidebar' }).first().click()
  await expect
    .poll(() => orcaPage.evaluate(() => window.__store?.getState().sidebarOpen))
    .toBe(true)
})

test('the rail button morphs Workspaces into Bot teams, keeps the mode across pages, and the sidebar has no switch', async ({
  orcaPage
}) => {
  const rail = orcaPage.locator('nav[data-app-rail="true"]')
  const modeButton = rail.locator('button').first()
  await expect(modeButton).toHaveAttribute('aria-label', 'Workspaces')
  // Why: the old Workspaces / Bot teams ToggleGroup lived in the left sidebar and is gone.
  await expect(orcaPage.getByRole('radio', { name: 'Bot teams' })).toHaveCount(0)
  await expect(orcaPage.getByRole('radio', { name: 'Workspaces' })).toHaveCount(0)

  await modeButton.click()
  await expect(modeButton).toHaveAttribute('aria-label', 'Bot teams')
  await expect
    .poll(() => orcaPage.evaluate(() => window.__store?.getState().activeView))
    .toBe('bot-teams')
  await expect(modeButton.locator('[data-mode]')).toHaveAttribute('data-mode', 'bot-teams')

  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(modeButton).toHaveAttribute('aria-label', 'Bot teams')
  await modeButton.click()
  await expect
    .poll(() => orcaPage.evaluate(() => window.__store?.getState().activeView))
    .toBe('bot-teams')
  await rail.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(modeButton).toHaveAttribute('aria-label', 'Bot teams')

  await modeButton.click()
  await modeButton.click()
  await expect(modeButton).toHaveAttribute('aria-label', 'Workspaces')
})

test('the Workspaces hint shows once, when the button brings the user back from another page', async ({
  orcaPage
}) => {
  const rail = orcaPage.locator('nav[data-app-rail="true"]')
  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await rail.getByRole('button', { name: 'Workspaces', exact: true }).click()
  await expect(orcaPage.getByText('Click Workspaces again to switch to Bot teams.')).toBeVisible()

  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await orcaPage.getByText('Click Workspaces again to switch to Bot teams.').waitFor({
    state: 'hidden',
    timeout: 15_000
  })
  await rail.getByRole('button', { name: 'Workspaces', exact: true }).click()
  await expect(orcaPage.getByText('Click Workspaces again to switch to Bot teams.')).toHaveCount(0)
})
