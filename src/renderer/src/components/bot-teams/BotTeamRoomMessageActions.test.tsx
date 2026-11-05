/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamRoomMessage } from './BotTeamRoomMessage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  translate: (_key: string, fallback: string, vars?: Record<string, string>) =>
    Object.entries(vars ?? {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, value),
      fallback
    )
}))

const ada = { id: 'b1', name: 'Ada', job: '', agent: 'claude' }
const grace = { id: 'b2', name: 'Grace', job: '', agent: 'codex' }
const team = {
  id: 't1',
  name: 'Marketing',
  character: 'circle',
  bots: [ada, grace]
} as unknown as BotTeam
const files = [{ path: 'attachments/logo.png', name: 'logo.png' }]

describe('BotTeamRoomMessage bot replies', () => {
  let root: Root | undefined
  let host: HTMLDivElement | undefined

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    })
  })

  afterEach(() => {
    act(() => root?.unmount())
    host?.remove()
    vi.clearAllMocks()
  })

  function show(props: {
    authorBotId?: string | null
    text?: string
    withFiles?: boolean
    onReply?: (bot: unknown) => void
  }): HTMLDivElement {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() =>
      root!.render(
        <BotTeamRoomMessage
          message={{
            id: 'm1',
            teamId: 't1',
            authorBotId: props.authorBotId === undefined ? 'b1' : props.authorBotId,
            text: props.text ?? 'Hola equipo',
            attachments: props.withFiles ? files : undefined
          }}
          team={team}
          otherTeams={[]}
          mentions={[]}
          {...(props.onReply ? { onReply: props.onReply } : {})}
        />
      )
    )
    return host
  }

  function button(host: HTMLElement, label: string): HTMLButtonElement {
    const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
    if (!found) {
      throw new Error(`no button labelled ${label}`)
    }
    return found
  }

  it('copies the reply text and confirms with a toast', async () => {
    const shown = show({})

    await act(async () => {
      button(shown, 'Copy message').click()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hola equipo')
    expect(toast.success).toHaveBeenCalledWith('Message copied')
  })

  it('puts the bot into the composer through Reply', () => {
    const onReply = vi.fn()
    const shown = show({ onReply })

    act(() => button(shown, 'Reply to Ada').click())

    expect(onReply).toHaveBeenCalledWith(ada)
  })

  it('keeps the bubble around the words and the file chips outside it', () => {
    const shown = show({ withFiles: true })

    const bubble = shown.querySelector('.rounded-xl.border-border.bg-card')
    expect(bubble?.textContent).toContain('Hola equipo')
    expect(bubble?.textContent).not.toContain('logo.png')
    expect(shown.textContent).toContain('logo.png')
  })

  it("colors a bot's name with its agent icon's brand color, and leaves a monochrome icon's name in the text color", () => {
    const shown = show({})
    const claudeName = [...shown.querySelectorAll<HTMLElement>('span')].find(
      (span) => span.textContent === 'Ada'
    )
    expect(claudeName?.style.color).not.toBe('')

    act(() => root?.unmount())
    host?.remove()
    const other = show({ authorBotId: 'b2' })
    const codexName = [...other.querySelectorAll<HTMLElement>('span')].find(
      (span) => span.textContent === 'Grace'
    )
    expect(codexName?.style.color).toBe('')
  })

  it("shows no Copy or Reply for the person's own message", () => {
    const shown = show({ authorBotId: null })

    expect(shown.querySelector('button[aria-label="Copy message"]')).toBeNull()
  })
})
