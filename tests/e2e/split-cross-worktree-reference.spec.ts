import { existsSync, readFileSync } from 'node:fs'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { attachRepoAndOpenTerminal, createRestartSession } from './helpers/orca-restart'
import { TEST_REPO_PATH_FILE } from './global-setup'
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

type Pair = {
  first: Snapshot['worktrees'][number]
  second: Snapshot['worktrees'][number]
}

/** One stub session in the current checkout and one in the second worktree. */
async function startTwoSessions(page: Page, secondWorkspace = 'e2e-secondary'): Promise<Pair> {
  await launchInWorktree(page, null, 'session in the first workspace')
  await expect
    .poll(async () => (await snapshot(page)).worktrees.filter((w) => w.sessions.length).length)
    .toBe(1)
  const first = (await snapshot(page)).worktrees.find((w) => w.sessions.length)!
  await launchInWorktree(page, secondWorkspace, 'session in the second workspace')
  await expect
    .poll(async () => (await snapshot(page)).worktrees.filter((w) => w.sessions.length).length)
    .toBe(2)
  const second = (await snapshot(page)).worktrees.find(
    (w) => w.sessions.length && w.id !== first.id
  )!
  return { first, second }
}

test('a pane shows another workspace’s live session by reference, and the focus follows it', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(300_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage)

  const { first, second } = await startTwoSessions(orcaPage)
  // A session starts with its side panel hidden, though its workspace has a terminal for it.
  await expect(
    orcaPage.locator('[data-side-panel="true"][data-open="true"]').filter({ visible: true })
  ).toHaveCount(0)

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
  // The divider reaches up to the top bar, and no pane header crosses it.
  const topBarBottom = await orcaPage
    .locator('[data-pane-top-bar="true"]')
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom)
  const divider = await orcaPage
    .locator('.tab-group-split-resize-handle')
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, right: r.right }
    })
  expect(divider.top).toBeLessThanOrEqual(topBarBottom + 1)
  const headers = await orcaPage.locator('.pane-title-bar').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right }
    })
  )
  const crossingHeaders = headers.filter(
    (header) => !(header.right <= divider.left + 0.5 || header.left >= divider.right - 0.5)
  )
  expect(crossingHeaders).toEqual([])
  // Two panes, one focused: the unfocused one carries the veil that dims its session text.
  await expect(orcaPage.locator('[data-tab-group-unfocused-veil]')).toHaveCount(1)

  // Focusing the pane: commands, right sidebar and side panel follow the session's workspace.
  await overlay.click({ position: { x: 40, y: 40 } })
  await expect
    .poll(async () => (await snapshot(orcaPage)).paneFocus)
    .toEqual({
      layoutWorktreeId: first.id,
      ownerWorktreeId: second.id,
      groupId: referenced
    })
  // Focus moved to the reference pane, so the first workspace's own pane is now the veiled one.
  await expect(
    orcaPage.locator(
      `[data-tab-group-body-id="${first.sessions[0].groupId}"] > [data-tab-group-unfocused-veil]`
    )
  ).toHaveCount(1)
  // The side panel starts hidden; whichever is on screen must be the session's own workspace's.
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

async function refPaneOf(page: Page, worktreeId: string) {
  return page.evaluate(
    (id) =>
      window.__store
        ?.getState()
        .groupsByWorktree[id]?.filter((group) => group.sessionRef)
        .map((group) => ({ id: group.id, sessionRef: group.sessionRef })) ?? [],
    worktreeId
  )
}

test('the new pane’s picker lists the other workspace’s session under its names, and choosing it puts both side by side', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(300_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage)
  const { first, second } = await startTwoSessions(orcaPage)

  await orcaPage.evaluate((id) => window.__store?.getState().setActiveWorktree(id), first.id)
  await expect.poll(async () => (await snapshot(orcaPage)).activeWorktreeId).toBe(first.id)
  // The split a chat's button, shortcut and Cmd-J run: an empty pane that offers the sessions.
  await orcaPage.evaluate(
    ({ id, groupId }) => window.__store?.getState().createEmptySplitGroup(id, groupId, 'right'),
    { id: first.id, groupId: first.sessions[0].groupId }
  )
  const picker = orcaPage.locator('[data-session-pane-picker="true"]')
  await expect(picker).toBeVisible()
  // This workspace's only session is on screen, so the only row is the other workspace's, headed by its names.
  await expect(picker.locator('p')).toHaveCount(1)
  await expect(picker.locator('p')).toContainText(second.branch.replace('refs/heads/', ''))
  await expect(picker.locator('button')).toHaveCount(3)
  await picker.locator('button').first().click()

  await expect.poll(async () => (await refPaneOf(orcaPage, first.id)).length).toBe(1)
  const [pane] = await refPaneOf(orcaPage, first.id)
  expect(pane.sessionRef).toEqual({ worktreeId: second.id, tabId: second.sessions[0].id })
  // Why: the owner's own layout, hidden, keeps its picker; none is on screen.
  await expect(picker.filter({ visible: true })).toHaveCount(0)
  // One live copy of each session on screen.
  const entities = await orcaPage.evaluate(
    (ids) =>
      ids.map(
        ({ worktreeId, tabId }) =>
          window.__store?.getState().unifiedTabsByWorktree[worktreeId].find((t) => t.id === tabId)
            ?.entityId
      ),
    [
      { worktreeId: first.id, tabId: first.sessions[0].id },
      { worktreeId: second.id, tabId: second.sessions[0].id }
    ]
  )
  for (const entity of entities) {
    await expect(orcaPage.locator(`[data-terminal-overlay-tab-id="${entity}"]`)).toHaveCount(1)
  }
  await orcaPage.waitForTimeout(2500)
  await orcaPage.screenshot({ path: testInfo.outputPath('picker-two-workspaces.png') })
  // The session is still where it was, and the other pane's session did not move.
  const state = await snapshot(orcaPage)
  expect(state.worktrees.find((w) => w.id === second.id)?.sessions).toHaveLength(1)
  expect(state.worktrees.find((w) => w.id === first.id)?.sessions).toHaveLength(1)
})

test('the pane that shows another workspace’s session is saved, and is back after quit and relaunch', async (// oxlint-disable-next-line no-empty-pattern -- this test owns both Electron launches.
{}, testInfo) => {
  test.setTimeout(420_000)
  const repoPath = existsSync(TEST_REPO_PATH_FILE)
    ? readFileSync(TEST_REPO_PATH_FILE, 'utf8').trim()
    : ''
  if (!repoPath || !existsSync(repoPath)) {
    throw new Error('This test needs the seeded test repo from global setup')
  }
  const launchEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(getGoldenStubAgentLaunchEnv())) {
    if (value !== undefined) {
      launchEnv[key] = value
    }
  }
  const session = createRestartSession(testInfo, launchEnv)
  let app: ElectronApplication | null = null
  try {
    const firstLaunch = await session.launch()
    app = firstLaunch.app
    const page = firstLaunch.page
    await waitForSessionReady(page)
    await attachRepoAndOpenTerminal(page, repoPath)
    await ensureTerminalVisible(page)
    await configureGoldenStubAgent(page)
    // Why: the restart fixture's repo lists only its main checkout, so the second workspace is a new worktree.
    const { first, second } = await startTwoSessions(page, 'New worktree')
    await page.evaluate((id) => window.__store?.getState().setActiveWorktree(id), first.id)
    await expect.poll(async () => (await snapshot(page)).activeWorktreeId).toBe(first.id)
    await page.evaluate(
      ({ id, groupId }) => window.__store?.getState().createEmptySplitGroup(id, groupId, 'right'),
      { id: first.id, groupId: first.sessions[0].groupId }
    )
    await page.locator('[data-session-pane-picker="true"] button').first().click()
    await expect.poll(async () => (await refPaneOf(page, first.id)).length).toBe(1)

    // Closing a terminal of the showing workspace, from its own tab strip, must leave the pane in place.
    const panelTerminal = await page.evaluate((id) => {
      const state = window.__store?.getState()
      const tab = (state?.unifiedTabsByWorktree[id] ?? []).find(
        (candidate) => candidate.contentType === 'terminal' && candidate.viewMode === undefined
      )
      return tab ? { id: tab.id, label: tab.label } : null
    }, first.id)
    expect(panelTerminal, 'the showing workspace has a plain terminal to close').not.toBeNull()
    // The pane holding the focus decides whose side panel is on screen, so focus this workspace's own pane first.
    // Why: a hidden test window holds animation frames back, so the picked pane's mount-time focus can land late.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    await page.evaluate(({ id, groupId }) => window.__store?.getState().focusGroup(id, groupId), {
      id: first.id,
      groupId: first.sessions[0].groupId
    })
    // The panel starts hidden, so open it as the person would.
    await page.getByRole('button', { name: 'Side panel', exact: true }).click()
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    const strip = page
      .locator('[data-side-panel="true"][data-open="true"]')
      .filter({ visible: true })
      .first()
    await strip
      .getByText(panelTerminal?.label ?? '', { exact: true })
      .first()
      .hover()
    await strip
      .getByRole('button', { name: /^Close/ })
      .first()
      .click()
    await expect
      .poll(async () =>
        page.evaluate(
          ([id, tabId]) =>
            (window.__store?.getState().unifiedTabsByWorktree[id] ?? []).some(
              (tab) => tab.id === tabId
            ),
          [first.id, panelTerminal?.id ?? '']
        )
      )
      .toBe(false)
    expect((await refPaneOf(page, first.id)).length).toBe(1)
    // And the saved profile keeps it too, once the close has been written.
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.api.session.flush())
          return page.evaluate(async (id) => {
            const saved = await window.api.session.get()
            return (saved.tabGroups?.[id] ?? []).some((group) => group.sessionRef !== undefined)
          }, first.id)
        },
        { timeout: 20_000 }
      )
      .toBe(true)

    // The focus goes back to the reference pane, and must come back to it after a reload and a relaunch.
    const refPaneId = (await refPaneOf(page, first.id))[0].id
    const focusOnRefPane = {
      layoutWorktreeId: first.id,
      ownerWorktreeId: second.id,
      groupId: refPaneId
    }
    // Click it, as a person would; the DOM focus is what the panes follow.
    const refEntity = await page.evaluate(
      ({ ownerId, tabId }) =>
        window.__store?.getState().unifiedTabsByWorktree[ownerId].find((tab) => tab.id === tabId)
          ?.entityId,
      { ownerId: second.id, tabId: second.sessions[0].id }
    )
    await page
      .locator(`[data-terminal-overlay-tab-id="${refEntity}"]`)
      .click({ position: { x: 40, y: 40 } })
    await expect.poll(async () => (await snapshot(page)).paneFocus).toEqual(focusOnRefPane)
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.api.session.flush())
          return page.evaluate(async () => (await window.api.session.get()).paneFocus)
        },
        { timeout: 20_000 }
      )
      .toEqual(focusOnRefPane)

    // A page reload re-reads the saved profile through the same checkpoint a quit uses.
    await page.reload()
    await waitForSessionReady(page)
    await expect
      .poll(async () => (await refPaneOf(page, first.id))[0]?.sessionRef, { timeout: 60_000 })
      .toEqual({ worktreeId: second.id, tabId: second.sessions[0].id })
    await expect.poll(async () => (await snapshot(page)).paneFocus).toEqual(focusOnRefPane)

    await session.close(app)
    app = null

    const secondLaunch = await session.launch()
    app = secondLaunch.app
    await waitForSessionReady(secondLaunch.page)
    await expect
      .poll(async () => (await refPaneOf(secondLaunch.page, first.id))[0]?.sessionRef, {
        timeout: 60_000
      })
      .toEqual({ worktreeId: second.id, tabId: second.sessions[0].id })
    await expect
      .poll(async () => (await snapshot(secondLaunch.page)).paneFocus)
      .toEqual(focusOnRefPane)
    const restored = await snapshot(secondLaunch.page)
    expect(restored.worktrees.find((w) => w.id === second.id)?.sessions).toHaveLength(1)
    await secondLaunch.page.waitForTimeout(2500)
    await secondLaunch.page.screenshot({ path: testInfo.outputPath('relaunch-two-workspaces.png') })
  } finally {
    if (app) {
      await session.close(app)
    }
    await session.dispose()
  }
})
