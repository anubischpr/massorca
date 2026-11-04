/**
 * @vitest-environment happy-dom
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mentionQueries = vi.hoisted(() => [] as { query: string | null; worktreeId?: string }[])
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('../native-chat/use-native-chat-mention-files', () => ({
  useNativeChatMentionFiles: (args: { query: string | null; structuredWorktreeId?: string }) => {
    mentionQueries.push({ query: args.query, worktreeId: args.structuredWorktreeId })
    return {
      files: args.query === null ? [] : ['src/shared/routine.ts', 'docs/brief.md'],
      loading: false,
      failed: false
    }
  }
}))

const { CreateChatComposer } = await import('./CreateChatComposer')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function Harness({ worktreeId }: { worktreeId: string | null }): React.JSX.Element {
  const [draft, setDraft] = useState('')
  return (
    <CreateChatComposer
      draft={draft}
      onDraftChange={setDraft}
      canSubmit
      pending={false}
      error={null}
      onSubmit={() => {}}
      mentionWorktreeId={worktreeId}
      placeChips={null}
      footerChips={null}
      notice={null}
      rightChips={null}
    />
  )
}

function mount(worktreeId: string | null): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<Harness worktreeId={worktreeId} />))
  return container
}

function type(container: HTMLElement, text: string): HTMLTextAreaElement {
  const box = container.querySelector('textarea')
  if (!box) {
    throw new Error('Composer missing')
  }
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(box, text)
    box.setSelectionRange(text.length, text.length)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return box
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  mentionQueries.length = 0
})

describe('CreateChatComposer @ files', () => {
  it('lists the picked worktree’s files after @, each with its file-type icon', () => {
    const container = mount('wt-1')
    type(container, 'Fix @rou')
    const options = [...container.querySelectorAll('[role="option"]')]
    expect(options).toHaveLength(2)
    expect(options[0]?.querySelector('svg.lucide-file-code')).not.toBeNull()
    expect(options[1]?.querySelector('svg.lucide-file-text')).not.toBeNull()
    expect(mentionQueries.at(-1)).toEqual({ query: 'rou', worktreeId: 'wt-1' })
  })

  it('shows a file row’s full path as its tooltip', async () => {
    const container = mount('wt-1')
    type(container, 'Fix @rou')
    const row = container.querySelector<HTMLButtonElement>('[role="option"]')
    expect(row?.getAttribute('data-slot')).toBe('tooltip-trigger')
    await act(async () => row?.focus())
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      'src/shared/routine.ts'
    )
  })

  it('inserts the picked path on Enter instead of creating the session', () => {
    const container = mount('wt-1')
    const box = type(container, 'Fix @rou')
    act(() => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(box.value).toBe('Fix @src/shared/routine.ts ')
    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })

  it('offers nothing without a project', () => {
    const container = mount(null)
    type(container, 'Fix @rou')
    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })
})
