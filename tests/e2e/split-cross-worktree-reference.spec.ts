import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

async function launchInWorktree(
  page: Page,
  existing: string | null,
  message: string
): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await page
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: 'Terminal', exact: true })
    .click()
  await page.getByRole('button', { name: 'Workspace mode' }).click()
  await page
    .getByRole('menuitemradio', {
      name: existing ? new RegExp(existing, 'i') : /Current checkout/i
    })
    .click()
  const composer = page.getByRole('textbox').last()
  await composer.fill(message)
  await composer.press('Enter')
}

type Snapshot = {
  activeWorktreeId: string | null
  paneFocus: unknown
  worktrees: { id: string; branch: string; sessions: { id: string; groupId: string }[] }[]
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const state = window.__store?.getState()
    const worktrees = Object.keys(state?.unifiedTabsByWorktree ?? {}).map((id) => ({
      id,
      branch: state?.allWorktrees().find((w) => w.id === id)?.branch ?? '',
      sessions: (state?.unifiedTabsByWorktree[id] ?? [])
        .filter((tab) => tab.viewMode !== undefined || tab.contentType === 'agent-session')
        .map((tab) => ({ id: tab.id, groupId: tab.groupId }))
    }))
    return {
      activeWorktreeId: state?.activeWorktreeId ?? null,
      paneFocus: state?.paneFocus,
      worktrees
    }
  })
}

test('a pane shows another workspace’s live session by reference, and the focus follows it', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(300_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage)

  await launchInWorktree(orcaPage, null, 'session in the first workspace')
  await expect
    .poll(async () => (await snapshot(orcaPage)).worktrees.filter((w) => w.sessions.length).length)
    .toBe(1)
  const first = (await snapshot(orcaPage)).worktrees.find((w) => w.sessions.length)!
  await launchInWorktree(orcaPage, 'e2e-secondary', 'session in the second workspace')
  await expect
    .poll(async () => (await snapshot(orcaPage)).worktrees.filter((w) => w.sessions.length).length)
    .toBe(2)
  const second = (await snapshot(orcaPage)).worktrees.find(
    (w) => w.sessions.length && w.id !== first.id
  )!

  // Back on the first workspace, add an empty pane and show the second workspace's session in it.
  await orcaPage.evaluate((id) => window.__store?.getState().setActiveWorktree(id), first.id)
  await expect.poll(async () => (await snapshot(orcaPage)).activeWorktreeId).toBe(first.id)
  const referenced = await orcaPage.evaluate(
    ({ firstId, groupId, ownerId, tabId }) => {
      const state = window.__store?.getState()
      const paneId = state?.createEmptySplitGroup(firstId, groupId, 'right')
      if (!state || !paneId) {
        return null
      }
      const shown = state.showSessionInPane(firstId, paneId, { worktreeId: ownerId, tabId })
      return shown ? paneId : null
    },
    {
      firstId: first.id,
      groupId: first.sessions[0].groupId,
      ownerId: second.id,
      tabId: second.sessions[0].id
    }
  )
  expect(referenced).not.toBeNull()

  // One live copy, anchored inside the pane that shows it.
  const secondTabEntity = await orcaPage.evaluate(
    ({ ownerId, tabId }) =>
      window.__store?.getState().unifiedTabsByWorktree[ownerId].find((tab) => tab.id === tabId)
        ?.entityId,
    { ownerId: second.id, tabId: second.sessions[0].id }
  )
  const overlay = orcaPage.locator(`[data-terminal-overlay-tab-id="${secondTabEntity}"]`)
  await expect(overlay).toHaveCount(1)
  await expect
    .poll(() =>
      orcaPage.evaluate(
        ({ paneId, entity }) => {
          const body = document.querySelector(`[data-tab-group-body-id="${paneId}"]`)
          const host = document.querySelector(`[data-terminal-overlay-tab-id="${entity}"]`)
          if (!body || !host) {
            return false
          }
          const b = body.getBoundingClientRect()
          const o = host.getBoundingClientRect()
          return o.width > 0 && o.left >= b.left - 2 && o.right <= b.right + 2 && o.top >= b.top - 2
        },
        { paneId: referenced, entity: secondTabEntity }
      )
    )
    .toBe(true)
  await orcaPage.waitForTimeout(2500)
  await orcaPage.screenshot({ path: testInfo.outputPath('reference-side-by-side.png') })

  // Focusing the pane: commands, right sidebar and side panel follow the session's workspace.
  await overlay.click({ position: { x: 40, y: 40 } })
  await expect.poll(async () => (await snapshot(orcaPage)).activeWorktreeId).toBe(second.id)
  await expect(orcaPage.locator('[data-side-panel="true"]').first()).toBeVisible()
  const owners = await orcaPage.evaluate(() =>
    [...document.querySelectorAll('[data-side-panel="true"] [data-worktree-id]')]
      .filter((el) => el instanceof HTMLElement && el.offsetParent !== null)
      .map((el) => el.getAttribute('data-worktree-id'))
  )
  expect(new Set(owners).size).toBeLessThanOrEqual(1)
  if (owners.length) {
    expect(owners[0]).toBe(second.id)
  }
  await orcaPage.screenshot({ path: testInfo.outputPath('reference-focused.png') })

  // Opening the second workspace from the sidebar shows its own layout, not a second live copy.
  await orcaPage.evaluate((id) => window.__store?.getState().setActiveWorktree(id), second.id)
  await expect(orcaPage.locator('[data-session-pane-picker="true"]').first()).toBeVisible()
  await expect(orcaPage.locator(`[data-terminal-overlay-tab-id="${secondTabEntity}"]`)).toHaveCount(
    1
  )
  await orcaPage.screenshot({ path: testInfo.outputPath('reference-owner-layout.png') })
})
