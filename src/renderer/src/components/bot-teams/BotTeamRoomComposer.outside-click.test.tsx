/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
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

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(): { box: HTMLElement; container: HTMLDivElement } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <BotTeamRoomComposer team={TEAM} offline={false} onSend={vi.fn(async () => true)} />
    )
  )
  const box = container.querySelector<HTMLElement>('[role="combobox"]')!
  return { box, container }
}

/** Types a line with the caret at its end, as the person would. */
function type(box: HTMLElement, value: string): void {
  act(() => {
    promptEditor(box).commands.setContent(promptTextContent(value), { emitUpdate: true })
    promptEditor(box).commands.focus('end')
  })
}

function pointerDownOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  })
}

describe('the @ and / menu of the room composer', () => {
  it('closes when the person clicks outside the message box', () => {
    const { box, container } = mount()
    type(box, '@Ir')
    expect(container.querySelector('[role="listbox"]')).not.toBeNull()

    pointerDownOn(document.body)

    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })

  it('stays open for a click inside the message box', () => {
    const { box, container } = mount()
    type(box, '@Ir')

    pointerDownOn(box)

    expect(container.querySelector('[role="listbox"]')).not.toBeNull()
  })
})
