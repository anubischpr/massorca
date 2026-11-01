import type { Page } from '@stablyai/playwright-test'
import { isDraggableAtCentre } from './helpers/electron-drag-region'
import { expect, test } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

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
  // Why: the corner default went unnoticed; the hint sits mid-window, away from the rail and the corner controls.
  await expect(
    orcaPage.locator('[data-sonner-toaster][data-x-position="center"][data-y-position="bottom"]')
  ).toHaveCount(1)

  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await orcaPage.getByText('Click Workspaces again to switch to Bot teams.').waitFor({
    state: 'hidden',
    timeout: 15_000
  })
  await rail.getByRole('button', { name: 'Workspaces', exact: true }).click()
  await expect(orcaPage.getByText('Click Workspaces again to switch to Bot teams.')).toHaveCount(0)
})

/** Two teams on the host this window talks to, the way the Bot teams page would create them. */
async function seedBotTeams(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const teams = [
      {
        name: 'Marketing',
        purpose: 'Campaigns',
        character: 'square',
        bots: [
          { name: 'Iris', job: 'Writes copy', agent: 'claude' },
          { name: 'Nora', job: 'Plans', agent: 'claude' }
        ]
      },
      {
        name: 'Sales',
        purpose: 'Leads',
        character: 'circle',
        bots: [{ name: 'Leo', job: 'Follows up', agent: 'claude' }]
      }
    ]
    for (const team of teams) {
      const response = await window.api.runtime.call({ method: 'botTeams.create', params: team })
      if (!response.ok) {
        throw new Error(`${response.error.code}: ${response.error.message}`)
      }
    }
  })
}

test('Bot teams mode replaces the workspace sidebar body with the teams, one open at a time', async ({
  orcaPage
}) => {
  await seedBotTeams(orcaPage)
  const rail = orcaPage.locator('nav[data-app-rail="true"]')
  const sidebar = orcaPage.locator('[data-bot-teams-sidebar="true"]')
  // Why: the Workspaces sidebar's navigation block holds Create, Prototypes and the other page rows.
  const workspacesNav = orcaPage.locator('[data-contextual-tour-target="sidebar-navigation"]')
  await expect(sidebar).toHaveCount(0)
  await expect(workspacesNav.getByRole('button', { name: 'Create', exact: true })).toBeVisible()

  await rail.locator('button').first().click()
  await expect(sidebar).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'All teams' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Marketing' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Sales' })).toBeVisible()
  // Why: Create and the Projects list belong to Workspaces mode.
  await expect(workspacesNav).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Conference room' })).toHaveCount(0)

  await sidebar.getByRole('button', { name: 'Marketing' }).click()
  await expect(orcaPage.getByRole('heading', { name: 'Marketing' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Conference room' })).toHaveCount(1)
  await sidebar.getByRole('button', { name: 'Sales' }).click()
  await expect(orcaPage.getByRole('heading', { name: 'Sales' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Conference room' })).toHaveCount(1)

  await sidebar.getByRole('button', { name: 'All teams' }).click()
  await expect(orcaPage.getByRole('heading', { name: 'All teams' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Conference room' })).toHaveCount(0)

  await rail.locator('button').first().click()
  await expect(sidebar).toHaveCount(0)
  await expect(workspacesNav.getByRole('button', { name: 'Create', exact: true })).toBeVisible()
})

test('the Tasks switch defaults to the rail mode, and Bot Team saves a real task to Todo', async ({
  orcaPage
}) => {
  await seedBotTeams(orcaPage)
  const rail = orcaPage.locator('nav[data-app-rail="true"]')
  const create = orcaPage.getByRole('radiogroup', { name: 'Create' })

  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(create.getByRole('radio', { name: 'WorkSpaces' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await create.getByRole('radio', { name: 'Bot Team' }).click()
  await expect(create.getByRole('radio', { name: 'Bot Team' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect(orcaPage.getByRole('button', { name: 'Team', exact: true })).toContainText(
    'Marketing'
  )
  await expect(
    orcaPage.getByRole('button', { name: 'When the task starts', exact: true })
  ).toHaveText('Save to Todo')

  await orcaPage
    .getByPlaceholder('Describe the task for the team…')
    .fill('@Iris publish the summer flyer')
  await orcaPage.getByRole('button', { name: 'Create task', exact: true }).click()
  await expect
    .poll(() => orcaPage.evaluate(() => window.__store?.getState().activeView))
    .toBe('bot-teams')
  await expect(orcaPage.getByText('publish the summer flyer').first()).toBeVisible()

  const stored = await orcaPage.evaluate(async () => {
    const field = (value: unknown, key: string): unknown =>
      typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined
    const teams = await window.api.runtime.call({ method: 'botTeams.list', params: {} })
    if (!teams.ok) {
      throw new Error(teams.error.message)
    }
    const listed = field(teams.result, 'teams')
    const marketing = Array.isArray(listed)
      ? listed.find((team) => field(team, 'name') === 'Marketing')
      : undefined
    const room = await window.api.runtime.call({
      method: 'botTeams.listRoom',
      params: { teamId: field(marketing, 'id') }
    })
    if (!room.ok) {
      throw new Error(room.error.message)
    }
    const tasks = field(room.result, 'tasks')
    return Array.isArray(tasks)
      ? tasks.map((task) => ({ title: field(task, 'title'), sessionId: field(task, 'sessionId') }))
      : []
  })
  expect(stored).toEqual([{ title: 'publish the summer flyer', sessionId: null }])

  // Entered from Bot teams mode, the switch starts on Bot Team.
  await rail.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(create.getByRole('radio', { name: 'Bot Team' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
})

test('every section wears the same top bar surface, and Prototypes keeps its panel toggle in it', async ({
  orcaPage
}) => {
  const backgroundOf = (selector: string): Promise<string> =>
    orcaPage.evaluate((target) => {
      const element = document.querySelector(target)
      if (!element) {
        throw new Error(`Missing ${target}`)
      }
      return getComputedStyle(element).backgroundColor
    }, selector)

  const sessionBar = await backgroundOf('header[data-session-bar="true"]')
  const views = [
    'openCreateChatPage',
    'openTasksHome',
    'openTaskPage',
    'openPrototypesPage',
    'openArtifactsPage',
    'openSkillsPage',
    'openAutomationsPage',
    'openMobilePage',
    'openSettingsPage'
  ] as const
  for (const open of views) {
    await orcaPage.evaluate((action) => {
      const state = window.__store?.getState()
      const opens = {
        openCreateChatPage: () => state?.openCreateChatPage(),
        openTasksHome: () => state?.openTasksHome(),
        openTaskPage: () => state?.openTaskPage(),
        openPrototypesPage: () => state?.openPrototypesPage(),
        openArtifactsPage: () => state?.openArtifactsPage(),
        openSkillsPage: () => state?.openSkillsPage(),
        openAutomationsPage: () => state?.openAutomationsPage(),
        openMobilePage: () => state?.openMobilePage(),
        openSettingsPage: () => state?.openSettingsPage()
      }
      opens[action]()
    }, open)
    await expect(orcaPage.locator('[data-page-top-band="true"]')).toBeVisible()
    expect(await backgroundOf('[data-page-top-band="true"]'), open).toBe(sessionBar)
  }

  await orcaPage.evaluate(() => window.__store?.getState().openPrototypesPage())
  const actions = orcaPage.locator('[data-page-top-band-actions="true"]')
  await expect(actions).toHaveCount(1)
  // Why: the slot sits right before the window-controls spacer, the same place sessions keep their toggles.
  expect(
    await actions.evaluate((slot) => slot.nextElementSibling?.className.includes('window-controls'))
  ).toBe(true)
})

test('the Tasks composer sits above center and does not move when approval rows appear', async ({
  orcaPage
}) => {
  await orcaPage.evaluate(() => window.__store?.getState().openTasksHome())
  const composer = orcaPage.locator('textarea[placeholder^="Describe the task"]')
  await expect(composer).toBeVisible()

  const measure = (): Promise<{
    top: number
    left: number
    blockCenter: number
    areaCenter: number
  }> =>
    orcaPage.evaluate(() => {
      const box = document.querySelector('textarea[placeholder^="Describe the task"]')
      const heading = [...document.querySelectorAll('h1')].find((element) =>
        /What do you want to do/.test(element.textContent ?? '')
      )
      const area = heading?.closest('.overflow-y-auto')
      if (!box || !heading || !area) {
        throw new Error('Tasks home is not rendered')
      }
      const boxRect = box.getBoundingClientRect()
      const headingRect = heading.getBoundingClientRect()
      const areaRect = area.getBoundingClientRect()
      return {
        top: Math.round(boxRect.top),
        left: Math.round(boxRect.left),
        blockCenter: (headingRect.top + boxRect.bottom) / 2,
        areaCenter: areaRect.top + areaRect.height / 2
      }
    })

  const before = await measure()
  // Why: not true center, but a little above it, since the approvals list follows below.
  expect(before.blockCenter).toBeLessThan(before.areaCenter)

  await orcaPage.evaluate(() => {
    const state = window.__store?.getState()
    const entries = Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => {
        const key = `tab-${index}:11111111-1111-4111-8111-11111111111${index}`
        return [
          key,
          {
            paneKey: key,
            state: 'waiting',
            prompt: `Needs a decision ${index + 1}`,
            updatedAt: Date.now(),
            stateStartedAt: Date.now() - 1000 * (index + 1),
            stateHistory: [],
            worktreeId: state?.activeWorktreeId,
            agentType: 'claude'
          }
        ]
      })
    )
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the rows carry only the fields the approvals list reads.
    window.__store?.setState({ agentStatusByPaneKey: entries } as never)
  })
  await expect(orcaPage.getByText('Needs your approval')).toBeVisible()
  const after = await measure()
  expect(after.top).toBe(before.top)
  expect(after.left).toBe(before.left)
})
