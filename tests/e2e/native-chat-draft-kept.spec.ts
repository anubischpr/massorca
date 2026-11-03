import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

// An unsent message in a session's composer is still there after the user opens other sessions,
// Tasks and + Create, and after a reload.

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

const DRAFT = 'half-written thought, not sent'

async function startChatSession(page: Page, workspace: string | null, text: string): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await page
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: 'Chat', exact: true })
    .click()
  await page.getByRole('button', { name: 'Workspace mode' }).click()
  await page
    .getByRole('menuitemradio', { name: workspace ? new RegExp(workspace, 'i') : /Current checkout/i })
    .click()
  const composer = page.getByRole('textbox').last()
  await composer.fill(text)
  await composer.press('Enter')
}

async function sessionWorktrees(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const state = window.__store?.getState()
    return Object.keys(state?.unifiedTabsByWorktree ?? {}).filter((id) =>
      (state?.unifiedTabsByWorktree[id] ?? []).some((tab) => tab.contentType === 'agent-session')
    )
  })
}

async function openWorktree(page: Page, id: string): Promise<void> {
  await page.evaluate((worktreeId) => {
    const state = window.__store?.getState()
    state?.setActiveView('terminal')
    state?.setActiveWorktree(worktreeId)
  }, id)
  await expect
    .poll(() => page.evaluate(() => window.__store?.getState().activeWorktreeId))
    .toBe(id)
}

/** The composer of the chat on screen: the one visible native-chat root's editor. */
function visibleComposer(page: Page) {
  return page.locator('[data-native-chat-root]:visible [role="textbox"]').last()
}

test('unsent chat text survives opening other sessions, Tasks and + Create, and a reload', async ({
  orcaPage
}) => {
  test.setTimeout(300_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage)

  await startChatSession(orcaPage, null, 'session A')
  await expect.poll(async () => (await sessionWorktrees(orcaPage)).length).toBe(1)
  const [a] = await sessionWorktrees(orcaPage)
  await startChatSession(orcaPage, 'e2e-secondary', 'session B')
  await expect.poll(async () => (await sessionWorktrees(orcaPage)).length).toBe(2)
  const b = (await sessionWorktrees(orcaPage)).find((id) => id !== a)!

  await openWorktree(orcaPage, a)
  const composer = visibleComposer(orcaPage)
  await expect(composer).toBeVisible({ timeout: 30_000 })
  await composer.click()
  await orcaPage.keyboard.type(DRAFT)
  await expect(composer).toContainText(DRAFT)

  await openWorktree(orcaPage, b)
  await orcaPage.evaluate(() => window.__store?.getState().openTasksHome())
  await expect
    .poll(() => orcaPage.evaluate(() => window.__store?.getState().activeView))
    .toBe('tasks')
  await orcaPage.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(orcaPage.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()

  await openWorktree(orcaPage, a)
  await expect(visibleComposer(orcaPage)).toContainText(DRAFT)

  // Let the typing's deferred save land, then reload as the person would.
  await orcaPage.waitForTimeout(1500)
  await orcaPage.reload()
  await waitForSessionReady(orcaPage)
  await openWorktree(orcaPage, a)
  await expect(visibleComposer(orcaPage)).toContainText(DRAFT, { timeout: 30_000 })
})
