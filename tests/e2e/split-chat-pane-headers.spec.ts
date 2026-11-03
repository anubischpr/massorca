import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

// A split with two chat sessions: each pane carries its own header on its own half, the window's
// session bar keeps no pane actions, and the divider runs up to the top of the panes.

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

type Rect = { top: number; left: number; right: number; bottom: number }

type ChatTab = { id: string; groupId: string }

type SplitGeometry = {
  barBottom: number | null
  barChatHeaders: number
  dividers: Rect[]
  panes: { tabId: string; host: Rect | null; headers: Rect[]; title: string | null }[]
  veil: { bodyId: string | null; veilIndex: number; hostIndex: number } | null
  focus: { activeWorktreeId: string | null; paneFocus: unknown; activeGroupIdByWorktree: unknown }
}

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
    await page.getByRole('menuitemradio', { name: /^Claude/ }).first().click()
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

/** Where the window bar, the dividers and each chat pane's host and header sit, and the veil's stacking. */
async function measureSplit(page: Page, tabIds: string[]): Promise<SplitGeometry> {
  return page.evaluate((ids) => {
    const rect = (el: Element | null): Rect | null => {
      if (!el) {
        return null
      }
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }
    }
    const bar = document.querySelector('[data-session-bar="true"]')
    const panes = ids.map((tabId) => {
      const host = document.querySelector(
        `[data-structured-agent-session-overlay-tab-id="${tabId}"]`
      )
      const headers = [...(host?.querySelectorAll('[data-native-chat-pane-header]') ?? [])]
      return {
        tabId,
        host: rect(host),
        headers: headers.flatMap((el) => {
          const box = rect(el)
          return box ? [box] : []
        }),
        title: host?.querySelector('[data-native-chat-pane-title-row]')?.textContent?.trim() ?? null
      }
    })
    const dividers = [...document.querySelectorAll('.tab-group-split-resize-handle')].flatMap(
      (el) => {
        const box = rect(el)
        return box ? [box] : []
      }
    )
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
      barBottom: rect(bar)?.bottom ?? null,
      barChatHeaders: bar?.querySelectorAll('[data-native-chat-pane-header]').length ?? 0,
      dividers,
      panes,
      veil,
      focus: {
        activeWorktreeId: state?.activeWorktreeId ?? null,
        paneFocus: state?.paneFocus ?? null,
        activeGroupIdByWorktree: state?.activeGroupIdByWorktree ?? {}
      }
    }
  }, tabIds)
}

test('a split of two chat sessions from two workspaces: each pane shows its own header on its half', async ({
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

  // Right after the split, the referenced pane holds the focus.
  const referenceFocus = await measureSplit(orcaPage, [first.id, second.id])
  console.log(`SPLIT_GEOMETRY_REFERENCE_FOCUS ${JSON.stringify(referenceFocus)}`)
  await orcaPage.screenshot({
    path: testInfo.outputPath('split-cross-workspace-reference-focus.png')
  })

  // Focusing the first workspace's own chat moves the focus to its pane.
  await orcaPage
    .locator(`[data-structured-agent-session-overlay-tab-id="${first.id}"]`)
    .click({ position: { x: 40, y: 40 } })
  await orcaPage.waitForTimeout(1500)
  const ownFocus = await measureSplit(orcaPage, [first.id, second.id])
  console.log(`SPLIT_GEOMETRY_OWN_FOCUS ${JSON.stringify(ownFocus)}`)
  await orcaPage.screenshot({ path: testInfo.outputPath('split-cross-workspace-own-focus.png') })

  expectSplitHeaders('reference focus', referenceFocus)
  expectSplitHeaders('own focus', ownFocus)
})

function expectSplitHeaders(label: string, geometry: SplitGeometry): void {
  // The window bar holds no pane's actions while the window is split.
  expect(geometry.barChatHeaders, `${label}: window bar pane actions`).toBe(0)

  const divider = geometry.dividers[0]
  expect(divider, `${label}: divider`).toBeDefined()
  expect(divider.top, `${label}: divider reaches the bar`).toBeLessThanOrEqual(
    (geometry.barBottom ?? divider.top) + 1
  )
  for (const pane of geometry.panes) {
    const host = pane.host
    expect(host, `${label}: pane ${pane.tabId} on screen`).not.toBeNull()
    expect(pane.headers, `${label}: pane ${pane.tabId} header count`).toHaveLength(1)
    expect(pane.title, `${label}: pane ${pane.tabId} names its session`).toBeTruthy()
    const header = pane.headers[0]
    expect(header.top).toBeGreaterThanOrEqual(host!.top - 1)
    expect(header.left).toBeGreaterThanOrEqual(host!.left - 1)
    expect(header.right).toBeLessThanOrEqual(host!.right + 1)
    // Each pane's header sits on its own half of the divider.
    expect(host!.right <= divider.left + 1 || host!.left >= divider.right - 1).toBe(true)
    // The divider reaches the top of each pane.
    expect(divider.top).toBeLessThanOrEqual(host!.top + 1)
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
  await expect.poll(async () => (await measureSplit(orcaPage, [tab.id])).barChatHeaders).toBe(1)

  const geometry = await measureSplit(orcaPage, [tab.id])
  expect(geometry.dividers).toHaveLength(0)
  expect(geometry.panes[0].headers).toHaveLength(0)
  await orcaPage.screenshot({ path: testInfo.outputPath('single-chat.png') })
})
