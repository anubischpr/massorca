import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamNewProject } from './MobileBotTeamNewProject'
import { MobileBotTeamWorkspaceLink } from './MobileBotTeamProjectWorkspace'
import type { RpcClient } from '../transport/rpc-client'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight'
}))

const NEXUS = { key: 'worktree:repo-1::/work/nexus', name: 'NexusCare', kind: 'git' }
const PROJECT = {
  id: 'project_1',
  teamId: 'team_1',
  name: 'Launch',
  goal: 'Ship the flyer',
  codeSource: 'repo' as const,
  brief: { requirements: [], constraints: [], decisions: [] },
  briefUpdatedAt: null
}
const TEAM = {
  id: 'team_1',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: true,
  accessMode: 'full-access' as const,
  bots: []
}

type Answer = { ok: boolean; result?: unknown; error?: unknown }

/** A host that answers each method by name; a method it does not list is one an older host lacks. */
function hostAnswering(answers: Record<string, Answer>) {
  const sendRequest = vi.fn(async (method: string) => ({
    id: '1',
    _meta: { runtimeId: 'r' },
    ...(answers[method] ?? {
      ok: false,
      error: { code: 'method_not_found', message: `Unknown method ${method}` }
    })
  }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the screens call only sendRequest.
  return { sendRequest, client: { sendRequest } as never as RpcClient }
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** The Pressable that holds a piece of text, so a test can press it as a person would. */
function pressableWithText(renderer: ReactTestRenderer, text: string) {
  const label = renderer.root.findAll(
    (node) => node.type === 'Text' && node.children.join('') === text
  )[0]
  let current = label
  while (current && current.type !== 'Pressable') {
    current = current.parent as typeof label
  }
  if (!current) {
    throw new Error(`No pressable with ${text}`)
  }
  return current
}

function hasText(renderer: ReactTestRenderer, text: string): boolean {
  return (
    renderer.root.findAll((node) => node.type === 'Text' && node.children.join('') === text)
      .length > 0
  )
}

async function renderLink(
  client: RpcClient,
  onChanged = vi.fn()
): Promise<{ renderer: ReactTestRenderer; onChanged: ReturnType<typeof vi.fn> }> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamWorkspaceLink, {
        client,
        teamId: 'team_1',
        project: PROJECT,
        offline: false,
        onChanged
      })
    )
  })
  await settle()
  return { renderer, onChanged }
}

describe('MobileBotTeamWorkspaceLink', () => {
  it('is not offered on a host that cannot list workspaces', async () => {
    const { client } = hostAnswering({})
    const { renderer } = await renderLink(client)
    expect(hasText(renderer, 'Advanced options')).toBe(false)
  })

  it('is closed until opened, then lists None and each workspace', async () => {
    const { client } = hostAnswering({
      'botTeams.listLinkableWorkspaces': { ok: true, result: { workspaces: [NEXUS] } }
    })
    const { renderer } = await renderLink(client)
    expect(hasText(renderer, 'Advanced options')).toBe(true)
    expect(hasText(renderer, 'NexusCare')).toBe(false)

    await act(async () => pressableWithText(renderer, 'Advanced options').props.onPress())
    expect(hasText(renderer, 'None')).toBe(true)
    expect(hasText(renderer, 'NexusCare')).toBe(true)
  })

  it('links the project to the workspace chosen, and says so once saved', async () => {
    const { client, sendRequest } = hostAnswering({
      'botTeams.listLinkableWorkspaces': { ok: true, result: { workspaces: [NEXUS] } },
      'botTeams.setProjectWorkspace': {
        ok: true,
        result: { project: { ...PROJECT, workspace: { key: NEXUS.key, name: NEXUS.name } } }
      }
    })
    const { renderer, onChanged } = await renderLink(client)
    await act(async () => pressableWithText(renderer, 'Advanced options').props.onPress())
    await act(async () => pressableWithText(renderer, 'NexusCare').props.onPress())
    await settle()

    expect(sendRequest).toHaveBeenCalledWith(
      'botTeams.setProjectWorkspace',
      { projectId: 'project_1', workspaceKey: NEXUS.key },
      expect.anything()
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('shows the host’s refusal in its own words, and does not report a change', async () => {
    const { client } = hostAnswering({
      'botTeams.listLinkableWorkspaces': { ok: true, result: { workspaces: [NEXUS] } },
      'botTeams.setProjectWorkspace': {
        ok: false,
        error: {
          code: 'invalid_params',
          message: 'Turn on Workspaces for Marketing to link a Workspaces project.'
        }
      }
    })
    const { renderer, onChanged } = await renderLink(client)
    await act(async () => pressableWithText(renderer, 'Advanced options').props.onPress())
    await act(async () => pressableWithText(renderer, 'NexusCare').props.onPress())
    await settle()

    expect(
      hasText(renderer, 'Turn on Workspaces for Marketing to link a Workspaces project.')
    ).toBe(true)
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('MobileBotTeamNewProject', () => {
  type Props = ComponentProps<typeof MobileBotTeamNewProject>

  async function renderNewProject(
    team: Props['team'],
    client: RpcClient
  ): Promise<ReactTestRenderer> {
    let renderer!: ReactTestRenderer
    await act(async () => {
      renderer = create(
        createElement(MobileBotTeamNewProject, {
          client,
          team,
          onCancel: vi.fn(),
          onCreated: vi.fn()
        })
      )
    })
    await settle()
    return renderer
  }

  it('offers the Workspaces project choice under Existing repository on a team with Workspaces on', async () => {
    const { client } = hostAnswering({
      'botTeams.listLinkableWorkspaces': { ok: true, result: { workspaces: [NEXUS] } }
    })
    const renderer = await renderNewProject(TEAM, client)
    expect(hasText(renderer, 'Advanced options')).toBe(true)
  })

  it('shows no Workspaces project choice on a team with Workspaces off, and never asks the host', async () => {
    const { client, sendRequest } = hostAnswering({
      'botTeams.listLinkableWorkspaces': { ok: true, result: { workspaces: [NEXUS] } }
    })
    const renderer = await renderNewProject({ ...TEAM, workspacesEnabled: false }, client)
    expect(hasText(renderer, 'Advanced options')).toBe(false)
    expect(sendRequest).not.toHaveBeenCalledWith(
      'botTeams.listLinkableWorkspaces',
      expect.anything(),
      expect.anything()
    )
  })
})
