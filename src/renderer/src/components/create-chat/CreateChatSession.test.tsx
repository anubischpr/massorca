// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n'
import { promptTextContent } from '../native-chat/native-chat-prompt-document'
import { promptEditor, promptValue } from '../native-chat/native-chat-prompt-editor.test-support'
import type { CreateChatOptions, CreateChatSubmitOutcome } from './create-chat-selection'

const mocks = vi.hoisted(() => ({
  submit: vi.fn().mockResolvedValue({ started: true })
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react')
  const OpenContext = React.createContext<{
    open: boolean
    setOpen: (open: boolean) => void
  }>({
    open: false,
    setOpen: () => {}
  })
  const RadioContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
  }>({ value: '', onValueChange: () => {} })
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => {
      const [open, setOpen] = React.useState(false)
      const openState = React.useMemo(() => ({ open, setOpen }), [open])
      return (
        <OpenContext.Provider value={openState}>
          <div>{children}</div>
        </OpenContext.Provider>
      )
    },
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => {
      const { open, setOpen } = React.useContext(OpenContext)
      return <div onClick={() => setOpen(!open)}>{children}</div>
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => {
      const { open } = React.useContext(OpenContext)
      return open ? <div role="menu">{children}</div> : null
    },
    DropdownMenuRadioGroup: ({
      value,
      onValueChange,
      children
    }: {
      value: string
      onValueChange: (value: string) => void
      children: ReactNode
    }) => {
      const radioState = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange])
      return (
        <RadioContext.Provider value={radioState}>
          <div>{children}</div>
        </RadioContext.Provider>
      )
    },
    DropdownMenuRadioItem: ({
      value,
      disabled,
      children
    }: {
      value: string
      disabled?: boolean
      children: ReactNode
    }) => {
      const radio = React.useContext(RadioContext)
      const { setOpen } = React.useContext(OpenContext)
      return (
        <button
          type="button"
          role="menuitemradio"
          aria-checked={radio.value === value}
          disabled={disabled}
          onClick={() => {
            radio.onValueChange(value)
            setOpen(false)
          }}
        >
          {children}
        </button>
      )
    },
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />
  }
})

vi.mock('@/lib/use-pi-runtime', () => ({
  usePiDisplayRuntime: () => 'unknown'
}))

vi.mock('@/lib/agent-catalog', () => ({
  getAgentCatalog: () => [
    { id: 'claude', label: 'Claude', cmd: 'claude' },
    { id: 'codex', label: 'Codex', cmd: 'codex' }
  ],
  getAgentDisplayLabel: (agent: string) => (agent === 'claude' ? 'Claude' : 'Codex'),
  AgentIcon: ({ agent }: { agent: string }) => <span data-testid="agent-icon">{agent}</span>
}))

vi.mock('./use-create-chat-agents', () => ({
  useCreateChatAgents: () => ({
    agents: ['claude', 'codex'],
    piRuntime: 'unknown',
    modelListingContext: null
  })
}))
vi.mock('./use-create-chat-model-catalog', () => ({
  useCreateChatModelCatalog: () => ({ status: 'none', models: [] })
}))

import { clearNativeChatDraftCacheForTests } from '@/components/native-chat/native-chat-draft-cache'
import { CreateChatSession } from './CreateChatSession'

const options: CreateChatOptions = {
  hosts: [
    {
      id: 'local',
      label: 'This computer',
      detail: 'Runs on this machine',
      health: 'local'
    },
    {
      id: 'ssh:devbox',
      label: 'devbox',
      detail: 'SSH target',
      health: 'available'
    }
  ],
  repos: [
    {
      repoId: 'repo-1',
      displayName: 'massorca',
      path: 'D:/projects/massorca',
      hostId: 'local',
      isFolder: false
    },
    {
      repoId: 'repo-folder',
      displayName: 'notes',
      path: 'D:/notes',
      hostId: 'local',
      isFolder: true
    },
    {
      repoId: 'repo-ssh',
      displayName: 'remote-app',
      path: '/srv/app',
      hostId: 'ssh:devbox',
      isFolder: false
    }
  ],
  preferredAgent: 'claude',
  projectlessDirectory: 'C:/Users/me/orca/chats',
  worktrees: [
    {
      worktreeId: 'wt-fix',
      repoId: 'repo-1',
      hostId: 'local',
      branch: 'fix-login-redirect',
      sessions: 2
    },
    {
      worktreeId: 'wt-artifact',
      repoId: 'repo-1',
      hostId: 'local',
      branch: 'improve-areas-artifact',
      sessions: 0
    },
    {
      worktreeId: 'wt-ssh',
      repoId: 'repo-ssh',
      hostId: 'ssh:devbox',
      branch: 'feature-x',
      sessions: null
    }
  ]
}

const TERMINAL_NOTICE =
  "Terminal view uses the agent's own interface. These will not be available in this session: Chat summary (Results, Subagents, Connectors, Background tasks) and the chat composer."

const mountedRoots: Root[] = []

async function renderSession(draftKey?: string): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => {
    root.render(<CreateChatSession options={options} onSubmit={mocks.submit} draftKey={draftKey} />)
  })
  return container
}

async function unmountAll(): Promise<void> {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) {
      root.unmount()
    }
  })
  document.body.innerHTML = ''
}

function button(container: ParentNode, name: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)
  if (!found) {
    throw new Error(`Button not found: ${name}`)
  }
  return found
}

function menuItem(container: ParentNode, label: string): HTMLButtonElement {
  const item = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
  ).find((candidate) => candidate.textContent?.includes(label))
  if (!item) {
    throw new Error(`Menu item not found: ${label}`)
  }
  return item
}

function composer(container: ParentNode): HTMLElement {
  const field = container.querySelector<HTMLElement>('[role="textbox"]')
  if (!field) {
    throw new Error('Composer field not found')
  }
  return field
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function typeDraft(container: ParentNode, text: string): Promise<HTMLElement> {
  const field = composer(container)
  await act(async () => {
    promptEditor(field).commands.setContent(promptTextContent(text))
    promptEditor(field).commands.focus('end')
  })
  return field
}

function requiredElement<T extends Element>(found: T | null, name: string): T {
  if (!found) {
    throw new Error(`${name} not found`)
  }
  return found
}

function sessionViewGroup(container: ParentNode): HTMLElement {
  return requiredElement(
    container.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Session view"]'),
    'Session view'
  )
}

function sessionViewOption(container: ParentNode, name: string): HTMLButtonElement {
  const found = Array.from(
    sessionViewGroup(container).querySelectorAll<HTMLButtonElement>('[role="radio"]')
  ).find((candidate) => candidate.textContent?.trim() === name)
  return requiredElement(found ?? null, `Session view option ${name}`)
}

function sessionViewFrame(container: ParentNode): HTMLElement {
  return requiredElement(sessionViewGroup(container).parentElement, 'Session view frame')
}

async function pressEnter(field: HTMLElement, shiftKey: boolean): Promise<void> {
  await act(async () => {
    field.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey,
        bubbles: true,
        cancelable: true
      })
    )
  })
}

describe('CreateChatSession', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of mountedRoots.splice(0)) {
        root.unmount()
      }
    })
    document.body.innerHTML = ''
  })

  it('keeps unsent text when the person clicks away and comes back', async () => {
    clearNativeChatDraftCacheForTests()
    await typeDraft(await renderSession('create'), 'half a thought')
    await unmountAll()

    expect(promptValue(composer(await renderSession('create')))).toBe('half a thought')
  })

  it('clears the kept text once the session starts', async () => {
    clearNativeChatDraftCacheForTests()
    const container = await renderSession('create')
    await typeDraft(container, 'Fix the login redirect')
    await click(button(container, 'Create session'))
    await unmountAll()

    expect(mocks.submit).toHaveBeenCalledWith('Fix the login redirect', expect.anything())
    expect(promptValue(composer(await renderSession('create')))).toBe('')
  })

  it('renders the empty state and the default footer chips', async () => {
    const container = await renderSession()

    expect(container.textContent).toContain('What do you want to build?')
    expect(composer(container).getAttribute('aria-label')).toBe(
      'Describe the task to start the session…'
    )
    expect(button(container, 'Location').textContent).toContain('This computer')
    expect(button(container, 'Project').textContent).toContain('massorca')
    expect(button(container, 'Workspace mode').textContent).toContain('New worktree')
    expect(button(container, 'Permissions').textContent).toContain('Ask for approval')
    expect(button(container, 'Agent, model and effort').textContent).toContain('Claude')
  })

  it('hides the workspace-mode chip once Work without a project is picked', async () => {
    const container = await renderSession()

    await click(button(container, 'Project'))
    await click(menuItem(container, 'Work without a project'))

    expect(container.querySelector('button[aria-label="Workspace mode"]')).toBeNull()
    expect(button(container, 'Project').textContent).toContain('Standalone chat')
    expect(button(container, 'Project').firstElementChild?.className).toContain('bg-accent')
  })

  it('disables Work without a project on an SSH location', async () => {
    const container = await renderSession()

    await click(button(container, 'Location'))
    await click(menuItem(container, 'devbox'))
    await click(button(container, 'Project'))

    expect(menuItem(container, 'Work without a project').disabled).toBe(true)
    expect(menuItem(container, 'Only available on this computer')).toBeDefined()
    expect(button(container, 'Project').textContent).toContain('remote-app')
  })

  it('shows No Git and disables worktree modes for a folder project', async () => {
    const container = await renderSession()

    await click(button(container, 'Project'))
    await click(menuItem(container, 'notes'))

    expect(button(container, 'Workspace mode').textContent).toContain('No Git')
    // Why: the canvas disables the chip itself for a folder, so its menu never opens.
    expect(button(container, 'Workspace mode').disabled).toBe(true)
    expect(container.querySelector('[role="menuitemradio"]')).toBeNull()
  })

  it('keeps send disabled while the draft is blank', async () => {
    const container = await renderSession()

    expect(button(container, 'Create session').disabled).toBe(true)
    await pressEnter(composer(container), false)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('submits the trimmed draft and selection from the send button', async () => {
    const container = await renderSession()
    await typeDraft(container, '  Fix the login bug  ')

    await click(button(container, 'Create session'))

    expect(mocks.submit).toHaveBeenCalledOnce()
    expect(mocks.submit).toHaveBeenCalledWith('Fix the login bug', {
      executionHostId: 'local',
      project: { kind: 'repo', repoId: 'repo-1' },
      workspaceMode: 'new-worktree',
      agent: 'claude',
      accessMode: 'default'
    })
  })

  it('submits on Enter but keeps Shift+Enter as a newline', async () => {
    const container = await renderSession()
    const textarea = await typeDraft(container, 'Add a test')

    await pressEnter(textarea, true)
    expect(mocks.submit).not.toHaveBeenCalled()

    await pressEnter(textarea, false)
    expect(mocks.submit).toHaveBeenCalledWith(
      'Add a test',
      expect.objectContaining({ agent: 'claude' })
    )
  })

  it('shows the warning tone for full access', async () => {
    const container = await renderSession()

    await click(button(container, 'Permissions'))
    await click(menuItem(container, 'Full access'))

    expect(button(container, 'Permissions').firstElementChild?.className).toContain(
      'text-status-warning'
    )
  })

  it('locks send and the chips while the launch runs, and never submits twice', async () => {
    let finish: ((outcome: CreateChatSubmitOutcome) => void) | undefined
    mocks.submit.mockReturnValueOnce(
      new Promise<CreateChatSubmitOutcome>((resolve) => {
        finish = resolve
      })
    )
    const container = await renderSession()
    const textarea = await typeDraft(container, 'Fix the login bug')

    await click(button(container, 'Create session'))
    await pressEnter(textarea, false)

    expect(mocks.submit).toHaveBeenCalledOnce()
    expect(button(container, 'Creating session').disabled).toBe(true)
    // Why: the chips are locked by their fieldset; happy-dom does not resolve :disabled through it.
    expect(button(container, 'Project').closest('fieldset')?.disabled).toBe(true)
    expect(container.textContent).toContain('Creating session…')

    await act(async () => {
      finish?.({ started: true })
    })
  })

  it('keeps the draft and shows the reason when the chat cannot start', async () => {
    mocks.submit.mockResolvedValueOnce({
      started: false,
      message: 'Could not open the workspace for this chat. Your draft is kept.'
    })
    const container = await renderSession()
    await typeDraft(container, 'Fix the login bug')

    await click(button(container, 'Create session'))

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Could not open the workspace for this chat. Your draft is kept.'
    )
    expect(promptValue(composer(container))).toBe('Fix the login bug')
    expect(button(container, 'Create session').disabled).toBe(false)
  })

  it('places Location, Project and Workspace mode above the composer and keeps Permissions in its footer', async () => {
    const container = await renderSession()
    const place = requiredElement(
      container.querySelector('[role="group"][aria-label="Where it runs"]'),
      'Where it runs group'
    )
    const box = requiredElement(
      composer(container).closest<HTMLElement>('.shadow-xs'),
      'composer box'
    )

    expect(place.contains(button(container, 'Location'))).toBe(true)
    expect(place.contains(button(container, 'Project'))).toBe(true)
    expect(place.contains(button(container, 'Workspace mode'))).toBe(true)
    expect(place.contains(button(container, 'Permissions'))).toBe(false)
    expect(box.contains(button(container, 'Permissions'))).toBe(true)
    expect(
      place.compareDocumentPosition(composer(container)) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  })

  it('lists the project worktrees under Existing worktrees with their session state', async () => {
    const container = await renderSession()

    await click(button(container, 'Workspace mode'))

    expect(container.textContent).toContain('Existing worktrees')
    expect(menuItem(container, 'fix-login-redirect').textContent).toContain('2 sessions')
    expect(menuItem(container, 'improve-areas-artifact').textContent).toContain('Not running')
    expect(container.textContent).not.toContain('feature-x')
  })

  it('creates the session in the picked existing worktree', async () => {
    const container = await renderSession()
    await click(button(container, 'Workspace mode'))
    await click(menuItem(container, 'fix-login-redirect'))
    expect(button(container, 'Workspace mode').textContent).toContain('fix-login-redirect')

    await typeDraft(container, 'Fix the login bug')
    await click(button(container, 'Create session'))

    expect(mocks.submit).toHaveBeenCalledWith(
      'Fix the login bug',
      expect.objectContaining({
        workspaceMode: 'existing-worktree',
        existingWorktreeId: 'wt-fix'
      })
    )
  })

  it('lists worktrees on a lost SSH host as unverifiable and not pickable', async () => {
    const container = await renderSession()
    await click(button(container, 'Location'))
    await click(menuItem(container, 'devbox'))

    await click(button(container, 'Workspace mode'))

    const lost = menuItem(container, 'feature-x')
    expect(lost.textContent).toContain('Unverifiable')
    expect(lost.disabled).toBe(true)
  })

  it('defaults the session view to Chat and lights the rainbow border on the switch only', async () => {
    const container = await renderSession()

    expect(sessionViewOption(container, 'Chat').getAttribute('aria-checked')).toBe('true')
    expect(sessionViewOption(container, 'Terminal').getAttribute('aria-checked')).toBe('false')
    expect(sessionViewFrame(container).classList.contains('chat-view-rainbow')).toBe(true)
    expect(container.querySelectorAll('.chat-view-rainbow')).toHaveLength(1)
    expect(composer(container).closest('.chat-view-rainbow')).toBeNull()
  })

  it('removes the border and shows the exact terminal notice when Terminal is picked', async () => {
    const container = await renderSession()

    await click(sessionViewOption(container, 'Terminal'))

    expect(sessionViewFrame(container).classList.contains('chat-view-rainbow')).toBe(false)
    expect(container.querySelector('[role="status"]')?.textContent).toBe(TERMINAL_NOTICE)
  })

  it('wobbles the switch and relights the border when going back to Chat', async () => {
    vi.useFakeTimers()
    try {
      const container = await renderSession()
      await click(sessionViewOption(container, 'Terminal'))

      await click(sessionViewOption(container, 'Chat'))

      expect(sessionViewFrame(container).classList.contains('chat-view-rainbow')).toBe(true)
      expect(sessionViewFrame(container).classList.contains('chat-view-wobble')).toBe(true)
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      expect(sessionViewFrame(container).classList.contains('chat-view-wobble')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('relights the border without a wobble when reduced motion is requested', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      })
    })
    try {
      const container = await renderSession()
      await click(sessionViewOption(container, 'Terminal'))

      await click(sessionViewOption(container, 'Chat'))

      expect(sessionViewFrame(container).classList.contains('chat-view-rainbow')).toBe(true)
      expect(sessionViewFrame(container).classList.contains('chat-view-wobble')).toBe(false)
    } finally {
      if (original) {
        Object.defineProperty(window, 'matchMedia', original)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('submits the Terminal choice as the session view', async () => {
    const container = await renderSession()
    await click(sessionViewOption(container, 'Terminal'))
    await typeDraft(container, 'Fix the login bug')

    await click(button(container, 'Create session'))

    expect(mocks.submit).toHaveBeenCalledWith(
      'Fix the login bug',
      expect.objectContaining({ sessionView: 'terminal' })
    )
  })
})
