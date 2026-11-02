import { createElement } from 'react'
import { Alert } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamMemory } from './MobileBotTeamMemory'

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))

const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: [
    {
      id: 'bot',
      name: 'Iris',
      job: '',
      agent: 'claude' as const,
      modelMode: 'auto' as const,
      model: null,
      effort: null,
      skills: []
    }
  ]
}

const TASK_LINE = {
  id: 'm1',
  teamId: 'team',
  botId: null,
  text: 'Flyers use the colors from the website.',
  source: { kind: 'task' as const, taskTitle: 'Flyer' }
}
const TOLD_TEAM = {
  id: 'm2',
  teamId: 'team',
  botId: null,
  text: 'Keep the tone friendly.',
  source: { kind: 'person' as const, taskTitle: null }
}
const BOT_LINE = {
  id: 'm3',
  teamId: 'team',
  botId: 'bot',
  text: 'Large photo at the top.',
  source: { kind: 'person' as const, taskTitle: null }
}

function hostWithMemory(listReply: object, deleted = true) {
  return {
    sendRequest: vi.fn(async (method: string) =>
      method === 'botTeams.listMemory'
        ? listReply
        : deleted
          ? { ok: true, result: { deleted: true } }
          : { ok: true, result: { deleted: false } }
    )
  }
}

async function render(client: { sendRequest: unknown }) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamMemory, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The screen only calls sendRequest.
        client: client as never,
        team: TEAM,
        offline: false,
        onBack: vi.fn()
      })
    )
  })
  return renderer
}

const press = async (renderer: ReactTestRenderer, label: string, index = 0) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[index]
  await act(async () => target.props.onPress())
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('MobileBotTeamMemory', () => {
  it("shows the team's memory, with where each line came from", async () => {
    const client = hostWithMemory({
      ok: true,
      result: { memory: [TASK_LINE, TOLD_TEAM, BOT_LINE] }
    })
    const renderer = await render(client)
    await settle()
    const screen = JSON.stringify(renderer.toJSON())
    expect(screen).toContain('What the team remembers')
    expect(screen).toContain(
      'All bots in this team can use this. Delete anything you want them to forget.'
    )
    expect(screen).toContain('Flyers use the colors from the website.')
    expect(screen).toContain('From the Flyer task')
    expect(screen).toContain('Keep the tone friendly.')
    expect(screen).toContain('You told the team')
    expect(screen).not.toContain('Large photo at the top.')
  })

  it("shows one bot's memory when its chip is picked", async () => {
    const client = hostWithMemory({
      ok: true,
      result: { memory: [TASK_LINE, BOT_LINE] }
    })
    const renderer = await render(client)
    await settle()
    await press(renderer, 'Iris')
    const screen = JSON.stringify(renderer.toJSON())
    expect(screen).toContain('What Iris remembers')
    expect(screen).toContain('Only Iris uses this. Delete anything you want Iris to forget.')
    expect(screen).toContain('Large photo at the top.')
    expect(screen).toContain('You told Iris')
    expect(screen).not.toContain('Flyers use the colors from the website.')
  })

  it('deletes a line for good, with no undo', async () => {
    const client = hostWithMemory({ ok: true, result: { memory: [TASK_LINE] } })
    const renderer = await render(client)
    await settle()
    await press(renderer, 'Delete')
    await settle()
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.deleteMemory',
      { memoryId: 'm1' },
      expect.anything()
    )
    const screen = JSON.stringify(renderer.toJSON())
    expect(screen).not.toContain('Flyers use the colors from the website.')
    expect(screen).toContain('Nothing remembered here.')
    expect(screen).not.toContain('Undo')
  })

  it('says the host cannot show memory when it predates it', async () => {
    const client = hostWithMemory({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    const renderer = await render(client)
    await settle()
    const screen = JSON.stringify(renderer.toJSON())
    expect(screen).toContain('This host cannot show what the team remembers yet.')
    expect(screen).not.toContain('Nothing remembered here.')
  })

  it('says nothing is remembered when the team has no lines', async () => {
    const renderer = await render(hostWithMemory({ ok: true, result: { memory: [] } }))
    await settle()
    expect(JSON.stringify(renderer.toJSON())).toContain('Nothing remembered here.')
  })

  it('does not show an empty memory when the host cannot be reached', async () => {
    const client = {
      sendRequest: vi.fn(async () => {
        throw new Error('socket closed')
      })
    }
    const renderer = await render(client)
    await settle()
    const screen = JSON.stringify(renderer.toJSON())
    expect(screen).toContain('Check the connection to this host and try again.')
    expect(screen).not.toContain('Nothing remembered here.')
  })

  it('keeps the line when the host refuses to delete it', async () => {
    vi.mocked(Alert.alert).mockClear()
    const client = hostWithMemory({ ok: true, result: { memory: [TASK_LINE] } }, false)
    const renderer = await render(client)
    await settle()
    await press(renderer, 'Delete')
    await settle()
    expect(Alert.alert).toHaveBeenCalledWith(
      'That did not delete',
      'Check the connection to this host and try again.'
    )
    expect(JSON.stringify(renderer.toJSON())).toContain('Flyers use the colors from the website.')
  })
})
