// @vitest-environment happy-dom

import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionModelOption } from '../../../../shared/agent-session-wire'
import type { TuiAgent } from '../../../../shared/tui-agent'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => 'gentle-shell' }))
vi.mock('@/lib/agent-catalog', () => ({
  getAgentDisplayLabel: (agent: string, piRuntime: string) =>
    agent === 'pi' && piRuntime === 'gentle-shell' ? 'Gentle Shell' : agent,
  AgentIcon: ({ agent }: { agent: string }) => <span data-testid={`icon-${agent}`} />
}))

import { CreateChatAgentChip } from './CreateChatAgentChip'
import type { CreateChatOptions, CreateChatSelection } from './create-chat-selection'
import type { CreateChatModelCatalog } from './use-create-chat-model-catalog'

const model = (id: string, efforts: string[] = []): AgentSessionModelOption => ({
  id,
  label: id,
  isDefault: id === 'opus',
  efforts: efforts.map((value) => ({ value, label: value })),
  ...(efforts[0] ? { defaultEffort: efforts[0] } : {})
})

const NONE: CreateChatModelCatalog = { status: 'none', models: [] }
const CLAUDE: CreateChatModelCatalog = {
  status: 'ready',
  models: [model('opus', ['low', 'high']), model('haiku')]
}
const options: CreateChatOptions = {
  hosts: [],
  repos: [],
  agents: ['claude', 'antigravity', 'pi'],
  preferredAgent: 'claude',
  projectlessDirectory: ''
}

// Why: tests flip these between renders, the way the catalog hook does once the host answers.
let catalogs: Partial<Record<TuiAgent, CreateChatModelCatalog>> = {}
let latestSelection: CreateChatSelection | null = null

function Harness(): React.JSX.Element {
  const [selection, setSelection] = useState<CreateChatSelection>({
    executionHostId: 'local',
    project: { kind: 'none' },
    workspaceMode: 'new-worktree',
    agent: 'claude',
    accessMode: 'default'
  })
  latestSelection = selection
  return (
    <CreateChatAgentChip
      selection={selection}
      options={options}
      catalog={catalogs[selection.agent] ?? { status: 'loading', models: [] }}
      onSelectionChange={setSelection}
    />
  )
}

const settle = (): Promise<void> => act(async () => new Promise((r) => setTimeout(r, 30)))

async function openMenu(): Promise<HTMLElement> {
  const trigger = screen.getByRole('button', { name: 'Agent, model and effort' })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  await settle()
  return trigger
}

async function pick(name: RegExp | string): Promise<void> {
  fireEvent.click(screen.getByRole('menuitemradio', { name }))
  await settle()
}

const menuIsOpen = (): boolean => screen.queryByRole('menu') !== null

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  catalogs = {}
  latestSelection = null
})

describe('CreateChatAgentChip', () => {
  it('lists Gentle Shell under its own name', async () => {
    catalogs = { claude: CLAUDE }
    render(<Harness />)
    await openMenu()

    expect(screen.getByRole('menuitemradio', { name: 'Gentle Shell' })).toBeTruthy()
    expect(screen.getByTestId('icon-pi')).toBeTruthy()
  })

  it('shows model and effort in the same menu once the new agent catalog arrives', async () => {
    catalogs = { claude: NONE, antigravity: { status: 'loading', models: [] } }
    const view = render(<Harness />)
    await openMenu()

    await pick('antigravity')
    expect(menuIsOpen()).toBe(true)
    expect(screen.getByText('Loading models…')).toBeTruthy()

    catalogs = { ...catalogs, antigravity: CLAUDE }
    view.rerender(<Harness />)
    await settle()

    expect(menuIsOpen()).toBe(true)
    expect(screen.getByRole('menuitemradio', { name: 'Default model' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'haiku' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /^high$/i })).toBeTruthy()
  })

  it('stays open until agent, model and effort are chosen, then closes', async () => {
    catalogs = { claude: CLAUDE, antigravity: CLAUDE }
    render(<Harness />)
    await openMenu()

    await pick('antigravity')
    expect(menuIsOpen()).toBe(true)
    await settle()
    await pick('opus')
    expect(menuIsOpen()).toBe(true)
    await pick(/^high$/i)

    expect(menuIsOpen()).toBe(false)
    expect(latestSelection).toMatchObject({ agent: 'antigravity', model: 'opus', effort: 'high' })
  })

  it('closes after the model when it has no effort to choose', async () => {
    catalogs = { claude: CLAUDE }
    render(<Harness />)
    await openMenu()

    await pick('haiku')

    expect(menuIsOpen()).toBe(false)
    expect(latestSelection).toMatchObject({ model: 'haiku' })
  })

  it('completes on the agent pick and says so when the agent has no catalog', async () => {
    catalogs = { claude: CLAUDE, antigravity: { status: 'loading', models: [] } }
    const view = render(<Harness />)
    await openMenu()

    await pick('antigravity')
    expect(menuIsOpen()).toBe(true)

    catalogs = { ...catalogs, antigravity: NONE }
    view.rerender(<Harness />)
    await settle()

    expect(menuIsOpen()).toBe(false)
    expect(latestSelection).toMatchObject({ agent: 'antigravity' })

    await openMenu()
    expect(screen.getByText('Model set by the agent')).toBeTruthy()
  })

  it('closes on Escape and returns focus to the chip', async () => {
    catalogs = { claude: CLAUDE }
    render(<Harness />)
    const trigger = await openMenu()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await settle()

    expect(menuIsOpen()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
