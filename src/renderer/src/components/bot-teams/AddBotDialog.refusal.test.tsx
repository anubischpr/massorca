// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BotDraftInput } from '../../../../shared/rpc-contract/bot-team-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('./BotAdvancedOptions', () => ({ BotAdvancedOptions: () => null }))
vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))

import { AddBotDialog } from './AddBotDialog'

const BOB: BotDraftInput = {
  name: 'Bob',
  job: '',
  agent: 'claude',
  modelMode: 'auto',
  model: null,
  effort: null,
  skills: []
}

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
  }
  container?.remove()
  root = null
  container = null
})

type DialogProps = Partial<Parameters<typeof AddBotDialog>[0]>

// Why: the dialog is portalled, so it is queried from the document, not the container.
function render(props: DialogProps = {}): void {
  if (!root) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() =>
    root?.render(<AddBotDialog initial={BOB} onCancel={vi.fn()} onAdd={vi.fn()} {...props} />)
  )
}

function buttonNamed(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text
  )
}

function saveButton(): HTMLButtonElement {
  const save = buttonNamed('Save')
  if (!save) {
    throw new Error('the bot editor shows no Save button')
  }
  return save
}

describe('AddBotDialog agent refusal', () => {
  it('shows the host refusal inline in the agent section', () => {
    render({ agentRefusal: 'Antigravity refused' })

    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Antigravity refused')
  })

  it('shows no refusal when the host has refused nothing', () => {
    render({ agentRefusal: null })

    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  it('asks its parent to clear the refusal when the agent changes, not when it stays', () => {
    const onAgentChange = vi.fn()
    render({ agentRefusal: 'Antigravity refused', onAgentChange })

    act(() => buttonNamed('Claude')?.click())
    expect(onAgentChange).not.toHaveBeenCalled()

    act(() => buttonNamed('Codex')?.click())
    expect(onAgentChange).toHaveBeenCalledTimes(1)
  })

  it('keeps Save disabled while the host answers, so one save is not sent twice', async () => {
    let answer!: () => void
    const onAdd = vi.fn(() => new Promise<void>((resolve) => (answer = resolve)))
    render({ onAdd })

    await act(async () => saveButton().click())
    expect(saveButton().disabled).toBe(true)
    await act(async () => saveButton().click())
    expect(onAdd).toHaveBeenCalledTimes(1)

    await act(async () => answer())
    expect(saveButton().disabled).toBe(false)
  })
})
