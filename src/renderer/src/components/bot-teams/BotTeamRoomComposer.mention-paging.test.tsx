/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { clearNativeChatDraftCacheForTests } from '../native-chat/native-chat-draft-cache'
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

// Twelve bots fill the @ menu, so one page (ten items) moves the highlight visibly.
const BOTS: BotTeam['bots'] = Array.from({ length: 12 }, (_, index) => ({
  id: `b${index + 1}`,
  name: `Bot ${index + 1}`,
  job: 'Designs flyers',
  agent: 'claude' as const,
  modelMode: 'auto' as const,
  model: null,
  effort: null,
  skills: []
}))
const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: BOTS
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  clearNativeChatDraftCacheForTests()
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <BotTeamRoomComposer
        team={TEAM}
        projects={[]}
        offline={false}
        onSend={vi.fn(async () => true)}
      />
    )
  )
  return container.querySelector<HTMLElement>('[role="combobox"]')!
}

function type(box: HTMLElement, value: string): void {
  act(() => {
    promptEditor(box).commands.setContent(promptTextContent(value), { emitUpdate: true })
    promptEditor(box).commands.focus('end')
  })
}

function press(box: HTMLElement, init: KeyboardEventInit & { keyCode?: number }): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  if (init.keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { value: init.keyCode })
  }
  act(() => {
    box.dispatchEvent(event)
  })
  return event.defaultPrevented
}

const PAGE_DOWN = { key: 'PageDown', keyCode: 34 }
const PAGE_UP = { key: 'PageUp', keyCode: 33 }
const ENTER = { key: 'Enter', keyCode: 13 }

describe('the room @ menu pages with PageUp and PageDown', () => {
  it('moves the highlighted item down by a page of ten', () => {
    const box = mount()
    type(box, '@')
    expect(press(box, PAGE_DOWN)).toBe(true)
    press(box, ENTER)
    expect(promptValue(box)).toBe('@Bot 11 ')
  })

  it('stops on the last item when a page would pass it', () => {
    const box = mount()
    type(box, '@')
    press(box, PAGE_DOWN)
    press(box, PAGE_DOWN)
    press(box, ENTER)
    expect(promptValue(box)).toBe('@Bot 12 ')
  })

  it('moves back up by a page, and stops on the first item when a page would pass it', () => {
    const box = mount()
    type(box, '@')
    press(box, PAGE_DOWN)
    press(box, PAGE_DOWN)
    press(box, PAGE_UP)
    press(box, ENTER)
    expect(promptValue(box)).toBe('@Bot 2 ')

    const top = mount()
    type(top, '@')
    press(top, PAGE_UP)
    press(top, ENTER)
    expect(promptValue(top)).toBe('@Bot 1 ')
  })

  it('leaves the page keys alone while no @ menu is open', () => {
    const box = mount()
    type(box, 'Make the flyer')
    expect(press(box, PAGE_DOWN)).toBe(false)
  })
})
