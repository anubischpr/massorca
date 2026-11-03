/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
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
  const box = container.querySelector<HTMLElement>('[role="combobox"]')!
  return { onSend, box, container }
}

/** Types a whole line with the caret at its end, as the person would. */
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

function docJson(box: HTMLElement): string {
  return JSON.stringify(promptEditor(box).getJSON())
}

describe('the room composer keys', () => {
  it('sends on Enter, as the Workspaces composer does', async () => {
    const { onSend, box } = mount()
    type(box, 'Make the flyer')
    expect(press(box, { key: 'Enter', keyCode: 13 })).toBe(true)
    await act(async () => {})
    expect(onSend).toHaveBeenCalledWith('Make the flyer', [])
  })

  it('clears the box at once, before the host answers', async () => {
    let answer: (sent: boolean) => void = () => {}
    const { box } = mount(vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve))))
    type(box, 'En quÃ© nos quedamos?')
    press(box, { key: 'Enter', keyCode: 13 })
    expect(promptValue(box)).toBe('')
    await act(async () => answer(true))
    expect(promptValue(box)).toBe('')
  })

  it('puts the text back when the send fails', async () => {
    const { box } = mount(vi.fn(async () => false))
    type(box, 'Make the flyer')
    press(box, { key: 'Enter', keyCode: 13 })
    await act(async () => {})
    expect(promptValue(box)).toBe('Make the flyer')
  })

  it('keeps Shift+Enter as a new line in the same message', () => {
    const { onSend, box } = mount()
    type(box, 'Line one')
    expect(press(box, { key: 'Enter', keyCode: 13, shiftKey: true })).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
    expect(promptValue(box)).toBe('Line one\n')
  })

  it('picks the open @ item on Enter instead of sending', () => {
    const { onSend, box } = mount()
    type(box, '@Ir')
    press(box, { key: 'Enter', keyCode: 13 })
    expect(onSend).not.toHaveBeenCalled()
    expect(promptValue(box)).toBe('@Iris ')
  })

  it('does not send the Enter that confirms an IME composition', () => {
    const { onSend, box } = mount()
    act(() => {
      box.dispatchEvent(new Event('compositionstart', { bubbles: true }))
    })
    type(box, 'cafÃ©')
    press(box, { key: 'Enter', keyCode: 229, isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
    expect(promptValue(box)).toBe('cafÃ©')
  })

  it('does not send the Enter that follows an accented composition ending', () => {
    const { onSend, box } = mount()
    act(() => {
      box.dispatchEvent(new Event('compositionstart', { bubbles: true }))
    })
    type(box, 'café')
    act(() => {
      box.dispatchEvent(new Event('compositionend', { bubbles: true }))
    })
    press(box, { key: 'Enter', keyCode: 13 })
    expect(onSend).not.toHaveBeenCalled()
    expect(promptValue(box)).toBe('café')
  })

  it('does not send an empty message', () => {
    const { onSend, box } = mount()
    press(box, { key: 'Enter', keyCode: 13 })
    expect(onSend).not.toHaveBeenCalled()
  })
})

describe('the room composer layout and mentions', () => {
  it('is one line with the send button inline and no attach button it cannot honor', () => {
    const { container } = mount()
    expect(container.querySelector('button[aria-label="Send"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label="Attach files"]')).toBeNull()
  })

  it('picking a mention inserts a chip, not plain text, and sends it as plain @Name', async () => {
    const { onSend, box } = mount()
    type(box, 'Make the flyer @Ir')
    press(box, { key: 'Enter', keyCode: 13 })
    expect(docJson(box)).toContain('botTeamMention')
    expect(promptValue(box)).toBe('Make the flyer @Iris ')
    await act(async () => {})
    // The chip shows the name alone; what is sent keeps "@Name".
    expect(box.querySelector('[data-bot-team-mention="Iris"]')?.textContent).toBe('Iris')
    press(box, { key: 'Enter', keyCode: 13 })
    await act(async () => {})
    expect(onSend).toHaveBeenCalledWith('Make the flyer @Iris', [])
  })

  it('removes a picked chip whole on Backspace right after it', () => {
    const { box } = mount()
    type(box, '@Ir')
    press(box, { key: 'Enter', keyCode: 13 })
    expect(promptValue(box)).toBe('@Iris ')
    expect(press(box, { key: 'Backspace', keyCode: 8 })).toBe(true)
    expect(promptValue(box)).toBe('')
    expect(docJson(box)).not.toContain('botTeamMention')
  })

  it('pastes plain text: markdown stays literal and no chip appears', () => {
    const { box } = mount()
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: (type: string) => (type === 'text/plain' ? '**bold** @Iris' : '') }
    })
    act(() => {
      box.dispatchEvent(paste)
    })
    expect(promptValue(box)).toBe('**bold** @Iris')
    expect(docJson(box)).not.toContain('marks')
    expect(docJson(box)).not.toContain('botTeamMention')
  })
})
