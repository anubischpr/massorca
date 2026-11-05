// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value: string
    onValueChange: (next: string) => void
    children: React.ReactNode
  }) => (
    <select
      aria-label="Access"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  )
}))
vi.mock('@/components/marketplace/MarketplaceTeamAccessDialog', () => ({
  MarketplaceTeamAccessDialog: ({ team }: { team: BotTeam }) => (
    <div data-testid="team-apps-dialog">{team.name}</div>
  )
}))
vi.mock('./BotTeamHostPicker', () => ({ BotTeamHostField: () => null }))
vi.mock('./AddBotDialog', () => ({ AddBotDialog: () => null }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => null }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))

import { NewBotTeamForm } from './NewBotTeamForm'

const OPS: BotTeam = {
  id: 'team-ops',
  name: 'Ops',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

let mounted: { root: Root; container: HTMLDivElement } | null = null
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount())
    mounted.container.remove()
    mounted = null
  }
})

function renderEdit(onSave = vi.fn()) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted = { root, container }
  const editing = {
    team: OPS,
    onSave,
    onAddBot: vi.fn(),
    onUpdateBot: vi.fn(),
    onRemoveBot: vi.fn(),
    onDelete: vi.fn()
  }
  act(() =>
    root.render(
      <NewBotTeamForm usedCharacters={[]} editing={editing} onCancel={vi.fn()} onCreate={vi.fn()} />
    )
  )
  return { container, onSave }
}

function buttonNamed(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === text)
  expect(found, `a button "${text}"`).toBeDefined()
  return found as HTMLButtonElement
}

describe('NewBotTeamForm edit access', () => {
  it('shows the Access choice and a Marketplace apps button for an existing team', () => {
    const { container } = renderEdit()
    const access = container.querySelector('select[aria-label="Access"]') as HTMLSelectElement
    expect(access.value).toBe('default')
    act(() => buttonNamed(container, 'Marketplace apps…').click())
    expect(container.querySelector('[data-testid="team-apps-dialog"]')?.textContent).toBe('Ops')
  })

  it('saves the access mode chosen in the edit form', () => {
    const { container, onSave } = renderEdit()
    const access = container.querySelector('select[aria-label="Access"]') as HTMLSelectElement
    act(() => {
      access.value = 'full-access'
      access.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => buttonNamed(container, 'Save').click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'full-access' }))
  })
})
