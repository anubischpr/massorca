/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { composerDraftScopeKey } from '@/lib/composer-draft'
import {
  clearNativeChatDraftCacheForTests,
  readNativeChatDraftCache
} from '../native-chat/native-chat-draft-cache'
import { promptTextContent } from '../native-chat/native-chat-prompt-document-text'
import { promptEditor, promptValue } from '../native-chat/native-chat-prompt-editor.test-support'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('./use-bot-team-files', () => ({ useBotTeamFilePaths: () => [] }))
vi.mock('./open-bot-team-room-sessions', () => ({ openBotTeamRoomSessions: vi.fn() }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))

const { BotTeamRoomComposer } = await import('./BotTeamRoomComposer')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [{ ...BOT, id: 'b1', name: 'Iris', job: 'Designs flyers', agent: 'claude' }]
}
const ROOM_KEY = composerDraftScopeKey('room:t1')

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  clearNativeChatDraftCacheForTests()
})

function mount(onSend = vi.fn(async () => true)) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<BotTeamRoomComposer team={TEAM} offline={false} onSend={onSend} />))
  const box = container.querySelector<HTMLElement>('[role="combobox"]')!
  return { onSend, box, root }
}

function type(box: HTMLElement, value: string): void {
  act(() => {
    promptEditor(box).commands.setContent(promptTextContent(value), { emitUpdate: true })
  })
}

describe('BotTeamRoomComposer draft', () => {
  it('keeps unsent text when the room closes and shows it when the room opens again', () => {
    const first = mount()
    type(first.box, 'Draft the launch post')
    expect(readNativeChatDraftCache(ROOM_KEY)).toBe('Draft the launch post')
    act(() => first.root.unmount())
    mounted.splice(0)

    const second = mount()
    expect(promptValue(second.box)).toBe('Draft the launch post')
  })

  it('clears the draft once the message is sent', async () => {
    const { box, onSend } = mount()
    type(box, 'Ship it')
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(enter, 'keyCode', { value: 13 })
    await act(async () => {
      box.dispatchEvent(enter)
    })
    expect(onSend).toHaveBeenCalledWith('Ship it', [])
    expect(readNativeChatDraftCache(ROOM_KEY)).toBe('')
  })
})
