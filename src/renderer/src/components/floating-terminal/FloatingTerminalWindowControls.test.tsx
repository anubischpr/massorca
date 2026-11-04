import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReactModule from 'react'
import { toast } from 'sonner'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { resolveStructuredNativeChatSupport } from '../../../../shared/structured-native-chat-launch-route'
import {
  FLOATING_HOST_NO_WORKSPACE_REASON,
  FLOATING_HOST_THIS_COMPUTER
} from '@/lib/floating-workspace-host'
import { FloatingTerminalWindowControls } from './FloatingTerminalWindowControls'
import { FloatingHostSelect } from './host/FloatingHostSelect'

type ReactElementLike = {
  type: unknown
  props: Record<string, unknown>
}

const storeBox = vi.hoisted((): { state: Record<string, unknown> } => ({ state: {} }))

const hostBox = vi.hoisted((): { state: Record<string, unknown> } => ({ state: {} }))

const ownerBox = vi.hoisted((): { runtimeByWorktree: Record<string, string> } => ({
  runtimeByWorktree: {}
}))

const mocks = vi.hoisted(() => ({
  activateTab: vi.fn(),
  createTab: vi.fn(),
  setActiveTabForWorktree: vi.fn(),
  setTabBarOrder: vi.fn(),
  queueTabStartupCommand: vi.fn(),
  focusTerminalTabSurface: vi.fn(),
  launchAgentInNewTab: vi.fn(),
  showSessionInFloatingWorkspace: vi.fn(),
  awaitNewSessionTab: vi.fn(),
  chooseHost: vi.fn(),
  markHostUsed: vi.fn()
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactModule>('react')
  return {
    ...actual,
    useCallback: <T,>(callback: T) => callback,
    useMemo: <T,>(factory: () => T) => factory()
  }
})

vi.mock('@/store', () => ({
  useAppStore: Object.assign((selector: (state: unknown) => unknown) => selector(storeBox.state), {
    getState: () => storeBox.state
  })
}))

vi.mock('@/lib/floating-workspace-host-store', () => ({
  useFloatingWorkspaceHostStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector(hostBox.state),
    { getState: () => hostBox.state }
  )
}))

vi.mock('@/lib/worktree-runtime-owner', () => ({
  getRuntimeEnvironmentIdForWorktree: (_state: unknown, worktreeId: string | null | undefined) =>
    worktreeId ? (ownerBox.runtimeByWorktree[worktreeId] ?? null) : null
}))

vi.mock('@/lib/show-session-in-floating-workspace', () => ({
  showSessionInFloatingWorkspace: mocks.showSessionInFloatingWorkspace,
  awaitNewSessionTab: mocks.awaitNewSessionTab
}))

vi.mock('@/lib/focus-terminal-tab-surface', () => ({
  focusTerminalTabSurface: mocks.focusTerminalTabSurface
}))

vi.mock('@/lib/launch-agent-in-new-tab', () => ({
  launchAgentInNewTab: mocks.launchAgentInNewTab
}))

vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => 'unknown' }))

vi.mock('@/lib/agent-catalog', () => ({
  getAgentCatalog: () => [{ id: 'claude', label: 'Claude' }],
  getAgentDisplayLabel: (agent: string) => (agent === 'claude' ? 'Claude' : agent),
  AgentIcon: function AgentIcon() {
    return null
  }
}))

vi.mock('../../../../shared/tui-agent-selection', () => ({
  isTuiAgentEnabled: () => true
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, vars?: Record<string, string>) =>
    vars ? fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? '') : fallback
}))

vi.mock('@/hooks/useShortcutLabel', () => ({
  useOptionalShortcutLabel: () => null
}))

vi.mock('@/components/ui/button', () => ({
  Button: function Button(props: { children?: unknown }) {
    return props.children ?? null
  }
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: function Tooltip(props: { children?: unknown }) {
    return props.children
  },
  TooltipContent: function TooltipContent(props: { children?: unknown }) {
    return props.children
  },
  TooltipTrigger: function TooltipTrigger(props: { children?: unknown }) {
    return props.children
  }
}))

vi.mock('lucide-react', () => ({
  Maximize2: function Maximize2() {
    return null
  },
  Minimize2: function Minimize2() {
    return null
  },
  Minus: function Minus() {
    return null
  }
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() }
}))

function visit(node: unknown, cb: (node: ReactElementLike) => void): void {
  if (node == null || typeof node === 'string' || typeof node === 'number') {
    return
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => visit(entry, cb))
    return
  }
  const element = node as ReactElementLike
  if (!element.props) {
    return
  }
  cb(element)
  visit(element.props.children, cb)
}

function findOnClickByAriaLabel(node: unknown, ariaLabel: string): () => void {
  let found: (() => void) | null = null
  visit(node, (entry) => {
    if (entry.props['aria-label'] === ariaLabel && typeof entry.props.onClick === 'function') {
      found = entry.props.onClick as () => void
    }
  })
  if (!found) {
    throw new Error(`onClick for aria-label "${ariaLabel}" not found`)
  }
  return found
}

function findPropsByAriaLabel(node: unknown, ariaLabel: string): Record<string, unknown> {
  let found: Record<string, unknown> | null = null
  visit(node, (entry) => {
    if (entry.props['aria-label'] === ariaLabel) {
      found = entry.props
    }
  })
  if (!found) {
    throw new Error(`element with aria-label "${ariaLabel}" not found`)
  }
  return found
}

function isElementLike(node: unknown): node is ReactElementLike {
  return (
    typeof node === 'object' &&
    node !== null &&
    'props' in node &&
    typeof node.props === 'object' &&
    node.props !== null
  )
}

function containsText(node: unknown, text: string): boolean {
  if (typeof node === 'string') {
    return node === text
  }
  if (Array.isArray(node)) {
    return node.some((entry) => containsText(entry, text))
  }
  if (isElementLike(node)) {
    return containsText(node.props.children, text)
  }
  return false
}

function hasHostSelect(node: unknown): boolean {
  let found = false
  visit(node, (entry) => {
    if (entry.type === FloatingHostSelect) {
      found = true
    }
  })
  return found
}

const NEW_AGENT_TAB_ID = 'floating-agent-tab'
const EXISTING_TAB_ID = 'floating-existing-tab'
const VPS = 'env-vps'
const REMOTE_WORKSPACE = 'repo-a::/srv/app'

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
  mocks.launchAgentInNewTab.mockReturnValue({
    surface: { kind: 'local-terminal', tabId: NEW_AGENT_TAB_ID },
    startupPlan: { launchCommand: 'claude', launchConfig: {} },
    pasteDraftAfterLaunch: false
  })
  mocks.showSessionInFloatingWorkspace.mockReturnValue({ ok: true, groupId: 'floating-pane' })
  ownerBox.runtimeByWorktree = {}
  hostBox.state = {
    chosen: null,
    lastUsedHost: null,
    choose: mocks.chooseHost,
    markUsed: mocks.markHostUsed
  }
  storeBox.state = {
    settings: {
      defaultTuiAgent: 'claude',
      disabledTuiAgents: [],
      agentCmdOverrides: {},
      agentDefaultArgs: {},
      agentDefaultEnv: {}
    },
    createTab: mocks.createTab,
    activateTab: mocks.activateTab,
    setActiveTabForWorktree: mocks.setActiveTabForWorktree,
    setTabBarOrder: mocks.setTabBarOrder,
    queueTabStartupCommand: mocks.queueTabStartupCommand,
    tabsByWorktree: { [FLOATING_TERMINAL_WORKTREE_ID]: [{ id: EXISTING_TAB_ID }] },
    tabBarOrderByWorktree: { [FLOATING_TERMINAL_WORKTREE_ID]: [EXISTING_TAB_ID] },
    runtimeEnvironments: [],
    runtimeStatusByEnvironmentId: new Map(),
    activeWorktreeId: null,
    worktreesByRepo: {},
    unifiedTabsByWorktree: {}
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

function clickLaunch(): void {
  const element = FloatingTerminalWindowControls({
    maximized: false,
    onToggleMaximized: vi.fn(),
    onMinimize: vi.fn()
  })
  findOnClickByAriaLabel(element, 'Open Claude in floating workspace')()
}

function renderHeader(): unknown {
  return FloatingTerminalWindowControls({
    maximized: false,
    onToggleMaximized: vi.fn(),
    onMinimize: vi.fn()
  })
}

/** A paired server, with the focused workspace on it, and the host the person picked. */
function pairServer(args: {
  chosen: string | null
  focusedWorkspace: string | null
  owner: Record<string, string>
}): void {
  ownerBox.runtimeByWorktree = args.owner
  storeBox.state = {
    ...storeBox.state,
    runtimeEnvironments: [{ id: VPS, name: 'VPS' }],
    activeWorktreeId: args.focusedWorkspace,
    worktreesByRepo: {
      'repo-a': Object.keys(args.owner).map((id) => ({ id, repoId: 'repo-a', lastActivityAt: 1 }))
    }
  }
  hostBox.state = { ...hostBox.state, chosen: args.chosen }
}

describe('FloatingTerminalWindowControls default-agent launch', () => {
  it('launches through the shared agent launcher instead of driving tab startup itself', () => {
    clickLaunch()

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledExactlyOnceWith({
      requestId: expect.any(String),
      agent: 'claude',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      launchSource: 'shortcut',
      activate: false
    })
    // Why: the whole point of the migration. The shared launcher owns the startup plan and the
    // tab it lands in, so this button must not reach past it into the tab store.
    expect(mocks.createTab).not.toHaveBeenCalled()
    expect(mocks.queueTabStartupCommand).not.toHaveBeenCalled()
    expect(mocks.setTabBarOrder).not.toHaveBeenCalled()
  })

  it('activates the launched terminal tab so the floating panel selects and focuses it', () => {
    clickLaunch()

    // Why: the floating panel renders its visible tab from the unified group's
    // activeTabId, which only activateTab writes. setActiveTabForWorktree updates
    // the complementary legacy per-worktree map. Without activateTab the new agent
    // tab would be appended but never selected/focused.
    expect(mocks.setActiveTabForWorktree).toHaveBeenCalledWith(
      FLOATING_TERMINAL_WORKTREE_ID,
      NEW_AGENT_TAB_ID
    )
    expect(mocks.activateTab).toHaveBeenCalledWith(NEW_AGENT_TAB_ID)
    expect(mocks.focusTerminalTabSurface).toHaveBeenCalledWith(NEW_AGENT_TAB_ID)
  })

  it('reports a launch the shared launcher could not plan', () => {
    mocks.launchAgentInNewTab.mockReturnValue(null)

    clickLaunch()

    expect(toast.error).toHaveBeenCalledWith('Could not build launch command for Claude.')
    expect(mocks.activateTab).not.toHaveBeenCalled()
  })

  // Why: workspace kind no longer refuses the structured route — the floating session files under
  // its resolved directory like any workspace. Only capability negotiation can still say no here.
  it('routes the floating workspace by capability, not by workspace kind', () => {
    expect(
      resolveStructuredNativeChatSupport({
        agent: 'claude',
        executionHostId: 'local',
        hostCapabilities: null,
        workspaceKind: 'floating'
      })
    ).toEqual({ supported: false, blocker: 'runtime-capability-unknown' })
  })
})

describe('FloatingTerminalWindowControls host selection', () => {
  it('shows no host select when no host is paired', () => {
    expect(hasHostSelect(renderHeader())).toBe(false)
  })

  it('shows the host select when a host is paired', () => {
    pairServer({ chosen: null, focusedWorkspace: null, owner: {} })

    expect(hasHostSelect(renderHeader())).toBe(true)
  })

  it('launches the agent in the selected host workspace and shows it in the floating pane', () => {
    pairServer({
      chosen: VPS,
      focusedWorkspace: REMOTE_WORKSPACE,
      owner: { [REMOTE_WORKSPACE]: VPS }
    })

    clickLaunch()

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledExactlyOnceWith({
      requestId: expect.any(String),
      agent: 'claude',
      worktreeId: REMOTE_WORKSPACE,
      launchSource: 'shortcut',
      activate: false
    })
    expect(mocks.showSessionInFloatingWorkspace).toHaveBeenCalledWith(
      { worktreeId: REMOTE_WORKSPACE, tabId: NEW_AGENT_TAB_ID },
      expect.anything(),
      {}
    )
    expect(mocks.createTab).not.toHaveBeenCalled()
    expect(mocks.activateTab).not.toHaveBeenCalled()
  })

  it('keeps the agent on the floating workspace when This computer is selected', () => {
    pairServer({
      chosen: FLOATING_HOST_THIS_COMPUTER,
      focusedWorkspace: REMOTE_WORKSPACE,
      owner: { [REMOTE_WORKSPACE]: VPS }
    })

    clickLaunch()

    expect(mocks.launchAgentInNewTab).toHaveBeenCalledExactlyOnceWith({
      requestId: expect.any(String),
      agent: 'claude',
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      launchSource: 'shortcut',
      activate: false
    })
    expect(mocks.showSessionInFloatingWorkspace).not.toHaveBeenCalled()
  })

  it('disables the agent with the reason when the selected host has no workspace', () => {
    pairServer({ chosen: VPS, focusedWorkspace: null, owner: {} })

    const element = renderHeader()
    const props = findPropsByAriaLabel(element, 'Open Claude in floating workspace')

    expect(props.disabled).toBe(true)
    expect(props.onClick).toBeUndefined()
    expect(containsText(element, FLOATING_HOST_NO_WORKSPACE_REASON)).toBe(true)
    expect(mocks.launchAgentInNewTab).not.toHaveBeenCalled()
  })
})
