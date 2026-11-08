/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import { promptTextContent } from '../native-chat/native-chat-prompt-document-text'
import { promptEditor } from '../native-chat/native-chat-prompt-editor.test-support'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
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
const REPLY = {
  messageId: 'm1',
  botName: 'Iris',
  quote: 'Nobody else launches on Friday morning.'
}

type Send = (
  text: string,
  attachments: BotTeamRoomAttachment[],
  replyTo?: string
) => Promise<boolean>

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(props: { replyTo?: typeof REPLY | null; onSend?: Send } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  const onSend = props.onSend ?? vi.fn<Send>(async () => true)
  act(() => {
    root.render(
      <BotTeamRoomComposer
        team={TEAM}
        offline={false}
        onSend={onSend}
        replyTo={props.replyTo ?? null}
      />
    )
  })
  return { container, onSend }
}

function box(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[role="combobox"]')!
}

function sendButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!
}

function cancelButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Cancel reply"]')
}

function typeText(container: HTMLElement, value: string): void {
  act(() => {
    promptEditor(box(container)).commands.setContent(promptTextContent(value), {
      emitUpdate: true
    })
    promptEditor(box(container)).commands.focus('end')
  })
}

describe('bot team room composer reply', () => {
  it('shows the replied message above the box, naming the bot', () => {
    const { container } = mount({ replyTo: REPLY })
    expect(container.textContent).toContain('Replying to Iris')
    expect(container.textContent).toContain(REPLY.quote)
  })

  it('puts no @ chip into the box for a reply', () => {
    const { container } = mount({ replyTo: REPLY })
    expect(box(container).textContent).not.toContain('Iris')
  })

  it('drops the reply when its X is pressed', () => {
    const { container } = mount({ replyTo: REPLY })
    act(() => cancelButton(container)!.click())
    expect(container.textContent).not.toContain('Replying to Iris')
  })

  it('sends the text with the replied message id, then clears the reply', async () => {
    const { container, onSend } = mount({ replyTo: REPLY })
    typeText(container, 'Y si el viernes cambia?')
    await act(async () => {
      sendButton(container).click()
    })
    expect(onSend).toHaveBeenCalledWith('Y si el viernes cambia?', [], 'm1')
    expect(container.textContent).not.toContain('Replying to Iris')
  })

  it('keeps the reply when the host refuses the send', async () => {
    const { container } = mount({ replyTo: REPLY, onSend: vi.fn<Send>(async () => false) })
    typeText(container, 'Y si el viernes cambia?')
    await act(async () => {
      sendButton(container).click()
    })
    expect(container.textContent).toContain('Replying to Iris')
  })

  it('sends no reply id when nothing is replied to', async () => {
    const { container, onSend } = mount()
    typeText(container, 'Make the flyer')
    await act(async () => {
      sendButton(container).click()
    })
    expect(onSend).toHaveBeenCalledWith('Make the flyer', [])
  })
})
