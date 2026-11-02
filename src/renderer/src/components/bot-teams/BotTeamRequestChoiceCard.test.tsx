/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => <i /> }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => <i /> }))

const { BotTeamRequestChoiceCard } = await import('./BotTeamRequestChoiceCard')

const BOT = { modelMode: 'auto' as const, model: null, effort: null, skills: [] }
function team(id: string, name: string, purpose: string, bots: BotTeam['bots']): BotTeam {
  return {
    id,
    name,
    purpose,
    character: 'square',
    workspacesEnabled: false,
    accessMode: 'default',
    bots
  }
}
const CURRENT = team('mk', 'Marketing', 'Flyers', [
  { ...BOT, id: 'iris', name: 'Iris', job: 'Designs flyers', agent: 'claude' },
  { ...BOT, id: 'max', name: 'Max', job: 'Writes copy', agent: 'codex' }
])
const OTHERS = [team('wh', 'Warehouse', 'Inventory', []), team('sa', 'Sales', 'Deals', [])]

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function show(choice: Parameters<typeof BotTeamRequestChoiceCard>[0]['choice']) {
  const handlers = {
    onSendToBot: vi.fn(),
    onSendToTeam: vi.fn(),
    onKeep: vi.fn(),
    onCreateBot: vi.fn(),
    onCreateTeam: vi.fn()
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <BotTeamRequestChoiceCard
        choice={choice}
        team={CURRENT}
        otherTeams={OTHERS}
        busy={false}
        {...handlers}
      />
    )
  )
  const button = (name: string): HTMLButtonElement => {
    const found = [...container.querySelectorAll('button')].find((b) => b.textContent === name)
    if (!found) {
      throw new Error(`No button ${name}: ${container.textContent}`)
    }
    return found
  }
  return { container, handlers, button }
}

describe('BotTeamRequestChoiceCard', () => {
  it('suggests the other team in the board 15 words, and lets the person send or keep', () => {
    const { container, handlers, button } = show({ kind: 'other-team', teamId: 'wh' })
    expect(container.textContent).toContain(
      'Choose where this task goes: Send to Warehouse, or keep it in Marketing.'
    )
    act(() => button('Send to Warehouse').click())
    expect(handlers.onSendToTeam).toHaveBeenCalledWith('wh')
    act(() => button('Keep in Marketing').click())
    expect(handlers.onKeep).toHaveBeenCalledTimes(1)
  })

  it('lets the person change the suggested team before sending', () => {
    const { container, handlers, button } = show({ kind: 'other-team', teamId: 'wh' })
    const sales = container.querySelector<HTMLElement>('[role="radio"][value="sa"]')
    act(() => sales?.click())
    expect(container.textContent).toContain('Choose where this task goes: Send to Sales')
    act(() => button('Send to Sales').click())
    expect(handlers.onSendToTeam).toHaveBeenCalledWith('sa')
  })

  it('offers a new bot or an existing one when no bot covers the request', () => {
    const { handlers, button } = show({ kind: 'new-bot' })
    act(() => button('Create a new bot').click())
    expect(handlers.onCreateBot).toHaveBeenCalledTimes(1)
    act(() => button('Send to Iris').click())
    expect(handlers.onSendToBot).toHaveBeenCalledWith('iris')
  })

  it('offers a new team or an existing one when no team covers the request', () => {
    const { container, handlers, button } = show({ kind: 'new-team' })
    expect(container.textContent).toContain('create a new team')
    act(() => button('Create a new team').click())
    expect(handlers.onCreateTeam).toHaveBeenCalledTimes(1)
    act(() => button('Send to Warehouse').click())
    expect(handlers.onSendToTeam).toHaveBeenCalledWith('wh')
  })
})
