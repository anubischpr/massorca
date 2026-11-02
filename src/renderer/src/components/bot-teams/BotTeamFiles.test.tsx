/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamFiles = vi.hoisted(() => vi.fn())
const readBotTeamFile = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeamFiles, readBotTeamFile }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const { BotTeamFiles } = await import('./BotTeamFiles')

const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

const LIST = {
  files: [
    { relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' as const },
    { relativePath: 'brand/notes.md', basename: 'notes.md', kind: 'text' as const },
    { relativePath: 'logo.png', basename: 'logo.png', kind: 'binary' as const }
  ],
  truncated: false
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamFiles team={TEAM} />))
  return container
}

const fileButton = (container: ParentNode, name: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(name)
  )
  if (!found) {
    throw new Error(`File ${name} missing`)
  }
  return found
}

beforeEach(() => {
  document.body.innerHTML = ''
  listBotTeamFiles.mockReset()
  listBotTeamFiles.mockResolvedValue(LIST)
  readBotTeamFile.mockReset()
  toastError.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the team files', () => {
  it('lists the files of the team folder under the Files title, with the design’s note', async () => {
    const container = await mount()
    expect(listBotTeamFiles).toHaveBeenCalledWith('t1')
    expect(container.textContent).toContain('Files')
    for (const path of ['flyer.html', 'brand/notes.md', 'logo.png']) {
      expect(container.textContent).toContain(path)
    }
    expect(container.textContent).toContain(
      'One bot or person edits a file at a time. Every change is saved as a version.'
    )
  })

  it('opens a file read-only, and goes back to the list', async () => {
    readBotTeamFile.mockResolvedValue({ content: '<p>Summer</p>', truncated: false })
    const container = await mount()

    await act(async () => fileButton(container, 'flyer.html').click())

    expect(readBotTeamFile).toHaveBeenCalledWith('t1', 'flyer.html')
    expect(container.textContent).toContain('<p>Summer</p>')
    expect(container.querySelector('textarea, input')).toBeNull()

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Back to files"]')?.click()
    )
    expect(container.textContent).toContain('brand/notes.md')
  })

  it('does not open a file it cannot show as text', async () => {
    const container = await mount()
    expect(fileButton(container, 'logo.png').disabled).toBe(true)
  })

  it('says so when the team has no files yet', async () => {
    listBotTeamFiles.mockResolvedValue({ files: [], truncated: false })
    const container = await mount()
    expect(container.textContent).toContain('Nothing here yet.')
  })

  it('shows no list, and no error, on a host that cannot list team files', async () => {
    listBotTeamFiles.mockResolvedValue('unavailable')
    const container = await mount()
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(toastError).not.toHaveBeenCalled()
  })
})
