/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotTeamRoomMessage } from './BotTeamRoomMessage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))

const ANA = {
  id: 'ana',
  name: 'Ana',
  job: 'Designer',
  agent: 'claude',
  modelMode: 'auto',
  model: null,
  effort: null,
  skills: []
}
const team = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [ANA]
} as unknown as BotTeam
const FILES = [{ path: 'attachments/flyer.png', name: 'flyer.png' }]
const TEXT = 'Nobody else launches on Friday morning.'

describe('BotTeamRoomMessage inside a run', () => {
  let root: Root | undefined
  let host: HTMLDivElement | undefined
  afterEach(() => {
    act(() => root?.unmount())
    host?.remove()
    root = undefined
    host = undefined
  })

  function show(props: {
    continuesRun?: boolean
    attachments?: typeof FILES
    authorBotId?: string | null
    quoted?: { authorName: string; text: string }
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
            authorBotId: props.authorBotId === undefined ? 'ana' : props.authorBotId,
            text: TEXT,
            ...(props.attachments ? { attachments: props.attachments } : {})
          }}
          team={team}
          otherTeams={[]}
          mentions={[]}
          continuesRun={props.continuesRun === true}
          quoted={props.quoted ?? null}
        />
      )
    )
    return host
  }

  it('shows the bot name on the first message of a run', () => {
    expect(show({}).textContent).toContain('Ana')
  })

  it('puts the name inside the first bubble, with its corner', () => {
    const bubble = bubbleOf(show({}))
    expect(bubble?.textContent).toContain('Ana')
    expect(bubble?.querySelector('svg')).not.toBeNull()
  })

  it('leaves the name and the corner out of a message that continues a run', () => {
    const shown = show({ continuesRun: true })
    expect(shown.textContent).toContain(TEXT)
    expect(shown.textContent).not.toContain('Ana')
    expect(bubbleOf(shown)?.querySelector('svg')).toBeNull()
  })

  it('quotes the message a sent line answers inside its bubble', () => {
    const shown = show({ authorBotId: null, quoted: { authorName: 'Ana', text: 'Listo' } })
    const bubble = bubbleOf(shown)
    expect(bubble?.textContent).toContain('Ana')
    expect(bubble?.textContent).toContain('Listo')
  })

  function bubbleOf(shown: HTMLElement): HTMLElement | undefined {
    return Array.from(shown.querySelectorAll<HTMLElement>('.rounded-xl')).find((element) =>
      element.textContent?.includes(TEXT)
    )
  }

  it('puts Copy beside the bubble instead of under the attachments', () => {
    const shown = show({ attachments: FILES })
    const bubble = Array.from(shown.querySelectorAll<HTMLElement>('.rounded-xl')).find((element) =>
      element.textContent?.includes(TEXT)
    )
    expect(
      bubble?.nextElementSibling?.querySelector('button[aria-label="Copy message"]')
    ).not.toBeNull()
  })
})
