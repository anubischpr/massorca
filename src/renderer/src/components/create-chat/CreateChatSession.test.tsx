// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n'
import type { CreateChatOptions, CreateChatSubmitOutcome } from './create-chat-selection'

const mocks = vi.hoisted(() => ({
  submit: vi.fn().mockResolvedValue({ started: true })
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react')
  const OpenContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
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

vi.mock('@/lib/agent-catalog', () => ({
  getAgentCatalog: () => [
    { id: 'claude', label: 'Claude', cmd: 'claude' },
    { id: 'codex', label: 'Codex', cmd: 'codex' }
  ],
  AgentIcon: ({ agent }: { agent: string }) => <span data-testid="agent-icon">{agent}</span>
}))

vi.mock('./use-create-chat-model-catalog', () => ({
  useCreateChatModelCatalog: () => []
}))

import { CreateChatSession } from './CreateChatSession'

const options: CreateChatOptions = {
  hosts: [
    { id: 'local', label: 'This computer', detail: 'Runs on this machine', health: 'local' },
    { id: 'ssh:devbox', label: 'devbox', detail: 'SSH target', health: 'available' }
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
  agents: ['claude', 'codex'],
  preferredAgent: 'claude',
  projectlessDirectory: 'C:/Users/me/orca/chats'
}

const mountedRoots: Root[] = []

async function renderSession(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => {
    root.render(<CreateChatSession options={options} onSubmit={mocks.submit} />)
  })
  return container
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

function composer(container: ParentNode): HTMLTextAreaElement {
  const textarea = container.querySelector('textarea')
  if (!textarea) {
    throw new Error('Composer textarea not found')
  }
  return textarea
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function typeDraft(container: ParentNode, text: string): Promise<HTMLTextAreaElement> {
  const textarea = composer(container)
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  await act(async () => {
    setValue?.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return textarea
}

async function pressEnter(textarea: HTMLTextAreaElement, shiftKey: boolean): Promise<void> {
  await act(async () => {
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true }))
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

  it('renders the empty state and the default footer chips', async () => {
    const container = await renderSession()

    expect(container.textContent).toContain('What do you want to build?')
    expect(composer(container).getAttribute('placeholder')).toBe(
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
    await click(button(container, 'Workspace mode'))
    expect(menuItem(container, 'New worktree').disabled).toBe(true)
    expect(menuItem(container, 'Current checkout').disabled).toBe(true)
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
    expect(composer(container).value).toBe('Fix the login bug')
    expect(button(container, 'Create session').disabled).toBe(false)
  })
})
