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

const team = { id: 't1', name: 'Marketing', character: 'circle', bots: [] } as unknown as BotTeam
const files = [{ path: 'attachments/logo.png', name: 'logo.png' }]

describe('BotTeamRoomMessage with only files', () => {
  let root: Root | undefined
  let host: HTMLDivElement | undefined
  afterEach(() => {
    act(() => root?.unmount())
    host?.remove()
  })

  function show(text: string, authorBotId: string | null = null): string {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    act(() =>
      root!.render(
        <BotTeamRoomMessage
          message={{ id: 'm1', teamId: 't1', authorBotId, text, attachments: files }}
          team={team}
          otherTeams={[]}
          mentions={[]}
        />
      )
    )
    return host.textContent ?? ''
  }

  it('shows only the file chips for the line the host filed it with', () => {
    const shown = show('Files attached: logo.png')
    expect(shown).toContain('logo.png')
    expect(shown).not.toContain('Files attached')
  })

  it('hides the file names an older host was sent as text, leaving the chip', () => {
    expect(show('logo.png').match(/logo\.png/g)).toHaveLength(1)
  })

  it('keeps the words the person typed next to the files', () => {
    expect(show('Use this for the flyer')).toContain('Use this for the flyer')
  })

  it("shows a bot's file path as its file name only, and leaves the person's own text alone", () => {
    const line = 'Guardé el informe en /home/me/orca/workspaces/nexus/docs/documentation-health.md.'
    const shown = show(line, 'bot-1')
    expect(shown).toContain('Guardé el informe en documentation-health.md.')
    expect(shown).not.toContain('/home/me')
    act(() => root?.unmount())
    host?.remove()
    expect(show(line)).toContain('/home/me/orca')
  })
})
