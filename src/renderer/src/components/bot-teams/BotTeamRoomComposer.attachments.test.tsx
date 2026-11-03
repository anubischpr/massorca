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
const FLYER: BotTeamRoomAttachment = { path: 'attachments/flyer.png', name: 'flyer.png' }

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(props: { onAttachFiles?: () => Promise<BotTeamRoomAttachment[]> } = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  const onSend = vi.fn(async () => true)
  act(() => {
    root.render(<BotTeamRoomComposer team={TEAM} offline={false} onSend={onSend} {...props} />)
  })
  return { container, onSend }
}

function attachButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Attach files"]')
}

function sendButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!
}

function typeText(container: HTMLElement, value: string): void {
  const box = container.querySelector<HTMLElement>('[role="combobox"]')!
  act(() => {
    promptEditor(box).commands.setContent(promptTextContent(value), { emitUpdate: true })
    promptEditor(box).commands.focus('end')
  })
}

describe('bot team room composer attachments', () => {
  it('shows no attach button when the room cannot take files', () => {
    const { container } = mount()

    expect(attachButton(container)).toBeNull()
  })

  it('puts the attach button at the left end of the composer', () => {
    const { container } = mount({ onAttachFiles: async () => [] })
    const box = container.querySelector('[role="combobox"]')!

    const attach = attachButton(container)
    expect(attach).not.toBeNull()
    expect(attach!.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('lists the picked files as chips that can be removed', async () => {
    const { container } = mount({ onAttachFiles: async () => [FLYER] })

    await act(async () => attachButton(container)!.click())
    expect(container.textContent).toContain('flyer.png')

    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Remove attachment"]')!.click()
    )
    expect(container.textContent).not.toContain('flyer.png')
  })

  it('shows the attach action on a team whose folder does not exist yet', () => {
    const { container } = mount({ onAttachFiles: async () => [FLYER] })

    expect(attachButton(container)).not.toBeNull()
  })

  it('sends the text with its files, then clears both', async () => {
    const { container, onSend } = mount({ onAttachFiles: async () => [FLYER] })

    await act(async () => attachButton(container)!.click())
    typeText(container, 'Revisa el flyer')
    await act(async () => sendButton(container).click())

    expect(onSend).toHaveBeenCalledWith('Revisa el flyer', [FLYER])
    expect(container.textContent).not.toContain('flyer.png')
  })

  it('keeps at most ten files on one message', async () => {
    const many = Array.from({ length: 11 }, (_, index) => ({
      path: `attachments/f${index}.txt`,
      name: `f${index}.txt`
    }))
    const { container } = mount({ onAttachFiles: async () => many })

    await act(async () => attachButton(container)!.click())

    expect(container.querySelectorAll('button[aria-label="Remove attachment"]')).toHaveLength(10)
  })
})
