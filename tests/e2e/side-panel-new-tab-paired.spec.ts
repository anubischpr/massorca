import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import {
  launchHeadlessPairedRuntimeHost,
  type HeadlessPairedRuntimeHost
} from './helpers/headless-paired-runtime-host'
import { launchPairedElectronClient } from './helpers/paired-electron-client'

const panelTabs = (page: Page) =>
  page.locator('[data-side-panel="true"] [data-testid="side-panel-tab"]')

async function createFromMenu(page: Page, item: RegExp): Promise<void> {
  await page.locator('[data-side-panel="true"]').getByRole('button', { name: 'New tab' }).click()
  const entry = page.getByRole('menuitem', { name: item })
  await expect(entry).toBeVisible({ timeout: 15_000 })
  await entry.click()
}

// Why: the user's side panel "+" did nothing on a worktree served by a paired runtime. This drives the
// real menu against a real headless host, so the remote create path is exercised instead of read.
test('the side panel + menu creates every kind of tab on a worktree served by a paired runtime', async ({
  testRepoPath
}, testInfo) => {
  test.setTimeout(300_000)
  const host: HeadlessPairedRuntimeHost = await launchHeadlessPairedRuntimeHost()
  try {
    await host.client.call('repo.add', { path: testRepoPath, kind: 'git' })
    await host.client.call('terminal.create', {
      worktree: `path:${testRepoPath}`,
      title: 'Side panel canary'
    })
    const client = await launchPairedElectronClient(host.offer, testInfo, 'side panel new tab')
    try {
      const page = client.page
      // Why first worktree: the host serves only this repo, and Windows path spellings differ between hosts.
      await expect
        .poll(() => page.evaluate(() => window.__store?.getState().allWorktrees()[0]?.id ?? null), {
          timeout: 60_000,
          message: 'paired client never received the host worktree'
        })
        .not.toBeNull()
      const worktreeId = await page.evaluate(
        () => window.__store?.getState().allWorktrees()[0]?.id ?? ''
      )
      await page.evaluate(
        ({ environmentId, id }) => {
          window.__store?.getState().setActiveWorktree(id, `runtime:${environmentId}`)
        },
        { environmentId: client.environmentId, id: worktreeId }
      )
      await expect(page.locator('header[data-session-bar="true"]')).toBeVisible({ timeout: 60_000 })

      const toggle = page.getByRole('button', { name: 'Side panel', exact: true })
      if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
        await toggle.click()
      }
      await expect(page.locator('[data-side-panel="true"][data-open="true"]')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('paired-side-panel-open.png') })

      const results: Record<string, string> = {}
      for (const [name, item] of [
        ['terminal', /New Terminal/i],
        ['browser', /New Browser Tab/i],
        ['markdown', /New Markdown/i],
        ['emulator', /New Mobile Emulator/i]
      ] as const) {
        const before = await panelTabs(page).count()
        await createFromMenu(page, item)
        try {
          await expect.poll(() => panelTabs(page).count(), { timeout: 20_000 }).toBe(before + 1)
          results[name] = 'tab added'
        } catch {
          results[name] = `no tab (still ${await panelTabs(page).count()})`
        }
        await page.screenshot({ path: testInfo.outputPath(`paired-side-panel-${name}.png`) })
      }
      testInfo.annotations.push({ type: 'results', description: JSON.stringify(results) })
      console.log('PAIRED_SIDE_PANEL_RESULTS', JSON.stringify(results))
      expect(results).toMatchObject({
        terminal: 'tab added',
        browser: 'tab added',
        markdown: 'tab added'
      })
    } finally {
      await client.dispose()
    }
  } finally {
    await host.dispose()
  }
})
