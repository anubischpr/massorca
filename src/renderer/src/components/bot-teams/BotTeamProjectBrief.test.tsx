/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamRoom = vi.hoisted(() => vi.fn())
const setBotTeamProjectBrief = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-bot-team-client', () => ({
  listBotTeamRoom,
  setBotTeamProjectBrief
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name]))
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
// Why: the rich editor needs a layout engine jsdom lacks; a textarea stands in for its content and change hooks.
vi.mock('@/components/editor/editor-lazy-views', async () => {
  const React = await import('react')
  return {
    RichMarkdownEditor: ({
      content,
      onContentChange,
      onDirtyStateHint
    }: {
      content: string
      onContentChange: (value: string) => void
      onDirtyStateHint: (dirty: boolean) => void
    }) =>
      React.createElement('textarea', {
        'aria-label': 'Brief editor',
        value: content,
        onChange: (event: { target: { value: string } }) => {
          onContentChange(event.target.value)
          onDirtyStateHint(true)
        }
      })
  }
})

const { BotTeamProjectBrief } = await import('./BotTeamProjectBrief')

const TEAM: BotTeam = {
  id: 't1',
  name: 'Marketing',
  purpose: '',
  character: 'square',
  workspacesEnabled: false,
  accessMode: 'default',
  bots: []
}

function project(overrides: Partial<BotTeamProject> = {}): BotTeamProject {
  return {
    id: 'p1',
    teamId: 't1',
    name: 'Summer campaign',
    goal: 'Sell the offers',
    codeSource: null,
    brief: {
      requirements: ['Flyer for the offers', 'Offer email'],
      constraints: ['Prices are checked first'],
      decisions: []
    },
    briefUpdatedAt: null,
    ...overrides
  }
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(onTab = vi.fn(), onBack = vi.fn()): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(<BotTeamProjectBrief team={TEAM} projectId="p1" onBack={onBack} onTab={onTab} />)
  )
  return container
}

function typeInto(textarea: HTMLTextAreaElement | null, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(textarea, value)
  textarea?.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  listBotTeamRoom.mockReset()
  listBotTeamRoom.mockResolvedValue({ tasks: [], messages: [], projects: [project()] })
  setBotTeamProjectBrief.mockReset()
  toastError.mockReset()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the project brief', () => {
  it('shows Goal and the Brief editor with the design’s copy', async () => {
    const container = await mount()
    const text = container.textContent ?? ''
    for (const copy of [
      'Brief',
      'The project holds the why. Each task holds the how. Bots read this brief and their own task thread.',
      'Goal',
      'Sell the offers',
      'Summer campaign',
      'Marketing'
    ]) {
      expect(text).toContain(copy)
    }
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Goal'])
  })

  it('opens the editor on the Markdown built from the lists when none is saved yet', async () => {
    const container = await mount()
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Brief editor"]')?.value).toBe(
      '## Requirements\n- Flyer for the offers\n- Offer email\n\n## Constraints\n- Prices are checked first\n\n## Decisions'
    )
  })

  it('opens the editor on the saved Markdown when the project has one', async () => {
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [
        project({ brief: { ...project().brief, markdown: '## Decisions\n1. Nora writes' } })
      ]
    })
    const container = await mount()
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Brief editor"]')?.value).toBe(
      '## Decisions\n1. Nora writes'
    )
  })

  it('saves the editor Markdown and keeps the lists as they were, then shows the saved text', async () => {
    setBotTeamProjectBrief.mockResolvedValue(project())
    const container = await mount()
    const save = () =>
      [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent?.trim() === 'Save'
      )
    expect(save()?.disabled).toBe(true)

    const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="Brief editor"]')
    await act(async () =>
      typeInto(editor, '## Requirements\n- Flyer for the offers\n\nIris writes the text.')
    )
    await act(async () => save()?.click())

    expect(setBotTeamProjectBrief).toHaveBeenCalledWith('p1', {
      goal: 'Sell the offers',
      brief: {
        requirements: ['Flyer for the offers', 'Offer email'],
        constraints: ['Prices are checked first'],
        decisions: [],
        markdown: '## Requirements\n- Flyer for the offers\n\nIris writes the text.'
      }
    })
  })

  it('drops the editor changes on Cancel without saving', async () => {
    const container = await mount()
    const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="Brief editor"]')
    await act(async () => typeInto(editor, 'Changed my mind'))
    await act(async () =>
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.trim() === 'Cancel')
        ?.click()
    )
    expect(
      container.querySelector<HTMLTextAreaElement>('[aria-label="Brief editor"]')?.value
    ).toContain('## Requirements')
    expect(setBotTeamProjectBrief).not.toHaveBeenCalled()
  })

  it('saves the Goal as text', async () => {
    setBotTeamProjectBrief.mockResolvedValue(project())
    const container = await mount()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Goal"]')?.click()
    )
    const textarea = container.querySelector('textarea')
    await act(async () => typeInto(textarea, 'Sell more'))
    await act(async () => {
      textarea?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(setBotTeamProjectBrief).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ goal: 'Sell more' })
    )
  })

  it('does not save the Goal when nothing changed', async () => {
    const container = await mount()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Goal"]')?.click()
    )
    await act(async () => {
      container
        .querySelector('textarea')
        ?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(setBotTeamProjectBrief).not.toHaveBeenCalled()
  })

  it('tells the person when the host is too old to keep a brief', async () => {
    setBotTeamProjectBrief.mockResolvedValue('unavailable')
    const container = await mount()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Goal"]')?.click()
    )
    const textarea = container.querySelector('textarea')
    await act(async () => typeInto(textarea, 'Sell more'))
    await act(async () => {
      textarea?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(toastError).toHaveBeenCalledWith('This host cannot keep a project brief yet.')
  })

  it('shows when it was updated, only once it has been', async () => {
    const container = await mount()
    expect(container.textContent).not.toContain('Updated')
    act(() => {
      for (const { root } of mounted.splice(0)) {
        root.unmount()
      }
    })
    listBotTeamRoom.mockResolvedValue({
      tasks: [],
      messages: [],
      projects: [project({ briefUpdatedAt: Date.UTC(2026, 10, 1, 12, 0) })]
    })
    const again = await mount()
    expect(again.textContent).toMatch(/Updated .+ by you\./)
  })

  it('goes back to the Board and switches tabs', async () => {
    const onTab = vi.fn()
    const onBack = vi.fn()
    const container = await mount(onTab, onBack)
    const buttons = [...container.querySelectorAll('button')]
    act(() =>
      buttons
        .find((b) => b.textContent?.trim() === 'Board' && !b.closest('[role="radiogroup"]'))
        ?.click()
    )
    expect(onBack).toHaveBeenCalled()
    const tab = [...container.querySelectorAll('[role="radiogroup"] button')].find(
      (b) => b.textContent?.trim() === 'Board'
    )
    await act(async () => tab?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onTab).toHaveBeenCalledWith('board')
  })
})
