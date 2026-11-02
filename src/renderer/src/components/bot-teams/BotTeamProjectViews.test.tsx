/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const createBotTeamProject = vi.hoisted(() => vi.fn())
const listBotTeamRoom = vi.hoisted(() => vi.fn())
const setBotTeamProjectCodeSource = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  createBotTeamProject,
  listBotTeamRoom,
  setBotTeamProjectCodeSource
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name]))
}))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('./use-bot-team-task-status', () => ({ useBotTeamSessionStatuses: () => new Map() }))

const { BotTeamProjectBoard, NewBotProjectForm } = await import('./BotTeamProjectViews')

function team(workspacesEnabled: boolean): BotTeam {
  return {
    id: 't1',
    name: 'Development',
    purpose: '',
    character: 'square',
    workspacesEnabled,
    accessMode: 'default',
    bots: []
  }
}

function project(codeSource: BotTeamProject['codeSource']): BotTeamProject {
  return {
    id: 'p1',
    teamId: 't1',
    name: 'Website',
    goal: 'Faster',
    codeSource,
    brief: { requirements: [], constraints: [], decisions: [] },
    briefUpdatedAt: null
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

const buttonWith = (container: ParentNode, text: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text
  )
  if (!found) {
    throw new Error(`Button ${text} missing`)
  }
  return found
}

beforeEach(() => {
  document.body.innerHTML = ''
  createBotTeamProject.mockReset()
  setBotTeamProjectCodeSource.mockReset()
  toastError.mockReset()
  listBotTeamRoom.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the new project form', () => {
  it('asks for a source only on a team with Workspaces on, and creates the project with it', async () => {
    createBotTeamProject.mockResolvedValue(project('repo'))
    const onCreated = vi.fn()
    const container = await mount(
      <NewBotProjectForm team={team(true)} onCancel={() => {}} onCreated={onCreated} />
    )
    expect(container.textContent).toContain('Source')
    expect(container.textContent).toContain('Existing repository')
    expect(container.textContent).toContain(
      'Connect code that already lives in one of your accounts.'
    )

    await act(async () => buttonWith(container, 'New folder with git').click())
    expect(container.textContent).toContain('Start a new folder and set it up as a git project.')

    const name = container.querySelector<HTMLInputElement>('#project-name')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(name, 'Website')
      name?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => buttonWith(container, 'Create project').click())

    expect(createBotTeamProject).toHaveBeenCalledWith({
      teamId: 't1',
      name: 'Website',
      goal: '',
      codeSource: 'folder'
    })
  })

  it('shows no source on a team without Workspaces, and creates the project unconnected', async () => {
    createBotTeamProject.mockResolvedValue(project(null))
    const container = await mount(
      <NewBotProjectForm team={team(false)} onCancel={() => {}} onCreated={() => {}} />
    )
    expect(container.textContent).not.toContain('Existing repository')
    const name = container.querySelector<HTMLInputElement>('#project-name')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(name, 'Flyer')
      name?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => buttonWith(container, 'Create project').click())
    expect(createBotTeamProject).toHaveBeenCalledWith({
      teamId: 't1',
      name: 'Flyer',
      goal: '',
      codeSource: null
    })
  })

  it('says so when an older host created the project without the source', async () => {
    createBotTeamProject.mockResolvedValue(project(null))
    const onCreated = vi.fn()
    const container = await mount(
      <NewBotProjectForm team={team(true)} onCancel={() => {}} onCreated={onCreated} />
    )
    const name = container.querySelector<HTMLInputElement>('#project-name')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(name, 'Website')
      name?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => buttonWith(container, 'Create project').click())
    expect(onCreated).toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('This host cannot connect projects to code yet.')
  })
})

describe('the project board and connecting to code', () => {
  it('offers Connect to code on a team with Workspaces, and shows the connection after', async () => {
    listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project(null)] })
    setBotTeamProjectCodeSource.mockResolvedValue(project('repo'))
    const container = await mount(
      <BotTeamProjectBoard
        team={team(true)}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    expect(container.textContent).toContain('Not connected to code')
    expect(container.textContent).toContain("Lets this project's tasks work on its code.")
    expect(container.textContent).not.toContain('Existing repository')

    await act(async () => buttonWith(container, 'Connect to code').click())
    expect(container.textContent).toContain('Existing repository')
    // The host answers the list that follows the connection with the project connected.
    listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project('repo')] })
    await act(async () => buttonWith(container, 'Connect').click())

    expect(setBotTeamProjectCodeSource).toHaveBeenCalledWith('p1', 'repo')
    expect(container.textContent).toContain('Connected to code: Existing repository.')
    expect(container.textContent).not.toContain('Not connected to code')
  })

  it('does not offer it on a team without Workspaces', async () => {
    listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project(null)] })
    const container = await mount(
      <BotTeamProjectBoard
        team={team(false)}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    expect(container.textContent).toContain('Goal: Faster')
    expect(container.textContent).not.toContain('Connect to code')
  })

  it('shows a connected project’s source', async () => {
    listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project('folder')] })
    const container = await mount(
      <BotTeamProjectBoard
        team={team(true)}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    expect(container.textContent).toContain('Connected to code: New folder with git.')
  })

  it('tells the person when the host is too old to connect, and changes nothing', async () => {
    listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project(null)] })
    setBotTeamProjectCodeSource.mockResolvedValue('unavailable')
    const container = await mount(
      <BotTeamProjectBoard
        team={team(true)}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    await act(async () => buttonWith(container, 'Connect to code').click())
    await act(async () => buttonWith(container, 'Connect').click())
    expect(toastError).toHaveBeenCalledWith('This host cannot connect projects to code yet.')
    expect(container.textContent).toContain('Not connected to code')
  })
})
