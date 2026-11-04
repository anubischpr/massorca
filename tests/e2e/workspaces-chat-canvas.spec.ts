import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { configureGoldenStubAgent, getGoldenStubAgentLaunchEnv } from './helpers/golden-stub-agent'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

// Workspaces surfaces paint the same chat canvas as Bot teams: the empty workspace (which is the
// create-chat page), the + Create page and a chat session view.

test.use({ launchEnv: getGoldenStubAgentLaunchEnv() })

type Painter = { color: string; element: string }

/** The background each grid point in the center column shows, and the element that paints it. */
async function centerPainters(page: Page): Promise<Painter[]> {
  return page.evaluate(() => {
    const rail = document.querySelector('.app-rail')?.getBoundingClientRect()
    const left = (rail?.right ?? 52) + 8
    const right = window.innerWidth - 8
    const top = 4
    const bottom = window.innerHeight - 40
    const seen = new Map<string, { color: string; element: string }>()
    for (let x = left; x < right; x += (right - left) / 12) {
      for (let y = top; y < bottom; y += (bottom - top) / 12) {
        const hit = document.elementFromPoint(x, y)
        // Why: controls paint their own fills; only the surfaces behind them matter here.
        if (hit?.closest('button, input, textarea, [role="button"], .app-rail')) {
          continue
        }
        for (let node = hit; node; node = node.parentElement) {
          const color = getComputedStyle(node).backgroundColor
          if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
            const element = `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 120)}`
            seen.set(`${color}|${element}`, { color, element })
            break
          }
        }
      }
    }
    return [...seen.values()]
  })
}

async function botTeamsCanvas(page: Page): Promise<string> {
  await page.evaluate(() => window.__store?.getState().setActiveView('bot-teams'))
  const canvas = page.locator('.bg-chat-canvas').first()
  await expect(canvas).toBeVisible()
  return canvas.evaluate((el) => getComputedStyle(el).backgroundColor)
}

function expectOnlyCanvas(label: string, painters: Painter[], canvas: string): void {
  // Inputs, chips and cards may paint their own fill; the page surfaces must not show the darker background.
  const offenders = painters.filter(
    (p) => p.color === 'rgb(10, 10, 10)' || p.color === 'rgb(18, 18, 18)'
  )
  expect(offenders, `${label}: surfaces painting #0a0a0a or #121212`).toEqual([])
  expect(
    painters.some((p) => p.color === canvas),
    `${label}: chat canvas visible`
  ).toBe(true)
}

test('Workspaces pages paint the Bot teams chat canvas', async ({ orcaPage }, testInfo) => {
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await configureGoldenStubAgent(orcaPage, { agent: 'claude' })
  // Why: the #0a0a0a background only exists in the dark palette.
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettingsOrThrow({ theme: 'dark' })
  })
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  const canvas = await botTeamsCanvas(orcaPage)

  // A workspace with no session opens straight on the create-chat page.
  await orcaPage.evaluate((id) => {
    const state = window.__store?.getState()
    state?.setActiveView('terminal')
    state?.setActiveWorktree(id)
  }, worktreeId)
  await expect(orcaPage.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await orcaPage.waitForTimeout(500)
  const empty = await centerPainters(orcaPage)
  console.log(`CANVAS_EMPTY ${JSON.stringify(empty)}`)
  await orcaPage.screenshot({ path: testInfo.outputPath('workspace-empty.png') })

  await orcaPage.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(orcaPage.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await orcaPage.waitForTimeout(500)
  const create = await centerPainters(orcaPage)
  console.log(`CANVAS_CREATE ${JSON.stringify(create)}`)
  await orcaPage.screenshot({ path: testInfo.outputPath('create-chat.png') })

  await orcaPage
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: 'Chat', exact: true })
    .click()
  const agentChip = orcaPage.getByRole('button', { name: 'Agent, model and effort' })
  if (!(await agentChip.textContent())?.includes('Claude')) {
    await agentChip.click()
    await orcaPage
      .getByRole('menuitemradio', { name: /^Claude/ })
      .first()
      .click()
    await orcaPage.keyboard.press('Escape')
  }
  const composer = orcaPage.getByRole('textbox').last()
  await composer.fill('canvas check')
  await composer.press('Enter')
  await expect
    .poll(
      () =>
        orcaPage.evaluate(() => {
          const state = window.__store?.getState()
          const id = state?.activeWorktreeId
          return (
            state?.activeView === 'terminal' &&
            !!id &&
            (state.unifiedTabsByWorktree[id] ?? []).some((t) => t.contentType === 'agent-session')
          )
        }),
      { timeout: 30_000 }
    )
    .toBe(true)
  await orcaPage.waitForTimeout(2500)
  const session = await centerPainters(orcaPage)
  console.log(`CANVAS_SESSION ${JSON.stringify(session)}`)
  await orcaPage.screenshot({ path: testInfo.outputPath('chat-session.png') })

  const pages: [string, Painter[]][] = []
  for (const [label, opener] of [
    ['prototypes', 'openPrototypesPage'],
    ['tasks', 'openTasksHome'],
    ['calendar', 'openCalendarPage'],
    ['settings', 'openSettingsPage']
  ] as const) {
    await orcaPage.evaluate((name) => window.__store?.getState()[name](), opener)
    await orcaPage.waitForTimeout(1500)
    const painters = await centerPainters(orcaPage)
    console.log(`CANVAS_${label.toUpperCase()} ${JSON.stringify(painters)}`)
    await orcaPage.screenshot({ path: testInfo.outputPath(`${label}.png`) })
    pages.push([label, painters])
  }

  expectOnlyCanvas('empty workspace', empty, canvas)
  expectOnlyCanvas('create-chat page', create, canvas)
  expectOnlyCanvas('chat session', session, canvas)
  for (const [label, painters] of pages) {
    expectOnlyCanvas(label, painters, canvas)
  }
})
