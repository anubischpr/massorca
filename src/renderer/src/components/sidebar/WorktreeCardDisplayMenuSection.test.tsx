// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeCardDisplayMenuSection } from './WorktreeCardDisplayMenuSection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const setWorktreeCardMode = vi.fn()
const setWorktreeCardProperties = vi.fn()
const setAgentActivityDisplayMode = vi.fn()

let settings: {
  compactWorktreeCards: boolean
  experimentalNewWorktreeCardStyle: boolean
  worktreeCardLayout?: 'one-line' | 'detailed' | 'compact'
} = { compactWorktreeCards: false, experimentalNewWorktreeCardStyle: false }
let projectGroups: unknown[] = []
let worktreeCardProperties = [
  'status',
  'unread',
  'issue',
  'linear-issue',
  'jira-issue',
  'pr',
  'automation',
  'comment',
  'ports',
  'inline-agents'
]

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      agentActivityDisplayMode: 'compact',
      projectGroups,
      setAgentActivityDisplayMode,
      setWorktreeCardMode,
      setWorktreeCardProperties,
      settings,
      worktreeCardProperties
    })
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactModule = await import('react')
  type RadioItemProps = {
    children: ReactNode
    onSelect?: (event: { preventDefault: () => void }) => void
    onValueChange?: (value: string) => void
    value: string
  }
  return {
    DropdownMenuCheckboxItem: ({
      children,
      checked,
      onCheckedChange
    }: {
      children: ReactNode
      checked?: boolean
      onCheckedChange?: (checked: boolean) => void
    }) => (
      <button
        type="button"
        data-checked={checked ? 'true' : 'false'}
        onClick={() => onCheckedChange?.(!checked)}
      >
        {children}
      </button>
    ),
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuRadioGroup: ({
      children,
      onValueChange,
      value
    }: {
      children: ReactNode
      onValueChange?: (value: string) => void
      value?: string
    }) => (
      <div data-radio-group-value={value}>
        {ReactModule.Children.map(children, (child) =>
          ReactModule.isValidElement<RadioItemProps>(child)
            ? ReactModule.cloneElement(child, { onValueChange })
            : child
        )}
      </div>
    ),
    DropdownMenuRadioItem: ({ children, onSelect, onValueChange, value }: RadioItemProps) => (
      <button
        type="button"
        data-radio-item-value={value}
        onClick={() => {
          onSelect?.({ preventDefault: vi.fn() })
          onValueChange?.(value)
        }}
      >
        {children}
      </button>
    ),
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

function renderMenu(): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<WorktreeCardDisplayMenuSection preserveWorkspaceBoardOpen={false} />)
  })
}

beforeEach(() => {
  settings = { compactWorktreeCards: false, experimentalNewWorktreeCardStyle: false }
  projectGroups = []
  worktreeCardProperties = [
    'status',
    'unread',
    'issue',
    'linear-issue',
    'jira-issue',
    'pr',
    'automation',
    'comment',
    'ports',
    'inline-agents'
  ]
  setAgentActivityDisplayMode.mockReset()
  setWorktreeCardMode.mockReset()
  setWorktreeCardProperties.mockReset()
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  container?.remove()
  container = null
  document.body.innerHTML = ''
})

describe('WorktreeCardDisplayMenuSection', () => {
  const clickLayout = (selectedValue: string, itemValue: string): void => {
    const button = document.querySelector<HTMLButtonElement>(
      `[data-radio-group-value="${selectedValue}"] [data-radio-item-value="${itemValue}"]`
    )
    expect(button).not.toBeNull()
    act(() => {
      button?.click()
    })
  }

  it('selects the one-line layout when no layout was ever chosen', () => {
    renderMenu()

    expect(
      document.querySelector(
        '[data-radio-group-value="one-line"] [data-radio-item-value="detailed"]'
      )
    ).not.toBeNull()
    expect(
      document.querySelector(
        '[data-radio-group-value="one-line"] [data-radio-item-value="compact"]'
      )
    ).not.toBeNull()
  })

  it('applies the compact card mode preset from the visible card layout menu', () => {
    renderMenu()

    clickLayout('one-line', 'compact')

    expect(setWorktreeCardMode).toHaveBeenCalledWith('Compact')
  })

  it('keeps Detailed selectable and applies its preset', () => {
    renderMenu()

    clickLayout('one-line', 'detailed')

    expect(setWorktreeCardMode).toHaveBeenCalledWith('Default')
  })

  it('shows a persisted Detailed choice as selected and can return to one line', () => {
    settings = {
      compactWorktreeCards: false,
      experimentalNewWorktreeCardStyle: false,
      worktreeCardLayout: 'detailed'
    }
    renderMenu()

    clickLayout('detailed', 'one-line')

    expect(setWorktreeCardMode).toHaveBeenCalledWith('OneLine')
  })

  it('keeps branch-only copy when project groups are unavailable', () => {
    settings = { compactWorktreeCards: false, experimentalNewWorktreeCardStyle: true }

    renderMenu()

    expect(container?.textContent).toContain('Branch name')
    expect(container?.textContent).not.toContain('Branch / folder path')
  })

  it('mentions folder paths when project groups can create folder workspaces', () => {
    settings = { compactWorktreeCards: false, experimentalNewWorktreeCardStyle: true }
    projectGroups = [{ id: 'group-1' }]

    renderMenu()

    expect(container?.textContent).toContain('Branch / folder path')
    expect(container?.textContent).not.toContain('Branch name')
  })
})
