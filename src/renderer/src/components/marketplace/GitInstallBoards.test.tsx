// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitInstallPlanView } from '../../../../shared/marketplace-install'
import {
  GitInstallBeforeBoard,
  GitInstallFailedBoard,
  GitInstallInstalledBoard,
  GitInstallInstallingBoard,
  GitInstallOutsideBoard
} from './GitInstallBoards'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const copyText = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('./marketplace-clipboard', () => ({ copyMarketplaceText: copyText }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

const roots: { container: HTMLDivElement; root: Root }[] = []

async function render(node: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })
  await act(async () => {
    root.render(node)
  })
  return container
}

function buttonWith(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  )
}

afterEach(async () => {
  for (const { container, root } of roots.splice(0)) {
    await act(async () => root.unmount())
    container.remove()
  }
  copyText.mockClear()
})

const aptPlan: GitInstallPlanView = {
  manager: 'apt',
  command: 'sudo apt-get install -y git',
  manualCommand: 'sudo apt-get install -y git',
  steps: [
    {
      id: 'admin-check',
      label: 'Check administrator access without a password',
      elevation: 'sudo'
    },
    { id: 'install', label: 'Install Git with apt', elevation: 'sudo' },
    { id: 'verify', label: 'Check that Git works', elevation: 'none' }
  ]
}

describe('Git install boards', () => {
  it('before installing: shows what will run and an Install button', async () => {
    const onInstall = vi.fn()
    const container = await render(<GitInstallBeforeBoard plan={aptPlan} onInstall={onInstall} />)
    expect(container.textContent).toContain('Git is not installed on this computer.')
    expect(container.textContent).toContain('sudo apt-get install -y git')
    expect(container.textContent).toContain('administrator password')
    await act(async () => buttonWith(container, 'Install')?.click())
    expect(onInstall).toHaveBeenCalledTimes(1)
  })

  it('installing: lists each step with its live status and log lines', async () => {
    const container = await render(
      <GitInstallInstallingBoard
        steps={[
          { ...aptPlan.steps[0]!, status: 'done' },
          { ...aptPlan.steps[1]!, status: 'running' },
          { ...aptPlan.steps[2]!, status: 'pending' }
        ]}
        log={['Reading package lists...']}
      />
    )
    expect(container.textContent).toContain('Installing Git…')
    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(container.textContent).toContain('Reading package lists...')
  })

  it('installed: shows version, path and Installed by MassOrca', async () => {
    const container = await render(
      <GitInstallInstalledBoard version="2.45.1" path="/usr/bin/git" />
    )
    expect(container.textContent).toContain('Git is installed on this computer.')
    expect(container.textContent).toContain('Installed by MassOrca')
    expect(container.textContent).toContain('2.45.1')
    expect(container.textContent).toContain('/usr/bin/git')
  })

  it('failed: plain reason, the exact manual command with Copy, and the re-check note', async () => {
    const container = await render(
      <GitInstallFailedBoard reason="needs-password" manualCommand="sudo apt-get install -y git" />
    )
    expect(container.textContent).toContain('Git could not be installed.')
    expect(container.textContent).toContain('administrator password')
    expect(container.textContent).toContain('checks again when you come back')
    await act(async () => buttonWith(container, 'Copy')?.click())
    expect(copyText).toHaveBeenCalledWith('sudo apt-get install -y git')
  })

  it('outside: offers Manage when a package manager owns Git, Reinstall when it does not', async () => {
    const onAdopt = vi.fn()
    const managed = await render(
      <GitInstallOutsideBoard
        health="works"
        version="2.43.0"
        path="/usr/bin/git"
        owner="apt"
        onAdopt={onAdopt}
      />
    )
    expect(managed.textContent).toContain('Found, installed outside MassOrca.')
    expect(buttonWith(managed, 'Manage with MassOrca')).toBeDefined()

    const unknown = await render(
      <GitInstallOutsideBoard
        health="works"
        version="2.43.0"
        path="/usr/bin/git"
        owner="unknown"
        onAdopt={onAdopt}
      />
    )
    expect(buttonWith(unknown, 'Reinstall with MassOrca')).toBeDefined()
  })

  it('outside: a broken Git reads as not working and offers Reinstall', async () => {
    const container = await render(
      <GitInstallOutsideBoard
        health="broken"
        version={null}
        path="/usr/bin/git"
        owner="apt"
        onAdopt={vi.fn()}
      />
    )
    expect(container.textContent).toContain('Found, but not working.')
    expect(buttonWith(container, 'Reinstall with MassOrca')).toBeDefined()
  })
})
