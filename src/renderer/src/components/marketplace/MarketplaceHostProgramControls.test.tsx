// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceHostProgramStatus } from '../../../../shared/rpc-contract/marketplace-host-program-params'
import type { HostProgramPhase, MarketplaceHostProgram } from './use-marketplace-host-program'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('./marketplace-clipboard', () => ({ copyMarketplaceText: vi.fn() }))

const { MarketplaceHostProgramInstall, MarketplaceHostProgramUninstall } =
  await import('./MarketplaceHostProgramControls')
const { copyMarketplaceText } = await import('./marketplace-clipboard')

let root: Root | null = null
let container: HTMLDivElement | null = null

function program(
  status: MarketplaceHostProgramStatus | null,
  phase: HostProgramPhase = { kind: 'idle' },
  id: MarketplaceHostProgram['program'] = 'codex',
  notice: string | null = null
): MarketplaceHostProgram {
  return {
    program: id,
    hostKey: 'local',
    status,
    phase,
    notice,
    run: vi.fn(async () => {}),
    dismiss: vi.fn()
  }
}

async function render(element: React.ReactElement): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root?.render(element))
  return container
}

function button(text: string, scope: ParentNode = document): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (!found) {
    throw new Error(`Missing button ${text}`)
  }
  return found
}

const MISSING: MarketplaceHostProgramStatus = {
  ok: true,
  installed: false,
  canInstall: true,
  canUninstall: false,
  installCommand: 'npm install -g @openai/codex'
}
const INSTALLED: MarketplaceHostProgramStatus = {
  ok: true,
  installed: true,
  version: 'codex 0.9',
  method: 'npm',
  canInstall: false,
  canUninstall: true,
  uninstallCommand: 'npm uninstall -g @openai/codex'
}

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  container?.remove()
  container = null
  vi.clearAllMocks()
})

describe('Install', () => {
  it('shows Install with the command it will run and starts the install on click', async () => {
    const handle = program(MISSING)
    const page = await render(<MarketplaceHostProgramInstall program={handle} host="WSL: Ubuntu" />)
    expect(page.textContent).toContain('MassOrca will run: npm install -g @openai/codex')
    await act(async () => button('Install', page).click())
    expect(handle.run).toHaveBeenCalledWith('install')
  })

  it('shows progress and disables Install while it runs', async () => {
    const handle = program(MISSING, { kind: 'running', action: 'install' })
    const page = await render(<MarketplaceHostProgramInstall program={handle} host="VPS" />)
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Installing Codex on VPS')
    expect(button('Install', page).disabled).toBe(true)
  })

  it('hides itself once the program is on the host', async () => {
    const page = await render(
      <MarketplaceHostProgramInstall program={program(INSTALLED)} host="VPS" />
    )
    expect(page.textContent).toBe('')
  })

  it('says it is checking while the host answers', async () => {
    const page = await render(<MarketplaceHostProgramInstall program={program(null)} host="VPS" />)
    expect(page.textContent).toContain('Checking Codex on VPS')
  })

  it('offers the exact command to copy when MassOrca has no install for the host', async () => {
    const handle = program({
      ok: true,
      installed: false,
      canInstall: false,
      canUninstall: false,
      installCommand: 'npm install -g gentle-pi',
      note: 'MassOrca has no install for Gentle Shell that fits this host.'
    })
    const page = await render(<MarketplaceHostProgramInstall program={handle} host="box" />)
    expect(button('Install', page).disabled).toBe(true)
    expect(page.textContent).toContain('no install for Gentle Shell')
    await act(async () =>
      page.querySelector<HTMLButtonElement>('button[aria-label="Copy command"]')?.click()
    )
    expect(copyMarketplaceText).toHaveBeenCalledWith('npm install -g gentle-pi')
  })

  it('reports needs-admin with the command, and a plain failure with the last line printed', async () => {
    const admin = program(MISSING, {
      kind: 'failed',
      action: 'install',
      failure: { ok: false, reason: 'needs-admin', command: 'sudo apt-get install -y git' }
    })
    const page = await render(<MarketplaceHostProgramInstall program={admin} host="box" />)
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'needs an administrator on box'
    )
    expect(page.textContent).toContain('sudo apt-get install -y git')
    await act(async () => root?.unmount())
    container?.remove()
    const failed = program(MISSING, {
      kind: 'failed',
      action: 'install',
      failure: { ok: false, reason: 'failed', message: 'EACCES permission denied' }
    })
    const next = await render(<MarketplaceHostProgramInstall program={failed} host="box" />)
    expect(next.querySelector('[role="alert"]')?.textContent).toContain(
      'It did not finish: EACCES permission denied'
    )
  })
})

describe('Uninstall', () => {
  it('asks first, names what stays, and only then runs the uninstall', async () => {
    const handle = program(INSTALLED)
    const page = await render(
      <MarketplaceHostProgramUninstall program={handle} host="This computer" />
    )
    expect(page.textContent).toContain('installed with npm')
    await act(async () => button('Uninstall', page).click())
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Uninstall Codex from This computer?')
    expect(dialog?.textContent).toContain('Your data in ~/.codex stays.')
    expect(dialog?.textContent).toContain('npm uninstall -g @openai/codex')
    expect(handle.run).not.toHaveBeenCalled()
    await act(async () => button('Uninstall', dialog as HTMLElement).click())
    expect(handle.run).toHaveBeenCalledWith('uninstall')
  })

  it('warns that other programs may need Node.js', async () => {
    const handle = program(
      { ...INSTALLED, uninstallCommand: 'winget uninstall --id OpenJS.NodeJS.LTS' },
      undefined,
      'node'
    )
    const page = await render(<MarketplaceHostProgramUninstall program={handle} host="PC" />)
    await act(async () => button('Uninstall', page).click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'Other programs on PC may need Node.js to run.'
    )
  })

  it('never offers Uninstall for an install it cannot remove, and says why', async () => {
    const handle = program({
      ...INSTALLED,
      method: 'unknown',
      canUninstall: false,
      uninstallCommand: undefined,
      note: 'MassOrca cannot tell how Codex at /opt/codex was installed.'
    })
    const page = await render(<MarketplaceHostProgramUninstall program={handle} host="PC" />)
    expect(button('Uninstall', page).disabled).toBe(true)
    expect(page.textContent).toContain('cannot tell how Codex at /opt/codex was installed')
  })

  it('shows progress, a failure, and the not-installed note', async () => {
    const running = program(INSTALLED, { kind: 'running', action: 'uninstall' })
    const page = await render(<MarketplaceHostProgramUninstall program={running} host="PC" />)
    expect(page.querySelector('[role="status"]')?.textContent).toContain(
      'Uninstalling Codex from PC'
    )
    await act(async () => root?.unmount())
    container?.remove()
    const gone = await render(
      <MarketplaceHostProgramUninstall program={program(MISSING)} host="PC" />
    )
    expect(gone.querySelector('[data-marketplace-note="uninstall"]')?.textContent).toContain(
      'Codex is not installed on PC.'
    )
  })

  it('reinstalls through the managed method only after a confirm that says what may be removed', async () => {
    const standalone: MarketplaceHostProgramStatus = {
      ...INSTALLED,
      method: 'script',
      canUninstall: false,
      uninstallCommand: undefined,
      canReinstall: true,
      reinstallCommand: 'npm install -g @openai/codex',
      note: 'Codex at /opt/codex is not in the vendor install folder.'
    }
    const handle = program(standalone)
    const page = await render(<MarketplaceHostProgramUninstall program={handle} host="PC" />)
    expect(button('Uninstall', page).disabled).toBe(true)
    await act(async () => button('Reinstall with MassOrca', page).click())
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Reinstall Codex on PC?')
    expect(dialog.textContent).toContain('only when it sits in the vendor installer folder')
    expect(dialog.textContent).toContain('npm install -g @openai/codex')
    expect(handle.run).not.toHaveBeenCalled()
    await act(async () => button('Reinstall', dialog).click())
    expect(handle.run).toHaveBeenCalledWith('reinstall')
  })

  it('offers no Reinstall unless the host says the copy can be moved', async () => {
    const page = await render(
      <MarketplaceHostProgramUninstall program={program(INSTALLED)} host="PC" />
    )
    expect(
      [...page.querySelectorAll('button')].some((b) => b.textContent?.includes('Reinstall'))
    ).toBe(false)
  })

  it('names the removed path after an uninstall, and shows the reinstall progress', async () => {
    const gone = program(
      MISSING,
      { kind: 'idle' },
      'codex',
      'Removed /home/u/.local/bin/codex. Your data stays.'
    )
    const page = await render(<MarketplaceHostProgramUninstall program={gone} host="PC" />)
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Removed /home/u')
    await act(async () => root?.unmount())
    container?.remove()
    const running = program(
      { ...INSTALLED, canReinstall: true },
      { kind: 'running', action: 'reinstall' }
    )
    const busy = await render(<MarketplaceHostProgramUninstall program={running} host="PC" />)
    expect(busy.querySelector('[role="status"]')?.textContent).toContain('Reinstalling Codex on PC')
  })
})
