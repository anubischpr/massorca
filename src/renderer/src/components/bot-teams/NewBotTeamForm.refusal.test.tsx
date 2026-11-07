// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotDraftInput, BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamChangeResult } from './use-bot-teams'
import type { AddBotDialog } from './AddBotDialog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Why: the bot editor is stubbed so its props can be driven directly; the dialog itself is tested apart.
const editor = vi.hoisted(() => ({
  props: null as null | Parameters<typeof AddBotDialog>[0]
}))
vi.mock('./AddBotDialog', async () => {
  const { useEffect } = await import('react')
  return {
    AddBotDialog: (props: Parameters<typeof AddBotDialog>[0]) => {
      editor.props = props
      useEffect(
        () => () => {
          editor.props = null
        },
        []
      )
      return null
    }
  }
})

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
vi.mock('./BotTeamHostPicker', () => ({ BotTeamHostField: () => null }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => null }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))

import { NewBotTeamForm } from './NewBotTeamForm'

const BOT: BotDraftInput = {
  name: 'Eve',
  job: '',
  agent: 'antigravity',
  modelMode: 'auto',
  model: null,
  effort: null,
  skills: []
}

const OPS: BotTeam = {
  id: 'team-ops',
  name: 'Ops',
  purpose: '',
  character: 'circle',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: [
    {
      id: 'bot-1',
      name: 'Eve',
      job: '',
      agent: 'claude',
      modelMode: 'auto',
      model: null,
      effort: null,
      skills: []
    }
  ]
}

const REFUSED: BotTeamChangeResult = { done: false, refusal: 'Refused', agentSwitch: true }
const DONE: BotTeamChangeResult = { done: true }

let mounted: { root: Root; container: HTMLDivElement } | null = null
afterEach(() => {
  if (mounted) {
    act(() => mounted?.root.unmount())
    mounted.container.remove()
    mounted = null
  }
})

function renderEdit(outcomes: Partial<{ add: BotTeamChangeResult; update: BotTeamChangeResult }>): {
  onAddBot: ReturnType<typeof vi.fn>
  onUpdateBot: ReturnType<typeof vi.fn>
} {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted = { root, container }
  const onAddBot = vi.fn(async () => outcomes.add ?? DONE)
  const onUpdateBot = vi.fn(async () => outcomes.update ?? DONE)
  act(() =>
    root.render(
      <NewBotTeamForm
        usedCharacters={[]}
        editing={{
          team: OPS,
          onSave: vi.fn(),
          onAddBot,
          onUpdateBot,
          onRemoveBot: vi.fn(),
          onDelete: vi.fn()
        }}
        onCancel={vi.fn()}
        onCreate={vi.fn()}
      />
    )
  )
  return { onAddBot, onUpdateBot }
}

function clickButton(selector: string, text?: string): void {
  const found = [...document.querySelectorAll<HTMLButtonElement>(selector)].find(
    (button) => text === undefined || button.textContent?.trim() === text
  )
  if (!found) {
    throw new Error(`no button matching ${selector} ${text ?? ''}`)
  }
  act(() => found.click())
}

// Why: the open editor is whichever one the form showed last; the stub is driven the way the dialog would.
async function save(bot: BotDraftInput): Promise<void> {
  await act(async () => {
    await editor.props?.onAdd(bot)
  })
}

describe('NewBotTeamForm bot editor against the host', () => {
  it('keeps the add-bot editor open, with the refusal, when the host refuses the agent switch', async () => {
    const { onAddBot } = renderEdit({ add: REFUSED })
    clickButton('button', 'Add a bot')

    await save(BOT)

    expect(onAddBot).toHaveBeenCalledWith(BOT)
    expect(editor.props?.agentRefusal).toBe('Refused')
  })

  it('keeps the edit-bot editor open, with the refusal, when the host refuses the update', async () => {
    const { onUpdateBot } = renderEdit({ update: REFUSED })
    clickButton('button[aria-label="Edit bot"]')

    await save(BOT)

    expect(onUpdateBot).toHaveBeenCalledWith('bot-1', BOT)
    expect(editor.props?.agentRefusal).toBe('Refused')
  })

  it('clears the refusal when the agent changes, and the editor stays open', async () => {
    renderEdit({ add: REFUSED })
    clickButton('button', 'Add a bot')
    await save(BOT)

    act(() => editor.props?.onAgentChange?.())

    expect(editor.props).not.toBeNull()
    expect(editor.props?.agentRefusal).toBeNull()
  })

  it('closes the add-bot editor once the host accepts the change', async () => {
    renderEdit({ add: DONE })
    clickButton('button', 'Add a bot')

    await save(BOT)

    expect(editor.props).toBeNull()
  })

  it('closes the editor on a failure that is not an agent refusal, as before', async () => {
    renderEdit({
      add: { done: false, refusal: 'Bot bob is not on team t1.', agentSwitch: false }
    })
    clickButton('button', 'Add a bot')

    await save(BOT)

    expect(editor.props).toBeNull()
  })
})
