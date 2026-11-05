/**
 * @vitest-environment happy-dom
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type * as I18nModule from '@/i18n/i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mentionQueries = vi.hoisted(
  () =>
    [] as {
      query: string | null
      worktreeId?: string
      executionHostId?: string
      rootPath?: string | null
    }[]
)
vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18nModule>()),
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('../native-chat/use-native-chat-mention-files', () => ({
  useNativeChatMentionFiles: (args: {
    query: string | null
    structuredWorktreeId?: string
    executionHostId?: string
    rootPath?: string | null
  }) => {
    mentionQueries.push({
      query: args.query,
      worktreeId: args.structuredWorktreeId,
      executionHostId: args.executionHostId,
      rootPath: args.rootPath
    })
    return {
      files: args.query === null ? [] : ['src/shared/routine.ts', 'docs/brief.md'],
      loading: false,
      failed: false
    }
  }
}))

const { CreateChatComposer } = await import('./CreateChatComposer')
const { createChatMentionPlacement, useCreateChatMentionTarget } =
  await import('./use-create-chat-mention')
const { promptTextContent } = await import('../native-chat/native-chat-prompt-document')
const { promptEditor, promptValue } =
  await import('../native-chat/native-chat-prompt-editor.test-support')
const { useAppStore } = await import('@/store')

const mounted: { container: HTMLDivElement; root: Root }[] = []

type MentionTarget = Parameters<typeof CreateChatComposer>[0]['mentionTarget']

function Harness({ target }: { target: MentionTarget }): React.JSX.Element {
  const [draft, setDraft] = useState('')
  return (
    <CreateChatComposer
      draft={draft}
      onDraftChange={setDraft}
      canSubmit
      pending={false}
      error={null}
      onSubmit={() => {}}
      mentionTarget={target}
      placeChips={null}
      footerChips={null}
      notice={null}
      rightChips={null}
    />
  )
}

function mount(worktreeId: string | null): HTMLDivElement {
  return mountTarget(
    worktreeId === null ? null : { worktreeId, executionHostId: 'local', rootPath: null }
  )
}

function mountTarget(target: MentionTarget): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<Harness target={target} />))
  return container
}

function type(container: HTMLElement, text: string): HTMLElement {
  const box = container.querySelector<HTMLElement>('[role="textbox"]')
  if (!box) {
    throw new Error('Composer missing')
  }
  act(() => {
    promptEditor(box).commands.setContent(promptTextContent(text))
    // Not focus('end'): it refocuses the box a frame later, closing a row's tooltip.
    const editor = promptEditor(box)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  })
  return box
}

function keyDown(box: HTMLElement, key: string): void {
  act(() => {
    box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  mentionQueries.length = 0
  useAppStore.setState({ marketplaceApps: { status: 'loading' }, repos: [], worktreesByRepo: {} })
})

describe('CreateChatComposer @ files', () => {
  it('lists the picked worktree’s files after @, each with its file-type icon', () => {
    const container = mount('wt-1')
    type(container, 'Fix @rou')
    const options = [...container.querySelectorAll('[role="option"]')]
    expect(options).toHaveLength(2)
    expect(options[0]?.querySelector('svg.lucide-file-code')).not.toBeNull()
    expect(options[1]?.querySelector('svg.lucide-file-text')).not.toBeNull()
    expect(mentionQueries.at(-1)).toMatchObject({ query: 'rou', worktreeId: 'wt-1' })
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

  it('inserts the picked path on Enter as a chip without the @, instead of creating the session', () => {
    const container = mount('wt-1')
    const box = type(container, 'Fix @rou')
    keyDown(box, 'Enter')
    expect(promptValue(box)).toBe('Fix @src/shared/routine.ts ')
    const chip = box.querySelector('[data-native-chat-mention="src/shared/routine.ts"]')
    expect(chip?.textContent).toBe('src/shared/routine.ts')
    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })

  it('opens the menu below the box with room there, and above it near the window’s bottom', () => {
    expect(createChatMentionPlacement({ top: 100, bottom: 220 }, 900)).toBe('below')
    expect(createChatMentionPlacement({ top: 700, bottom: 820 }, 900)).toBe('above')
    expect(createChatMentionPlacement({ top: 40, bottom: 160 }, 300)).toBe('below')
    const container = mount('wt-1')
    const box = container.querySelector<HTMLElement>('.rounded-xl.border')
    if (!box) {
      throw new Error('Box missing')
    }
    box.getBoundingClientRect = () =>
      DOMRect.fromRect({
        x: 0,
        y: window.innerHeight - 150,
        width: 600,
        height: 120
      })
    type(container, 'Fix @rou')
    const listbox = container.querySelector('[role="listbox"]')
    expect(listbox?.className).toContain('bottom-full')
  })

  it('lists connected apps after the files under their headings, and inserts the app’s name', () => {
    useAppStore.setState({
      marketplaceApps: {
        status: 'ready',
        apps: [
          { id: 'engram', connected: true, agents: [] },
          { id: 'openmetadata', connected: false, agents: [] }
        ]
      }
    })
    const container = mount('wt-1')
    const box = type(container, 'Fix @')
    const listbox = container.querySelector('[role="listbox"]')
    const rows = [...(listbox?.children ?? [])].filter((row) => !row.matches('[aria-live]'))
    expect(rows.map((row) => row.textContent)).toEqual([
      'Files',
      expect.stringContaining('routine.ts'),
      expect.stringContaining('brief.md'),
      'Apps',
      'EngramInstalled from Marketplace'
    ])
    expect(listbox?.querySelector('svg.lucide-brain')).not.toBeNull()
    keyDown(box, 'ArrowUp')
    keyDown(box, 'Enter')
    expect(promptValue(box)).toBe('Fix @Engram ')
    const chip = box.querySelector('[data-native-chat-mention="Engram"]')
    expect(chip?.textContent).toBe('Engram')
    expect(chip?.querySelector('svg.lucide-brain')).not.toBeNull()
  })

  it('offers nothing without a project', () => {
    const container = mount(null)
    type(container, 'Fix @rou')
    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })

  it('lists a Local Windows project’s files on the picked host, before its worktrees load', () => {
    const repoPath = 'C:\\code\\app'
    useAppStore.setState({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the target reads only id and path.
      repos: [{ id: 'repo-1', path: repoPath }] as never,
      worktreesByRepo: {}
    })
    const targets: MentionTarget[] = []
    function Probe(): null {
      targets.push(
        useCreateChatMentionTarget({
          executionHostId: 'local',
          project: { kind: 'repo', repoId: 'repo-1' },
          workspaceMode: 'new-worktree',
          agent: 'claude',
          accessMode: 'default'
        })
      )
      return null
    }
    const probe = document.createElement('div')
    const root = createRoot(probe)
    mounted.push({ container: probe, root })
    act(() => root.render(<Probe />))
    const target = targets.at(-1) ?? null
    expect(target).toEqual({
      worktreeId: `repo-1::${repoPath}`,
      executionHostId: 'local',
      rootPath: repoPath
    })

    const container = mountTarget(target)
    type(container, 'Fix @rou')
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(2)
    expect(mentionQueries.at(-1)).toEqual({
      query: 'rou',
      worktreeId: `repo-1::${repoPath}`,
      executionHostId: 'local',
      rootPath: repoPath
    })
  })
})
