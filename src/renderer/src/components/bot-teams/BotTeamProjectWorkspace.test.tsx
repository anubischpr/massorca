/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BotTeamLinkableWorkspace,
  BotTeamProject
} from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamLinkableWorkspaces = vi.hoisted(() => vi.fn())
const setBotTeamProjectWorkspace = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamLinkableWorkspaces,
  setBotTeamProjectWorkspace
}))
vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, options?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name]))
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const { ProjectWorkspaceLink, WorkspacesAdvancedOptions } =
  await import('./BotTeamProjectWorkspace')

const NEXUS: BotTeamLinkableWorkspace = {
  key: 'repo:repo-1',
  name: 'NexusCare',
  kind: 'git'
}
const NOTES: BotTeamLinkableWorkspace = { key: 'group:group-1', name: 'Notes', kind: 'folder' }

function project(overrides: Partial<BotTeamProject> = {}): BotTeamProject {
  return {
    id: 'p1',
    teamId: 't1',
    name: 'Website',
    goal: '',
    codeSource: 'repo',
    brief: { requirements: [], constraints: [], decisions: [] },
    briefUpdatedAt: null,
    workspace: null,
    ...overrides
  }
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(element: React.JSX.Element): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(element))
  return container
}

function buttonWith(container: ParentNode, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text
  )
  if (!found) {
    throw new Error(`Button ${text} missing`)
  }
  return found
}

/** Opens the Workspaces project picker and chooses an option with a mouse, as the Select expects. */
async function choose(container: HTMLElement, optionName: string): Promise<void> {
  const trigger = container.querySelector<HTMLElement>('[aria-label="Workspaces project"]')
  await act(async () => {
    trigger?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
  })
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (entry) => entry.textContent?.trim() === optionName
  )
  if (!option) {
    throw new Error(`Option ${optionName} missing`)
  }
  await act(async () => {
    option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
  })
}

beforeEach(() => {
  document.body.innerHTML = ''
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  listBotTeamLinkableWorkspaces.mockReset()
  setBotTeamProjectWorkspace.mockReset()
  toastError.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('WorkspacesAdvancedOptions', () => {
  it('renders nothing while the host has not listed its workspaces, or cannot list them', async () => {
    const loading = await mount(
      <WorkspacesAdvancedOptions listing={null} value={null} onChange={() => {}} />
    )
    expect(loading.textContent).toBe('')

    const older = await mount(
      <WorkspacesAdvancedOptions listing="unavailable" value={null} onChange={() => {}} />
    )
    expect(older.textContent).toBe('')
  })

  it('offers None and every listed workspace, and links the one chosen by key and name', async () => {
    const onChange = vi.fn()
    const container = await mount(
      <WorkspacesAdvancedOptions listing={[NEXUS, NOTES]} value={null} onChange={onChange} />
    )
    await act(async () => buttonWith(container, 'Advanced options').click())
    expect(container.textContent).toContain("Tasks run in the team's own folder.")

    await choose(container, 'NexusCare')
    expect(onChange).toHaveBeenCalledWith({ key: NEXUS.key, name: 'NexusCare' })
  })

  it('clears the link when None is chosen', async () => {
    const onChange = vi.fn()
    const container = await mount(
      <WorkspacesAdvancedOptions
        listing={[NEXUS, NOTES]}
        value={{ key: NOTES.key, name: 'Notes' }}
        onChange={onChange}
      />
    )
    await act(async () => buttonWith(container, 'Advanced options').click())
    expect(container.textContent).toContain('Tasks of this project run in Notes.')

    await choose(container, 'None')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows each project with its icon, and the default folder icon when it has none', async () => {
    const container = await mount(
      <WorkspacesAdvancedOptions
        listing={[
          { ...NEXUS, icon: { type: 'emoji', emoji: '🩺' } },
          {
            key: 'repo:repo-2',
            name: 'Shop',
            kind: 'git',
            icon: { type: 'image', src: 'https://github.com/shop.png?size=64', source: 'github' }
          },
          NOTES
        ]}
        value={null}
        onChange={() => {}}
      />
    )
    await act(async () => buttonWith(container, 'Advanced options').click())
    await act(async () => {
      container
        .querySelector<HTMLElement>('[aria-label="Workspaces project"]')
        ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    })
    const row = (name: string): Element | undefined =>
      [...document.querySelectorAll('[role="option"]')].find((entry) =>
        entry.textContent?.trim().endsWith(name)
      )

    expect(row('NexusCare')?.textContent).toContain('🩺')
    expect(row('Shop')?.querySelector('img')?.getAttribute('src')).toBe(
      'https://github.com/shop.png?size=64'
    )
    expect(row('Notes')?.querySelector('svg')).not.toBeNull()
    expect(row('Notes')?.querySelector('img')).toBeNull()
  })

  it('keeps a linked workspace the host no longer lists, under its stored name', async () => {
    const container = await mount(
      <WorkspacesAdvancedOptions
        listing={[NEXUS]}
        value={{ key: 'repo:gone', name: 'Old notes' }}
        onChange={() => {}}
      />
    )
    await act(async () => buttonWith(container, 'Advanced options').click())
    await act(async () => {
      container
        .querySelector<HTMLElement>('[aria-label="Workspaces project"]')
        ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    })
    const names = [...document.querySelectorAll('[role="option"]')].map((entry) =>
      entry.textContent?.trim()
    )
    expect(names).toEqual(expect.arrayContaining(['None', 'NexusCare', 'Old notes']))
  })
})

describe('ProjectWorkspaceLink', () => {
  it('says the project is linked, and changes the link on the host', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS, NOTES])
    setBotTeamProjectWorkspace.mockResolvedValue(
      project({ workspace: { key: NOTES.key, name: 'Notes' } })
    )
    const onChanged = vi.fn()
    const container = await mount(
      <ProjectWorkspaceLink
        team={{ id: 't1' }}
        project={project({ workspace: { key: NEXUS.key, name: 'NexusCare' } })}
        onChanged={onChanged}
      />
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('Linked to NexusCare.')

    await act(async () => buttonWith(container, 'Advanced options').click())
    await choose(container, 'Notes')
    expect(setBotTeamProjectWorkspace).toHaveBeenCalledWith('p1', NOTES.key)
    expect(onChanged).toHaveBeenCalled()
  })

  it('says the project is not linked when it has no workspace', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS])
    const container = await mount(
      <ProjectWorkspaceLink team={{ id: 't1' }} project={project()} onChanged={() => {}} />
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.textContent).toContain('Not linked to a Workspaces project.')
  })

  it('shows the host’s refusal and keeps the project as it was', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS])
    setBotTeamProjectWorkspace.mockRejectedValue(
      new Error('Turn on Workspaces for Marketing to link a Workspaces project.')
    )
    const onChanged = vi.fn()
    const container = await mount(
      <ProjectWorkspaceLink team={{ id: 't1' }} project={project()} onChanged={onChanged} />
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await act(async () => buttonWith(container, 'Advanced options').click())
    await choose(container, 'NexusCare')

    expect(toastError).toHaveBeenCalledWith(
      'Turn on Workspaces for Marketing to link a Workspaces project.'
    )
    expect(onChanged).not.toHaveBeenCalled()
  })
})
