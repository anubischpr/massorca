/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

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

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(onSend = vi.fn(async () => true)) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<BotTeamRoomComposer team={TEAM} offline={false} onSend={onSend} />))
  const box = container.querySelector('textarea')!
  return { onSend, box }
}

function type(box: HTMLTextAreaElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(box, value)
    box.setSelectionRange(value.length, value.length)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function press(box: HTMLTextAreaElement, init: KeyboardEventInit & { keyCode?: number }): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  if (init.keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { value: init.keyCode })
  }
  act(() => {
    box.dispatchEvent(event)
  })
  return event.defaultPrevented
}

describe('the room composer keys', () => {
  it('sends on Enter, as the Workspaces composer does', async () => {
    const { onSend, box } = mount()
    type(box, 'Make the flyer')
    expect(press(box, { key: 'Enter', keyCode: 13 })).toBe(true)
    await act(async () => {})
    expect(onSend).toHaveBeenCalledWith('Make the flyer')
  })

  it('clears the box at once, before the host answers', async () => {
    let answer: (sent: boolean) => void = () => {}
    const { box } = mount(vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve))))
    type(box, 'En qué nos quedamos?')
    press(box, { key: 'Enter', keyCode: 13 })
    expect(box.value).toBe('')
    await act(async () => answer(true))
    expect(box.value).toBe('')
  })

  it('puts the text back when the send fails', async () => {
    const { box } = mount(vi.fn(async () => false))
    type(box, 'Make the flyer')
    press(box, { key: 'Enter', keyCode: 13 })
    await act(async () => {})
    expect(box.value).toBe('Make the flyer')
  })

  it('keeps Shift+Enter as a new line', () => {
    const { onSend, box } = mount()
    type(box, 'Line one')
    expect(press(box, { key: 'Enter', keyCode: 13, shiftKey: true })).toBe(false)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('picks the open @ item on Enter instead of sending', () => {
    const { onSend, box } = mount()
    type(box, '@Ir')
    press(box, { key: 'Enter', keyCode: 13 })
    expect(onSend).not.toHaveBeenCalled()
    expect(box.value).toBe('@Iris ')
  })

  it('does not send the Enter that confirms an IME composition', () => {
    const { onSend, box } = mount()
    type(box, 'こんにちは')
    press(box, { key: 'Enter', keyCode: 229, isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send an empty message', () => {
    const { onSend, box } = mount()
    press(box, { key: 'Enter', keyCode: 13 })
    expect(onSend).not.toHaveBeenCalled()
  })
})
