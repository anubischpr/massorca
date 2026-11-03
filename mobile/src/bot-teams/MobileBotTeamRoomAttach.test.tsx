import { createElement, type ComponentProps } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY } from '../../../src/shared/bot-team-room-attachments'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'

const host = vi.hoisted(() => ({ capabilities: [] as string[] }))

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  Ellipsis: 'Ellipsis',
  FileText: 'FileText',
  X: 'X'
}))
vi.mock('../components/MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('./MobileBotTeamCharacterIcon', () => ({ MobileBotTeamCharacterIcon: () => null }))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: () => null }))
vi.mock('./MobileBotTeamTaskCard', () => ({ MobileBotTeamTaskCard: () => null }))
vi.mock('../hooks/use-mobile-dictation', () => ({
  useMobileDictation: () => ({ isRecording: false, start: vi.fn(), stop: vi.fn() })
}))
vi.mock('../session/MobileNativeChatComposer', () => ({ MobileNativeChatComposer: 'Composer' }))
vi.mock('../session/MobileNativeChatMessage', () => ({ MobileNativeChatMessage: 'ChatMessage' }))
vi.mock('./MobileBotTeamRoomQuestion', () => ({ MobileBotTeamRoomQuestions: () => null }))
vi.mock('./MobileBotTeamRoomScroll', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./MobileBotTeamRoomScroll')>()),
  MobileBotTeamRoomScroll: ({ children }: { children: unknown }) =>
    createElement('Scroll', null, children)
}))
vi.mock('./MobileBotTeamRoomMenu', () => ({ MobileBotTeamRoomMenu: () => null }))
vi.mock('./MobileBotTeamRoomSwitcher', () => ({ MobileBotTeamRoomSwitcher: () => null }))
vi.mock('./MobileBotTeamTypingLine', () => ({ MobileBotTeamTypingLine: () => null }))
vi.mock('./MobileBotTeamProjectQuestion', () => ({ MobileBotTeamProjectQuestion: () => null }))
vi.mock('./MobileBotTeamRequestChoice', () => ({ MobileBotTeamRequestChoice: () => null }))
vi.mock('../transport/runtime-capability-probe', () => ({
  startRuntimeCapabilityProbe: (_client: unknown, onCapabilities: (c: string[]) => void) => {
    onCapabilities(host.capabilities)
    return () => {}
  }
}))
vi.mock('../session/mobile-structured-session-status-feed', () => ({
  mobileStructuredSessionStatusFeed: () => ({
    subscribe: () => () => {},
    getSnapshot: () => new Map()
  })
}))
vi.mock('./mobile-bot-team-attach-pick', () => ({
  pickMobileBotTeamRoomFile: vi.fn(async () => ({
    name: 'notes.txt',
    size: 3,
    base64: async () => 'aGk='
  }))
}))

const BOT = {
  id: 'bot',
  name: 'Iris',
  job: '',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}
const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: [BOT]
}
const TASK_REPLY = { task: null, startError: null }

/** A host with a team folder; every other call answers as an empty room or a sent message. */
function hostWith(room: object, extra: Record<string, unknown> = {}) {
  const sendRequest = vi.fn(async (method: string) => {
    if (method === 'botTeams.listRoom') {
      return { ok: true, result: room }
    }
    if (method === 'files.pathsExist') {
      return { ok: true, result: [{ exists: false }] }
    }
    if (method === 'files.writeBase64') {
      return { ok: true, result: { ok: true } }
    }
    if (method === 'botTeams.postMessage') {
      return { ok: true, result: { ...TASK_REPLY, ...extra } }
    }
    return { ok: true, result: TASK_REPLY }
  })
  return { sendRequest }
}

const EMPTY_ROOM = { tasks: [], messages: [], projects: [], workspaceId: 'ws-1' }

async function render(client: { sendRequest: unknown }): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamRoom, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The room only calls sendRequest and the mocked probes.
        client: client as never,
        team: TEAM,
        teams: [TEAM],
        onBack: vi.fn(),
        onPickTeam: vi.fn(),
        onOpenBots: vi.fn(),
        onOpenTask: vi.fn(),
        onOpenWork: vi.fn(),
        onAddBot: vi.fn(),
        onNewTeam: vi.fn()
      } satisfies ComponentProps<typeof MobileBotTeamRoom>)
    )
  })
  return renderer
}

function composerProps(renderer: ReactTestRenderer) {
  return renderer.root.findByType('Composer' as never).props as {
    layout?: string
    onAttachFile?: () => Promise<void>
    onSend: (text: string) => Promise<boolean>
  }
}

describe('MobileBotTeamRoom attachments', () => {
  it('shows no attach button on a host that does not advertise room attachments', async () => {
    host.capabilities = []
    const renderer = await render(hostWith(EMPTY_ROOM))

    expect(composerProps(renderer).layout).toBe('single-line')
    expect(composerProps(renderer).onAttachFile).toBeUndefined()
  })

  it('attaches a picked file and posts it with the message on a host that advertises it', async () => {
    host.capabilities = [BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY]
    const client = hostWith(EMPTY_ROOM)
    const renderer = await render(client)

    await act(async () => {
      await composerProps(renderer).onAttachFile?.()
    })
    await act(async () => {
      await composerProps(renderer).onSend('mira esto')
    })

    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.postMessage',
      expect.objectContaining({
        text: 'mira esto',
        attachments: [{ path: 'attachments/notes.txt', name: 'notes.txt' }]
      }),
      expect.anything()
    )
  })

  it('sends the picked file alone, with no text, and lets Send through', async () => {
    host.capabilities = [BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY]
    const client = hostWith(EMPTY_ROOM)
    const renderer = await render(client)

    expect(renderer.root.findByType('Composer' as never).props.sendWithoutText).toBeFalsy()
    await act(async () => {
      await composerProps(renderer).onAttachFile?.()
    })
    expect(renderer.root.findByType('Composer' as never).props.sendWithoutText).toBe(true)
    await act(async () => {
      await composerProps(renderer).onSend('')
    })

    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.postMessage',
      expect.objectContaining({
        text: '',
        attachments: [{ path: 'attachments/notes.txt', name: 'notes.txt' }]
      }),
      expect.anything()
    )
  })

  it('retries with the file names when the host still requires text', async () => {
    host.capabilities = [BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY]
    const client = hostWith(EMPTY_ROOM)
    const base = client.sendRequest.getMockImplementation()!
    client.sendRequest.mockImplementation(async (method: string, ...rest: unknown[]) =>
      method === 'botTeams.postMessage' && (rest[0] as { text: string }).text === ''
        ? { ok: false, error: { code: 'invalid_argument', message: 'Missing message text' } }
        : base(method)
    )
    const renderer = await render(client)

    await act(async () => {
      await composerProps(renderer).onAttachFile?.()
    })
    await act(async () => {
      await composerProps(renderer).onSend('')
    })

    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.postMessage',
      expect.objectContaining({ text: 'notes.txt' }),
      expect.anything()
    )
  })

  it('shows the files a message carries under it', async () => {
    host.capabilities = []
    const room = {
      ...EMPTY_ROOM,
      messages: [
        {
          id: 'm1',
          teamId: 'team',
          authorBotId: null,
          text: 'mira',
          attachments: [{ path: 'attachments/plan.pdf', name: 'plan.pdf' }]
        }
      ]
    }
    const renderer = await render(hostWith(room))

    expect(JSON.stringify(renderer.toJSON())).toContain('plan.pdf')
  })
})
