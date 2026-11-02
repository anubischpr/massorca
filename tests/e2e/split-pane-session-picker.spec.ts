import type { Page } from '@stablyai/playwright-test'
import { isDraggableAtCentre } from './helpers/electron-drag-region'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

type MainLayout = {
  worktreeId: string
  groups: { id: string; tabOrder: string[]; activeTabId: string | null }[]
  split: boolean
}

async function readMain(page: Page): Promise<MainLayout> {
  return page.evaluate(() => {
    const state = window.__store?.getState()
    const worktreeId = state?.activeWorktreeId ?? ''
    const groups = (state?.groupsByWorktree[worktreeId] ?? [])
      .filter((group) => !group.id.startsWith('side-panel:'))
      .map((group) => ({
        id: group.id,
        tabOrder: group.tabOrder,
        activeTabId: group.activeTabId
      }))
    return { worktreeId, groups, split: state?.layoutByWorktree[worktreeId]?.type === 'split' }
  })
}

/** Starts a Terminal-mode stub session in the active worktree, so both sessions share one main group. */
async function launchSessionInCurrentCheckout(page: Page, message: string): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await page
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: 'Terminal', exact: true })
    .click()
  await page.getByRole('button', { name: 'Workspace mode' }).click()
  await page.getByRole('menuitemradio', { name: /Current checkout/i }).click()
  const composer = page.getByRole('textbox').last()
  await composer.fill(message)
  await composer.press('Enter')
}

async function twoSessionsInOneGroup(page: Page): Promise<MainLayout> {
  await launchSessionInCurrentCheckout(page, 'first session')
  await expect.poll(async () => (await readMain(page)).groups[0]?.tabOrder.length).toBe(1)
  await launchSessionInCurrentCheckout(page, 'second session')
  await expect.poll(async () => (await readMain(page)).groups[0]?.tabOrder.length).toBe(2)
  return readMain(page)
}

/** What a header Split does for a chat session: it adds an empty pane for the person to fill. */
async function openEmptyPane(page: Page, groupId: string): Promise<void> {
  await page.evaluate(
    ({ id }) => {
      const state = window.__store?.getState()
      if (state?.activeWorktreeId) {
        state.createEmptySplitGroup(state.activeWorktreeId, id, 'right')
      }
    },
    { id: groupId }
  )
}

test.beforeEach(async ({ orcaPage }) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage)
})

test('a new pane starts empty, offers the other session, and never repeats the one on screen', async ({
  orcaPage
}) => {
  test.setTimeout(240_000)
  const before = await twoSessionsInOneGroup(orcaPage)
  const group = before.groups[0]
  const shown = group.activeTabId
  await openEmptyPane(orcaPage, group.id)

  const picker = orcaPage.locator('[data-session-pane-picker="true"]')
  await expect(picker).toBeVisible()
  // Why: only the session that is not on screen is offered, plus Create and the way out.
  await expect(picker.locator('button')).toHaveCount(3)
  const choices = picker.locator('button:not([aria-label="Close split pane"])')
  await expect(choices.last()).toHaveText('Create')
  await choices.first().click()

  await expect(picker).toHaveCount(0)
  const after = await readMain(orcaPage)
  expect(after.split).toBe(true)
  const owners = after.groups.filter((candidate) => candidate.tabOrder.length > 0)
  expect(owners).toHaveLength(2)
  const everyTab = owners.flatMap((candidate) => candidate.tabOrder)
  expect(new Set(everyTab).size).toBe(everyTab.length)
  expect(owners.find((candidate) => candidate.id === group.id)?.activeTabId).toBe(shown)
  // Why: each session's terminal must sit inside its own pane, not stay anchored where it was.
  await expect
    .poll(
      () =>
        orcaPage.evaluate(() => {
          const state = window.__store?.getState()
          const worktreeId = state?.activeWorktreeId ?? ''
          const tabs = state?.unifiedTabsByWorktree[worktreeId] ?? []
          return (state?.groupsByWorktree[worktreeId] ?? [])
            .filter((group) => !group.id.startsWith('side-panel:') && group.activeTabId)
            .map((group) => {
              const tab = tabs.find((candidate) => candidate.id === group.activeTabId)
              const body = document.querySelector(`[data-tab-group-body-id="${group.id}"]`)
              const overlay = document.querySelector(
                `[data-terminal-overlay-tab-id="${tab?.entityId}"]`
              )
              if (!body || !overlay) {
                return false
              }
              const b = body.getBoundingClientRect()
              const o = overlay.getBoundingClientRect()
              return (
                o.width > 0 &&
                o.left >= b.left - 2 &&
                o.right <= b.right + 2 &&
                o.top >= b.top - 2 &&
                o.bottom <= b.bottom + 2
              )
            })
        }),
      { timeout: 20_000 }
    )
    .toEqual([true, true])
  await orcaPage.waitForTimeout(2000)
  await orcaPage.screenshot({ path: test.info().outputPath('split-two-sessions.png') })
})

test('the split can be closed with the mouse, from the empty pane and from the session bar', async ({
  orcaPage
}) => {
  test.setTimeout(240_000)
  const before = await twoSessionsInOneGroup(orcaPage)
  const group = before.groups[0]

  await openEmptyPane(orcaPage, group.id)
  const closeInPane = orcaPage.locator(
    '[data-session-pane-picker="true"] button[aria-label="Close split pane"]'
  )
  await expect(closeInPane).toBeVisible()
  for (const focused of [true, false]) {
    await orcaPage.evaluate((on) => {
      const root = document.documentElement
      if (on) {
        root.setAttribute('data-regular-terminal-input-focused', '')
      } else {
        root.removeAttribute('data-regular-terminal-input-focused')
      }
    }, focused)
    expect(
      await isDraggableAtCentre(
        orcaPage,
        '[data-session-pane-picker="true"] button[aria-label="Close split pane"]'
      ),
      `empty pane Close split pane focused=${focused}`
    ).toBe(false)
  }
  await closeInPane.click()
  await expect.poll(async () => (await readMain(orcaPage)).split).toBe(false)
  expect((await readMain(orcaPage)).groups[0].tabOrder).toEqual(before.groups[0].tabOrder)

  // A split holding a session in each pane: Close split pane in the session bar merges them back.
  await openEmptyPane(orcaPage, group.id)
  await orcaPage.locator('[data-session-pane-picker="true"] button').first().click()
  await expect.poll(async () => (await readMain(orcaPage)).split).toBe(true)
  const bar = 'header[data-session-bar="true"] button[aria-label="Close split pane"]'
  expect(await isDraggableAtCentre(orcaPage, bar)).toBe(false)
  await orcaPage.locator(bar).click()
  await expect.poll(async () => (await readMain(orcaPage)).split).toBe(false)
  const merged = await readMain(orcaPage)
  expect(merged.groups).toHaveLength(1)
  expect([...merged.groups[0].tabOrder].sort()).toEqual([...before.groups[0].tabOrder].sort())
})

test('Mod+W closes neither a session nor the split', async ({ orcaPage }) => {
  test.setTimeout(240_000)
  const before = await twoSessionsInOneGroup(orcaPage)
  await openEmptyPane(orcaPage, before.groups[0].id)
  await expect(orcaPage.locator('[data-session-pane-picker="true"]')).toBeVisible()
  const snapshot = await readMain(orcaPage)
  await orcaPage.keyboard.press('Control+W')
  await orcaPage.waitForTimeout(1500)
  expect(await readMain(orcaPage)).toEqual(snapshot)
})

test('a split saved by an older version, with a pane holding a session that is gone, still opens and can be left', async ({
  orcaPage
}) => {
  test.setTimeout(240_000)
  const before = await twoSessionsInOneGroup(orcaPage)
  const group = before.groups[0]
  await orcaPage.evaluate(
    ({ worktreeId, mainId }) => {
      const store = window.__store
      const state = store?.getState()
      if (!store || !state) {
        throw new Error('store missing')
      }
      store.setState({
        groupsByWorktree: {
          ...state.groupsByWorktree,
          [worktreeId]: [
            ...(state.groupsByWorktree[worktreeId] ?? []),
            {
              id: 'old-pane',
              worktreeId,
              activeTabId: 'ghost-session',
              tabOrder: ['ghost-session']
            }
          ]
        },
        layoutByWorktree: {
          ...state.layoutByWorktree,
          [worktreeId]: {
            type: 'split',
            direction: 'horizontal',
            first: { type: 'leaf', groupId: mainId },
            second: { type: 'leaf', groupId: 'old-pane' }
          }
        }
      })
    },
    { worktreeId: before.worktreeId, mainId: group.id }
  )
  const picker = orcaPage.locator('[data-session-pane-picker="true"]')
  await expect(picker).toBeVisible()
  await expect(orcaPage.locator('header[data-session-bar="true"]')).toBeVisible()
  await picker.locator('button[aria-label="Close split pane"]').click()
  await expect.poll(async () => (await readMain(orcaPage)).split).toBe(false)
  expect((await readMain(orcaPage)).groups[0].tabOrder).toEqual(group.tabOrder)
})
