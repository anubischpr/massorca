import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { structuredAgentSessionCreateParams } from '../../src/shared/structured-agent-session-create'
import { expect, test } from './helpers/orca-app'
import { launchHeadlessPairedRuntimeHost } from './helpers/headless-paired-runtime-host'
import { launchPairedElectronClient } from './helpers/paired-electron-client'

const SENTENCE =
  'diseña una nueva versión de la pantalla de NexusCare donde actualmente se procesan las liquidaciones en la fase 1, 2 y 3.'
const SHOTS = process.env.PROTOTYPES_QA_SHOTS ?? ''

test('prototypes on a paired runtime: card, request folder on the host, list, viewer, link', async ({
  testRepoPath
}, testInfo) => {
  test.setTimeout(240_000)
  const host = await launchHeadlessPairedRuntimeHost()
  const client = await launchPairedElectronClient(host.offer, testInfo, 'prototypes-qa').catch(
    async (error) => {
      await host.dispose()
      throw error
    }
  )
  try {
    const page = client.page
    const shot = async (name: string): Promise<void> => {
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true })
        await page.screenshot({ path: path.join(SHOTS, name) })
      }
    }
    await host.client.call('repo.add', { path: testRepoPath, kind: 'git' })
    await expect
      .poll(() => page.evaluate(() => window.__store?.getState().allWorktrees()[0]?.id ?? null), {
        timeout: 30_000
      })
      .not.toBeNull()
    const worktreeId = await page.evaluate(
      () => window.__store?.getState().allWorktrees()[0]?.id ?? ''
    )
    const sessionId = `claude_${randomUUID().replaceAll('-', '_')}`
    const params = structuredAgentSessionCreateParams({
      sessionId,
      worktree: `id:${worktreeId}`,
      agent: 'claude',
      randomUuid: randomUUID
    })
    const created = await page.evaluate(
      async (args) =>
        window.api.runtimeEnvironments.call({
          selector: args.environmentId,
          method: 'agentSession.create',
          params: args.params
        }),
      { environmentId: client.environmentId, params }
    )
    expect(created).toBeTruthy()
    await page.evaluate((id) => window.__store?.getState().setActiveWorktree(id), worktreeId)
    await page.waitForTimeout(8000)
    const composer = page.locator('[contenteditable="true"], textarea').last()
    await expect(composer).toBeVisible({ timeout: 30_000 })
    // /prototype is offered in the slash menu.
    await composer.click()
    await page.keyboard.type('/proto')
    await expect(page.getByText('Make HTML prototypes of an idea')).toBeVisible({ timeout: 10_000 })
    await shot('02-slash-menu.png')
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Backspace')
    }
    await page.keyboard.type(SENTENCE)
    await page.keyboard.press('Enter')
    const card = page.locator('[data-native-chat-prototype-count-card="true"]')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await shot('03-count-card.png')
    await card.getByRole('button', { name: '2', exact: true }).click()

    const visualsRoot = path.join(host.userDataDir, 'native-chat-visuals')
    const findRequest = (): string | null => {
      if (!existsSync(visualsRoot)) {
        return null
      }
      for (const chat of readdirSync(visualsRoot)) {
        const folder = path.join(visualsRoot, chat, 'prototypes')
        if (existsSync(folder)) {
          const [id] = readdirSync(folder)
          if (id) {
            return path.join(folder, id)
          }
        }
      }
      return null
    }
    await expect.poll(findRequest, { timeout: 30_000 }).not.toBeNull()
    const requestFolder = findRequest()
    if (requestFolder === null) {
      throw new Error('The runtime wrote no prototype request folder')
    }
    const manifest = JSON.parse(readFileSync(path.join(requestFolder, 'request.json'), 'utf8'))
    expect(manifest.originalPrompt).toBe(SENTENCE)
    expect(manifest.count).toBe(2)

    await page.waitForTimeout(3000)
    const history = await page.evaluate(
      (args) =>
        window.api.runtimeEnvironments.call({
          selector: args.environmentId,
          method: 'agentSession.history',
          params: { sessionId: args.sessionId, direction: 'tail', limit: 50 }
        }),
      { environmentId: client.environmentId, sessionId }
    )
    const historyText = JSON.stringify(history)
    expect(historyText).toContain('orca-prototype-request:')
    expect(historyText).toContain(JSON.stringify(requestFolder).slice(1, -1))
    await shot('04-after-send.png')

    // Simulate the agent writing its directions into the host folder.
    for (const [letter, color] of [
      ['A', '#e0f2fe'],
      ['B', '#fee2e2']
    ] as const) {
      writeFileSync(
        path.join(requestFolder, `${letter}.html`),
        `<!doctype html><meta charset="utf-8"><body style="margin:0;background:${color};font:32px sans-serif;padding:40px"><h1>Direction ${letter}</h1><p>NexusCare liquidaciones</p><button>Procesar fase 1</button></body>`
      )
    }
    const link = page.locator('[data-native-chat-prototype-link-card="true"]')
    await expect(link).toBeVisible({ timeout: 40_000 })
    await shot('05-chat-link-card.png')
    await link.click()
    await expect(page.frameLocator('iframe').first().getByText('Direction A')).toBeVisible({
      timeout: 30_000
    })
    await shot('06-prototypes-view.png')
  } finally {
    await client.dispose()
    await host.dispose()
  }
})
