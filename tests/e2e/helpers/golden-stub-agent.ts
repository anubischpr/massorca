import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect } from '@stablyai/playwright-test'
import { focusActiveTerminalInput, waitForTerminalOutput } from './terminal'
import type { BuiltInWindowsTerminalShell } from '../../../src/shared/windows-terminal-shell'

export const GOLDEN_STUB_READY_MARKER = 'GOLDEN_STUB_AGENT_READY'
export const GOLDEN_STUB_EXIT_MARKER = 'GOLDEN_STUB_AGENT_EXITED'

/** Agents exposed by the fixture directory for tab-bar detection. */
export const GOLDEN_STUB_AGENTS = [
  { id: 'codex', menuItemName: /^Codex(?:\s|$)/i },
  { id: 'claude', menuItemName: /^Claude(?:\s|$)/i }
] as const

const fixtureDir = path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'golden-stub-agent')

export function getGoldenStubAgentLaunchEnv(): NodeJS.ProcessEnv {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  return {
    [pathKey]: [fixtureDir, process.env[pathKey] ?? ''].filter(Boolean).join(path.delimiter)
  }
}

export async function configureGoldenStubAgent(
  page: Page,
  options: {
    agent?: (typeof GOLDEN_STUB_AGENTS)[number]['id'] | 'grok'
    agentArgs?: string
    /** Windows default shell the launch command must survive; ignored elsewhere. */
    windowsShell?: BuiltInWindowsTerminalShell
  } = {}
): Promise<void> {
  const agent = options.agent ?? 'codex'
  await page.evaluate(
    async ({ agent, agentArgs, windowsShell }) => {
      const store = window.__store
      if (!store) {
        throw new Error('Orca store is unavailable')
      }
      await store.getState().updateSettings({
        defaultTuiAgent: agent,
        agentCmdOverrides: { [agent]: 'golden-stub-agent' },
        agentDefaultArgs: { [agent]: agentArgs },
        ...(windowsShell ? { terminalWindowsShell: windowsShell } : {})
      })
    },
    { agent, agentArgs: options.agentArgs ?? '', windowsShell: options.windowsShell ?? null }
  )
}

/** Starts the stub agent as a Terminal-mode session through the + Create composer, the only agent launcher. */
export async function launchGoldenStubAgentFromCreate(
  page: Page,
  agentName: RegExp = /^Codex(?:\s|$)/i
): Promise<void> {
  await page.evaluate(() => window.__store?.getState().openCreateChatPage())
  await expect(page.getByRole('heading', { name: 'What do you want to build?' })).toBeVisible()
  await page
    .getByRole('radiogroup', { name: 'Session view' })
    .getByRole('radio', { name: 'Terminal', exact: true })
    .click()
  await page.getByRole('button', { name: 'Agent, model and effort' }).click()
  await page.getByRole('menuitemradio', { name: agentName }).first().click()
  await page.keyboard.press('Escape')
  const composer = page.getByRole('textbox').last()
  await composer.fill('start the golden stub')
  await composer.press('Enter')
  await focusActiveTerminalInput(page)
  await waitForTerminalOutput(page, GOLDEN_STUB_READY_MARKER, 20_000)
}
