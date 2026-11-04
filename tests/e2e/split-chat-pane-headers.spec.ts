import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

// A split: the top row is each top pane's own header on its half, the window session bar is gone,
// the divider runs from the top edge, and the window controls sit on the rightmost header.

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

type Rect = { top: number; left: number; right: number; bottom: number; height: number }

type ChatTab = { id: string; groupId: string }

type TopBar = {
  groupId: string
  rect: Rect
  title: string
  titleRegion: string
  chatHeaders: number
  ownActions: Rect | null
  ownActionsRegion: string | null
  buttonRegions: string[]
  windowActions: Rect | null
  windowActionsRegion: string | null
}

type SplitGeometry = {
  sessionBar: Rect | null
  sessionBarChatHeaders: number
  dividers: Rect[]
  windowControls: Rect | null
  rightSidebarOpen: boolean
  topBars: TopBar[]
  panes: { tabId: string; groupId: string; host: Rect | null; body: Rect | null }[]
  veil: { bodyId: string | null; veilIndex: number; hostIndex: number } | null
  focus: { activeWorktreeId: string | null; paneFocus: unknown; activeGroupIdByWorktree: unknown }
}

type PaneRef = { tabId: string; groupId: string }

async function startChatSession(page: Page, workspace: string | null, text: string): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await page
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: 'Chat', exact: true })
    .click()
  await page.getByRole('button', { name: 'Workspace mode' }).click()
  await page
    .getByRole('menuitemradio', {
      name: workspace ? new RegExp(workspace, 'i') : /Current checkout/i
    })
    .click()
  // Why: + Create may keep another detected agent (Pi has no chat view), so pick the stub's agent.
  const agentChip = page.getByRole('button', { name: 'Agent, model and effort' })
  if (!(await agentChip.textContent())?.includes('Claude')) {
    await agentChip.click()
    await page
      .getByRole('menuitemradio', { name: /^Claude/ })
      .first()
      .click()
    await page.keyboard.press('Escape')
  }
  await expect(agentChip).toContainText('Claude')
  const composer = page.getByRole('textbox').last()
  await composer.fill(text)
  await composer.press('Enter')
}

async function chatWorktrees(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const state = window.__store?.getState()
    return Object.keys(state?.unifiedTabsByWorktree ?? {}).filter((id) =>
      (state?.unifiedTabsByWorktree[id] ?? []).some((tab) => tab.contentType === 'agent-session')
    )
  })
}

async function chatTab(page: Page, worktreeId: string): Promise<ChatTab> {
  const tab = await page.evaluate((id) => {
    const found = (window.__store?.getState().unifiedTabsByWorktree[id] ?? []).find(
      (row) => row.contentType === 'agent-session'
    )
    return found ? { id: found.id, groupId: found.groupId } : null
  }, worktreeId)
  expect(tab).not.toBeNull()
  return tab!
}

async function openWorktree(page: Page, id: string): Promise<void> {
  await page.evaluate((worktreeId) => {
    const state = window.__store?.getState()
    state?.setActiveView('terminal')
    state?.setActiveWorktree(worktreeId)
  }, id)
  await expect.poll(() => page.evaluate(() => window.__store?.getState().activeWorktreeId)).toBe(id)
}

/** The window bar, the top rows, the dividers, the window controls and each pane's host and body. */
async function measureSplit(page: Page, panes: PaneRef[]): Promise<SplitGeometry> {
  return page.evaluate(
    (input) => {
      const rect = (el: Element | null): Rect | null => {
        if (!el) {
          return null
        }
        const r = el.getBoundingClientRect()
        return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, height: r.height }
      }
      // Why: -webkit-app-region is not inherited, so a free child drags through its nearest annotated ancestor.
      const regionOf = (el: Element): string => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const value = getComputedStyle(node).getPropertyValue('-webkit-app-region').trim()
          if (value && value !== 'none') {
            return value
          }
        }
        return 'none'
      }
      const bar = document.querySelector('[data-session-bar="true"]')
      const windowControls = document.querySelector('.window-controls')
      const topBars = [...document.querySelectorAll<HTMLElement>('[data-pane-top-bar="true"]')].map(
        (el) => {
          const title = el.querySelector('[data-pane-top-bar-title]')
          const ownActions = el.querySelector<HTMLElement>('[data-pane-top-bar-actions]')
          const windowActions = el.querySelector<HTMLElement>('[data-session-bar-window-actions]')
          return {
            groupId: el.getAttribute('data-pane-top-bar-group') ?? '',
            rect: rect(el) as Rect,
            title: title?.textContent?.trim() ?? '',
            titleRegion: title ? regionOf(title) : 'none',
            chatHeaders: el.querySelectorAll('[data-native-chat-pane-header]').length,
            ownActions: rect(ownActions),
            ownActionsRegion: ownActions ? regionOf(ownActions) : null,
            buttonRegions: [...(ownActions?.querySelectorAll('button') ?? [])].map((button) =>
              regionOf(button)
            ),
            windowActions: rect(windowActions),
            windowActionsRegion: windowActions ? regionOf(windowActions) : null
          }
        }
      )
      const dividers = [...document.querySelectorAll('.tab-group-split-resize-handle')].flatMap(
        (el) => {
          const box = rect(el)
          return box ? [box] : []
        }
      )
      const paneRects = input.panes.map(({ tabId, groupId }) => ({
        tabId,
        groupId,
        host: rect(
          document.querySelector(`[data-structured-agent-session-overlay-tab-id="${tabId}"]`)
        ),
        body: rect(document.querySelector(`[data-tab-group-body-id="${groupId}"]`))
      }))
      let veil: SplitGeometry['veil'] = null
      const veilEl = document.querySelector<HTMLElement>('[data-tab-group-unfocused-veil]')
      const body = veilEl?.parentElement ?? null
      const bodyRect = body?.getBoundingClientRect()
      if (veilEl && bodyRect) {
        const host =
          [
            ...document.querySelectorAll<HTMLElement>(
              '[data-structured-agent-session-overlay-tab-id]'
            )
          ].find((el) => {
            const r = el.getBoundingClientRect()
            return (
              Math.abs(r.left - bodyRect.left) < 2 &&
              Math.abs(r.top - bodyRect.top) < 2 &&
              Math.abs(r.width - bodyRect.width) < 2
            )
          }) ?? null
        // Why: the veil is pointer-events:none, so elementsFromPoint skips it; force it on for this probe only.
        const previous = veilEl.style.pointerEvents
        veilEl.style.pointerEvents = 'auto'
        const stack = document.elementsFromPoint(
          bodyRect.left + bodyRect.width / 2,
          bodyRect.top + bodyRect.height / 2
        )
        veilEl.style.pointerEvents = previous
        veil = {
          bodyId: body?.getAttribute('data-tab-group-body-id') ?? null,
          veilIndex: stack.indexOf(veilEl),
          hostIndex: host ? stack.findIndex((el) => host.contains(el)) : -1
        }
      }
      const state = window.__store?.getState()
      return {
        sessionBar: rect(bar),
        sessionBarChatHeaders: bar?.querySelectorAll('[data-native-chat-pane-header]').length ?? 0,
        dividers,
        windowControls: rect(windowControls),
        rightSidebarOpen: state?.rightSidebarOpen ?? false,
        topBars,
        panes: paneRects,
        veil,
        focus: {
          activeWorktreeId: state?.activeWorktreeId ?? null,
          paneFocus: state?.paneFocus ?? null,
          activeGroupIdByWorktree: state?.activeGroupIdByWorktree ?? {}
        }
      }
    },
    { panes }
  )
}

test('a split of two chat sessions from two workspaces: each top pane carries the window row on its half', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(300_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })

  await startChatSession(orcaPage, null, 'session in the first workspace')
  await expect.poll(async () => (await chatWorktrees(orcaPage)).length, { timeout: 30_000 }).toBe(1)
  const [firstWorktree] = await chatWorktrees(orcaPage)
  await startChatSession(orcaPage, 'e2e-secondary', 'session in the second workspace')
  await expect.poll(async () => (await chatWorktrees(orcaPage)).length, { timeout: 30_000 }).toBe(2)
  const secondWorktree = (await chatWorktrees(orcaPage)).find((id) => id !== firstWorktree)!
  const first = await chatTab(orcaPage, firstWorktree)
  const second = await chatTab(orcaPage, secondWorktree)

  // Back on the first workspace, show the second workspace's chat in a new pane on the right.
  await openWorktree(orcaPage, firstWorktree)
  const paneId = await orcaPage.evaluate(
    ({ firstId, groupId, ownerId, tabId }) => {
      const state = window.__store?.getState()
      const pane = state?.createEmptySplitGroup(firstId, groupId, 'right')
      if (!state || !pane) {
        return null
      }
      return state.showSessionInPane(firstId, pane, { worktreeId: ownerId, tabId }) ? pane : null
    },
    { firstId: firstWorktree, groupId: first.groupId, ownerId: secondWorktree, tabId: second.id }
  )
  expect(paneId).not.toBeNull()
  await expect
    .poll(() =>
      orcaPage.evaluate(
        ({ paneId: pane, tabId }) => {
          const body = document.querySelector(`[data-tab-group-body-id="${pane}"]`)
          const host = document.querySelector(
            `[data-structured-agent-session-overlay-tab-id="${tabId}"]`
          )
          if (!body || !host) {
            return false
          }
          const b = body.getBoundingClientRect()
          const o = host.getBoundingClientRect()
          return o.width > 0 && o.left >= b.left - 2 && o.right <= b.right + 2 && o.top >= b.top - 2
        },
        { paneId, tabId: second.id }
      )
    )
    .toBe(true)
  await orcaPage.waitForTimeout(2500)

  const panes: PaneRef[] = [
    { tabId: first.id, groupId: first.groupId },
    { tabId: second.id, groupId: paneId! }
  ]
  // Right after the split, the referenced pane holds the focus.
  const referenceFocus = await measureSplit(orcaPage, panes)
  console.log(`SPLIT_GEOMETRY_REFERENCE_FOCUS ${JSON.stringify(referenceFocus)}`)
  await orcaPage.screenshot({
    path: testInfo.outputPath('split-cross-workspace-reference-focus.png')
  })

  // Focusing the first workspace's own chat moves the focus to its pane.
  await orcaPage
    .locator(`[data-structured-agent-session-overlay-tab-id="${first.id}"]`)
    .click({ position: { x: 40, y: 80 } })
  await orcaPage.waitForTimeout(1500)
  const ownFocus = await measureSplit(orcaPage, panes)
  console.log(`SPLIT_GEOMETRY_OWN_FOCUS ${JSON.stringify(ownFocus)}`)
  await orcaPage.screenshot({ path: testInfo.outputPath('split-cross-workspace-own-focus.png') })

  expectSplitTopBars('reference focus', referenceFocus)
  expectSplitTopBars('own focus', ownFocus)
})

function expectSplitTopBars(label: string, geometry: SplitGeometry): void {
  // No separate window bar row sits above the panes.
  expect(geometry.sessionBar, `${label}: window bar absent`).toBeNull()
  expect(geometry.sessionBarChatHeaders, `${label}: window bar pane actions`).toBe(0)

  const divider = geometry.dividers[0]
  expect(divider, `${label}: divider`).toBeDefined()
  expect(geometry.topBars, `${label}: one top row per top pane`).toHaveLength(2)
  const rowTop = Math.min(...geometry.topBars.map((bar) => bar.rect.top))
  // The window's top edge is y=0, so the top row is the first thing on screen.
  expect(rowTop, `${label}: top row at window top`).toBeLessThanOrEqual(1)
  // The divider starts at the top row and runs down past the panes.
  expect(Math.abs(divider.top - rowTop), `${label}: divider starts at top row`).toBeLessThanOrEqual(
    1
  )
  const paneBottom = Math.max(...geometry.panes.map((pane) => pane.body?.bottom ?? 0))
  expect(divider.bottom, `${label}: divider reaches bottom`).toBeGreaterThanOrEqual(paneBottom - 2)

  const windowControls = geometry.windowControls
  if (windowControls) {
    // The window controls line up with the top row: same height, same vertical position.
    expect(
      Math.abs(windowControls.height - 44),
      `${label}: window controls height`
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(windowControls.top - rowTop),
      `${label}: window controls top`
    ).toBeLessThanOrEqual(1)
  }

  for (const pane of geometry.panes) {
    expect(pane.host, `${label}: pane ${pane.tabId} on screen`).not.toBeNull()
    const row = geometry.topBars.find((bar) => bar.groupId === pane.groupId)
    expect(row, `${label}: pane ${pane.tabId} top row`).toBeDefined()
    expect(Math.abs(row!.rect.height - 44), `${label}: top row height`).toBeLessThanOrEqual(1)
    expect(Math.abs(row!.rect.top - rowTop), `${label}: top row alignment`).toBeLessThanOrEqual(1)
    expect(row!.chatHeaders, `${label}: pane ${pane.tabId} header count`).toBe(1)
    expect(row!.title, `${label}: pane ${pane.tabId} names its session`).toBeTruthy()
    // Each header sits on its own half of the divider.
    expect(row!.rect.right <= divider.left + 1 || row!.rect.left >= divider.right - 1).toBe(true)
    expect(row!.rect.left).toBeGreaterThanOrEqual(pane.body!.left - 1)
    expect(row!.rect.right).toBeLessThanOrEqual(pane.body!.right + 1)
    // The free area of the header drags the window; its buttons do not.
    expect(row!.titleRegion, `${label}: title drags`).toBe('drag')
    expect(row!.ownActionsRegion, `${label}: own actions`).toBe('no-drag')
    expect(row!.buttonRegions.length, `${label}: pane buttons`).toBeGreaterThan(0)
    for (const region of row!.buttonRegions) {
      expect(region, `${label}: pane button is no-drag`).toBe('no-drag')
    }
  }

  // The window controls and the global toggles sit at the right end of the rightmost header.
  const byLeft = [...geometry.topBars].sort((a, b) => a.rect.left - b.rect.left)
  const leftmost = byLeft.at(0)!
  const rightmost = byLeft.at(-1)!
  expect(rightmost.windowActions, `${label}: rightmost header window actions`).not.toBeNull()
  expect(rightmost.windowActionsRegion, `${label}: window actions are no-drag`).toBe('no-drag')
  expect(leftmost.windowActions, `${label}: leftmost header has no window actions`).toBeNull()
  expect(
    rightmost.ownActions!.right,
    `${label}: own buttons before window actions`
  ).toBeLessThanOrEqual(rightmost.windowActions!.left + 1)
  if (windowControls) {
    // Why: with the right sidebar open its header takes the window controls, as it does in a single pane.
    expect(
      windowControls.left,
      `${label}: window controls on rightmost header`
    ).toBeGreaterThanOrEqual(rightmost.rect.left - 1)
    if (!geometry.rightSidebarOpen) {
      expect(
        windowControls.right,
        `${label}: window controls on rightmost header`
      ).toBeLessThanOrEqual(rightmost.rect.right + 1)
    }
  }

  // The unfocused pane is veiled, and the veil paints above its session host.
  expect(geometry.veil, `${label}: veil`).not.toBeNull()
  expect(geometry.veil!.veilIndex).toBeGreaterThanOrEqual(0)
  expect(
    geometry.veil!.hostIndex === -1 || geometry.veil!.veilIndex < geometry.veil!.hostIndex
  ).toBe(true)
}

test('a single chat session keeps its header in the session bar', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(300_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })

  await startChatSession(orcaPage, null, 'the only session')
  await expect.poll(async () => (await chatWorktrees(orcaPage)).length, { timeout: 30_000 }).toBe(1)
  const [worktreeId] = await chatWorktrees(orcaPage)
  await openWorktree(orcaPage, worktreeId)
  const tab = await chatTab(orcaPage, worktreeId)
  const pane = [{ tabId: tab.id, groupId: tab.groupId }]
  await expect.poll(async () => (await measureSplit(orcaPage, pane)).sessionBarChatHeaders).toBe(1)

  const geometry = await measureSplit(orcaPage, pane)
  expect(geometry.dividers).toHaveLength(0)
  expect(geometry.topBars).toHaveLength(0)
  expect(geometry.sessionBar).not.toBeNull()
  await orcaPage.screenshot({ path: testInfo.outputPath('single-chat.png') })
})
