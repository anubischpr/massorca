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
const listBotTeamLinkableWorkspaces = vi.hoisted(() => vi.fn())
const setBotTeamProjectWorkspace = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  createBotTeamProject,
  listBotTeamRoom,
  listBotTeamLinkableWorkspaces,
  setBotTeamProjectCodeSource,
  setBotTeamProjectWorkspace
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
  setBotTeamProjectWorkspace.mockReset()
  listBotTeamLinkableWorkspaces.mockReset()
  // Why: a host that predates Workspaces projects is the default, so most tests see no section.
  listBotTeamLinkableWorkspaces.mockResolvedValue('unavailable')
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

describe('the Advanced options for a Workspaces project', () => {
  const NEXUS = { key: 'worktree:repo-1::/work/nexus', name: 'NexusCare', kind: 'git' as const }

  // Why: the listing arrives in a promise after mount, so the test lets it resolve first.
  async function settle(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  it('is not offered on a team with Workspaces off, and the host is never asked', async () => {
    const container = await mount(
      <NewBotProjectForm team={team(false)} onCancel={() => {}} onCreated={() => {}} />
    )
    await settle()
    expect(container.textContent).not.toContain('Advanced options')
    expect(listBotTeamLinkableWorkspaces).not.toHaveBeenCalled()
  })

  it('is not shown on a host that predates Workspaces projects', async () => {
    const container = await mount(
      <NewBotProjectForm team={team(true)} onCancel={() => {}} onCreated={() => {}} />
    )
    await settle()
    expect(container.textContent).toContain('Existing repository')
    expect(container.textContent).not.toContain('Advanced options')
  })

  it('is offered under Existing repository once the host lists its workspaces', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS])
    const container = await mount(
      <NewBotProjectForm team={team(true)} onCancel={() => {}} onCreated={() => {}} />
    )
    await settle()
    expect(container.textContent).toContain('Advanced options')
    await act(async () => buttonWith(container, 'Advanced options').click())
    expect(container.textContent).toContain('Workspaces project')
    expect(container.textContent).toContain("Tasks run in the team's own folder.")

    await act(async () => buttonWith(container, 'New folder with git').click())
    expect(container.textContent).not.toContain('Workspaces project')
  })

  it('says which Workspaces project a connected project is linked to, and changes nothing else', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS])
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [{ ...project('repo'), workspace: { key: NEXUS.key, name: NEXUS.name } }]
    })
    const container = await mount(
      <BotTeamProjectBoard
        team={team(true)}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    await settle()
    expect(container.textContent).toContain('Connected to code: Existing repository.')
    expect(container.textContent).toContain('Linked to NexusCare.')
    expect(container.textContent).toContain('Advanced options')
  })

  it('says a connected project is not linked, and offers the choice to link it', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS])
    listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project('repo')] })
    const container = await mount(
      <BotTeamProjectBoard
        team={team(true)}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    await settle()
    expect(container.textContent).toContain('Not linked to a Workspaces project.')
    expect(container.textContent).not.toContain('Linked to NexusCare.')
  })

  it('shows no link line for a folder project', async () => {
    listBotTeamLinkableWorkspaces.mockResolvedValue([NEXUS])
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
    await settle()
    expect(container.textContent).not.toContain('Advanced options')
    expect(container.textContent).not.toContain('Not linked to a Workspaces project.')
  })
})

describe('projects shared between teams', () => {
  const marketing: BotTeam = {
    ...team(false),
    id: 't2',
    name: 'Marketing',
    character: 'circle',
    bots: [
      {
        id: 'b2',
        name: 'Nora',
        job: '',
        agent: 'claude',
        modelMode: 'auto',
        model: null,
        effort: null,
        skills: []
      }
    ]
  }

  async function settle(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  async function fillName(container: HTMLElement, value: string): Promise<void> {
    const name = container.querySelector<HTMLInputElement>('#project-name')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(name, value)
      name?.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('shows the owner team fixed in Teams and creates the project linked to the teams added', async () => {
    createBotTeamProject.mockResolvedValue(project(null))
    const container = await mount(
      <NewBotProjectForm
        team={team(false)}
        allTeams={[team(false), marketing]}
        onCancel={() => {}}
        onCreated={() => {}}
      />
    )
    expect(container.textContent).toContain('Teams')
    expect(container.textContent).toContain('Development, owner')
    expect(container.textContent).toContain("Linked teams can work on this project's tasks.")
    expect(container.querySelector('[aria-label="Remove Development"]')).toBeNull()

    await act(async () => {
      buttonWith(container, 'Add team').dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      )
    })
    const option = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === 'Marketing'
    )
    await act(async () => (option as HTMLElement).click())
    expect(container.textContent).toContain('Marketing')
    await fillName(container, 'NexusCare')
    await act(async () => buttonWith(container, 'Create project').click())

    expect(createBotTeamProject).toHaveBeenCalledWith({
      teamId: 't1',
      name: 'NexusCare',
      goal: '',
      codeSource: null,
      linkedTeamIds: ['t2']
    })
  })

  it('lets a team added by mistake be removed before creating', async () => {
    createBotTeamProject.mockResolvedValue(project(null))
    const container = await mount(
      <NewBotProjectForm
        team={team(false)}
        allTeams={[team(false), marketing]}
        onCancel={() => {}}
        onCreated={() => {}}
      />
    )
    await act(async () => {
      buttonWith(container, 'Add team').dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      )
    })
    const option = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === 'Marketing'
    )
    await act(async () => (option as HTMLElement).click())
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Remove Marketing"]')?.click()
    )
    await fillName(container, 'NexusCare')
    await act(async () => buttonWith(container, 'Create project').click())
    expect(createBotTeamProject.mock.calls[0][0]).not.toHaveProperty('linkedTeamIds')
  })

  it('shows, on a project another team owns, who owns it and the team of each task', async () => {
    const shared = {
      ...project(null),
      teamId: 't2',
      linkedTeamIds: ['t1']
    }
    listBotTeamRoom.mockResolvedValue({
      tasks: [
        {
          id: 'k1',
          teamId: 't1',
          title: 'Booking page',
          prompt: '',
          ownerBotId: 'b1',
          sessionId: null,
          projectId: 'p1'
        }
      ],
      messages: [],
      projects: [shared],
      projectTasks: [
        {
          id: 'k2',
          teamId: 't2',
          title: 'Launch email',
          prompt: '',
          ownerBotId: 'b2',
          sessionId: null,
          projectId: 'p1'
        }
      ]
    })
    const container = await mount(
      <BotTeamProjectBoard
        team={team(false)}
        allTeams={[team(false), marketing]}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    await settle()
    expect(container.textContent).toContain('Owner:')
    expect(container.textContent).toContain('Marketing')
    expect(container.textContent).toContain('Booking page')
    expect(container.textContent).toContain('Launch email')
    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Launch email')
    )
    // The card names the team that made the task, and the owner bot from that team.
    expect(card?.textContent).toContain('Marketing')
    expect(card?.textContent).toContain('Nora')
  })

  it('does not name a team on the cards of a project that is not shared', async () => {
    listBotTeamRoom.mockResolvedValue({
      tasks: [
        {
          id: 'k1',
          teamId: 't1',
          title: 'Booking page',
          prompt: '',
          ownerBotId: 'b1',
          sessionId: null,
          projectId: 'p1'
        }
      ],
      messages: [],
      projects: [{ ...project(null), linkedTeamIds: [] }]
    })
    const container = await mount(
      <BotTeamProjectBoard
        team={team(false)}
        allTeams={[team(false), marketing]}
        projectId="p1"
        onBack={() => {}}
        onTab={() => {}}
        onOpenTask={() => {}}
      />
    )
    await settle()
    expect(container.textContent).not.toContain('Owner:')
    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Booking page')
    )
    expect(card?.textContent).not.toContain('Development')
  })
})
