import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import {
  configureGoldenStubAgent,
  getGoldenStubAgentLaunchEnv,
  GOLDEN_STUB_READY_MARKER
} from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { getTerminalContent } from './helpers/terminal'

// Covers launching a session from the + Create composer, the only place agents start now.

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

type SessionPlacement = { groupId: string; tabId: string } | null

async function openCreateComposer(page: Page): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
}

async function pickSessionView(page: Page, view: 'Chat' | 'Terminal'): Promise<void> {
  await page
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: view, exact: true })
    .click()
}

async function pickAgent(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Agent, model and effort' }).click()
  await page.getByRole('menuitemradio', { name }).first().click()
  await page.keyboard.press('Escape')
}

async function submitFirstMessage(page: Page, message: string): Promise<void> {
  const composer = page.getByRole('textbox').last()
  await composer.fill(message)
  await composer.press('Enter')
}

/** The session the active workspace's main area shows, read from the store. */
async function activeSessionPlacement(page: Page): Promise<SessionPlacement> {
  return page.evaluate(() => {
    const state = window.__store?.getState()
    const worktreeId = state?.activeWorktreeId
    if (!state || !worktreeId) {
      return null
    }
    const tab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
      (candidate) => candidate.contentType === 'agent-session' || candidate.viewMode !== undefined
    )
    return tab ? { groupId: tab.groupId, tabId: tab.id } : null
  })
}

/** Plain shell terminals of the new session's workspace: tabs the person never opened. */
async function plainTerminalsInActiveWorkspace(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = window.__store?.getState()
    const worktreeId = state?.activeWorktreeId
    if (!state || !worktreeId) {
      return -1
    }
    return (state.unifiedTabsByWorktree[worktreeId] ?? []).filter(
      (tab) => tab.contentType === 'terminal' && tab.viewMode === undefined
    ).length
  })
}

/** A new session starts with no terminal of its own and its side panel hidden. */
async function expectNoInitialTerminalAndHiddenPanel(page: Page): Promise<void> {
  // Why: a seeded terminal arrives after the session; give it the time it would take.
  await page.waitForTimeout(3000)
  expect(await plainTerminalsInActiveWorkspace(page)).toBe(0)
  await expect(
    page.locator('[data-side-panel="true"][data-open="true"]').filter({ visible: true })
  ).toHaveCount(0)
}

test.beforeEach(async ({ orcaPage }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage)
})

test('a Terminal-mode session fills the main area with a live TUI @create-chat-launch-golden', async ({
  orcaPage
}) => {
  await openCreateComposer(orcaPage)
  await pickSessionView(orcaPage, 'Terminal')
  await pickAgent(orcaPage, /^Codex/i)
  await submitFirstMessage(orcaPage, 'hello from create')

  await expect.poll(() => activeSessionPlacement(orcaPage), { timeout: 30_000 }).not.toBeNull()
  const placement = (await activeSessionPlacement(orcaPage))!
  // Why: a session lives in the main area; only non-session tabs belong to the side panel.
  expect(placement.groupId.startsWith('side-panel:')).toBe(false)

  const terminal = orcaPage.locator(`[data-terminal-overlay-tab-id="${placement.tabId}"]`)
  await expect(terminal).toBeVisible({ timeout: 30_000 })
  const box = (await terminal.boundingBox())!
  expect(box.width).toBeGreaterThan(300)
  const panel = orcaPage.locator('[data-side-panel="true"][data-open="true"]').filter({
    visible: true
  })
  if ((await panel.count()) > 0) {
    const panelBox = (await panel.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + 2)
  }
  await expect(orcaPage.locator('[data-session-bar] > span').first()).not.toHaveText('')
  await expect
    .poll(() => getTerminalContent(orcaPage), { timeout: 30_000 })
    .toContain(GOLDEN_STUB_READY_MARKER)
  await expectNoInitialTerminalAndHiddenPanel(orcaPage)
})

test('a Chat-mode session shows in the main area under the session bar @create-chat-launch-golden', async ({
  orcaPage
}) => {
  await openCreateComposer(orcaPage)
  await pickSessionView(orcaPage, 'Chat')
  await pickAgent(orcaPage, /^Claude/i)
  await submitFirstMessage(orcaPage, 'hello from create')

  await expect.poll(() => activeSessionPlacement(orcaPage), { timeout: 30_000 }).not.toBeNull()
  const placement = (await activeSessionPlacement(orcaPage))!
  expect(placement.groupId.startsWith('side-panel:')).toBe(false)
  await expect(orcaPage.locator('[data-native-chat-root]').first()).toBeVisible({
    timeout: 30_000
  })
  await expect(orcaPage.getByRole('button', { name: /Chat summary/ })).toBeVisible()
  await expectNoInitialTerminalAndHiddenPanel(orcaPage)
})

test('picking an existing worktree in the workspace chip only sets the target @create-chat-launch-golden', async ({
  orcaPage
}) => {
  await openCreateComposer(orcaPage)
  const worktreeBefore = await orcaPage.evaluate(() => window.__store?.getState().activeWorktreeId)
  await orcaPage.getByRole('button', { name: 'Workspace mode' }).click()
  await orcaPage
    .getByRole('menuitemradio', { name: /e2e-secondary/ })
    .first()
    .click()

  await expect(orcaPage.getByRole('button', { name: 'Workspace mode' })).toContainText(
    'e2e-secondary'
  )
  // Why: choosing a target must not open that worktree; the composer stays up for the first message.
  await expect(orcaPage.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  expect(await orcaPage.evaluate(() => window.__store?.getState().activeView)).toBe('create-chat')
  expect(await orcaPage.evaluate(() => window.__store?.getState().activeWorktreeId)).toBe(
    worktreeBefore
  )
})
