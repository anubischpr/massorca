import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { useCallback, useMemo } from 'react'
import { Maximize2, Minimize2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAgentDisplayLabel, AgentIcon } from '@/lib/agent-catalog'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import {
  DEFAULT_DISABLED_TUI_AGENTS,
  isTuiAgentEnabled
} from '../../../../shared/tui-agent-selection'
import { translate } from '@/i18n/i18n'
import { useOptionalShortcutLabel } from '@/hooks/useShortcutLabel'
import {
  FLOATING_HOST_NO_WORKSPACE_REASON,
  FLOATING_HOST_THIS_COMPUTER
} from '@/lib/floating-workspace-host'
import { launchAgentOnHostWorkspace } from '@/lib/floating-workspace-host-session'
import { FloatingHostSelect } from './host/FloatingHostSelect'
import { useFloatingHostSelection } from './host/use-floating-host-selection'

type FloatingTerminalWindowControlsProps = {
  maximized: boolean
  onToggleMaximized: () => void
  onMinimize: () => void
}

const controlButtonClassName =
  'border-border bg-secondary text-secondary-foreground shadow-xs hover:bg-accent hover:text-accent-foreground'

// Why: matches the repo convention (e.g. ReviewPRViewAnimatedVisual) of
// surfacing the live keybinding in a tooltip as "Label (shortcut)", while
// degrading to a bare label when the action is unbound (default on Win/Linux,
// and for minimize on every platform).
function withShortcutHint(label: string, shortcutLabel: string | null): string {
  return shortcutLabel ? `${label} (${shortcutLabel})` : label
}

export function FloatingTerminalWindowControls({
  maximized,
  onToggleMaximized,
  onMinimize
}: FloatingTerminalWindowControlsProps): React.JSX.Element {
  const defaultTuiAgent = useAppStore((s) => s.settings?.defaultTuiAgent ?? null)
  const piRuntime = usePiDisplayRuntime({ enabled: defaultTuiAgent === 'pi' })
  const setActiveTabForWorktree = useAppStore((s) => s.setActiveTabForWorktree)
  const activateTab = useAppStore((s) => s.activateTab)
  const maximizeShortcutLabel = useOptionalShortcutLabel('floatingWorkspace.maximize')
  const minimizeShortcutLabel = useOptionalShortcutLabel('floatingWorkspace.minimize')
  const hostSelection = useFloatingHostSelection()
  const {
    selectedHost,
    environments,
    statuses,
    chooseHost,
    remoteWorkspaceId,
    hostHasNoWorkspace
  } = hostSelection
  const hasPairedHost = environments.length > 0

  const disabledTuiAgents = useAppStore(
    (s) => s.settings?.disabledTuiAgents ?? DEFAULT_DISABLED_TUI_AGENTS
  )
  const defaultAgent =
    defaultTuiAgent &&
    defaultTuiAgent !== 'blank' &&
    isTuiAgentEnabled(defaultTuiAgent, disabledTuiAgents)
      ? defaultTuiAgent
      : null
  const defaultAgentLabel = useMemo(
    () => (defaultAgent ? getAgentDisplayLabel(defaultAgent, piRuntime) : null),
    [defaultAgent, piRuntime]
  )

  const launchDefaultAgent = useCallback(() => {
    if (!defaultAgent) {
      return
    }
    if (selectedHost !== FLOATING_HOST_THIS_COMPUTER) {
      if (remoteWorkspaceId) {
        launchAgentOnHostWorkspace(
          defaultAgent,
          defaultAgentLabel ?? defaultAgent,
          remoteWorkspaceId,
          selectedHost
        )
      }
      return
    }
    // Why: the shared launcher owns the startup plan, the route and the tab identity, so this
    // button stays one more caller of it rather than a second copy of new-agent-tab startup.
    // Floating resolves the terminal-backed lane: a chat view over a PTY when the chat default is
    // on, never a structured session.
    const result = launchAgentInNewTab({
      requestId: newAgentLaunchRequestId(),
      agent: defaultAgent,
      worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
      launchSource: 'shortcut',
      // Why: `agent-auto-ack-targets` relies on the floating panel's active tab never becoming the
      // global `activeTabId`; activating here would also flip the main view off an open editor.
      // This selects within the floating group below instead.
      activate: false
    })
    if (!result) {
      toast.error(
        translate(
          'auto.components.floating.terminal.FloatingTerminalWindowControls.82da3701e7',
          'Could not build launch command for {{value0}}.',
          { value0: defaultAgentLabel ?? defaultAgent }
        )
      )
      return
    }
    if (result.surface.kind !== 'local-terminal') {
      return
    }
    // Why: the floating panel renders its visible tab from the unified group's
    // activeTabId. setActiveTabForWorktree only writes activeTabIdByWorktree, so
    // the new agent tab would be appended but never selected/focused. activateTab
    // selects it within the group, matching the empty-state tab creators.
    setActiveTabForWorktree(FLOATING_TERMINAL_WORKTREE_ID, result.surface.tabId)
    activateTab(result.surface.tabId)
    focusTerminalTabSurface(result.surface.tabId)
  }, [
    activateTab,
    defaultAgent,
    defaultAgentLabel,
    remoteWorkspaceId,
    selectedHost,
    setActiveTabForWorktree
  ])

  return (
    <div className="flex items-center gap-1 px-2" data-floating-terminal-no-drag>
      {hasPairedHost ? (
        <FloatingHostSelect
          value={selectedHost}
          environments={environments}
          statuses={statuses}
          onValueChange={chooseHost}
        />
      ) : null}
      {defaultAgent ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className={controlButtonClassName}
              aria-label={translate(
                'auto.components.floating.terminal.FloatingTerminalWindowControls.648352c51f',
                'Open {{value0}} in floating workspace',
                { value0: defaultAgentLabel ?? defaultAgent }
              )}
              disabled={hostHasNoWorkspace}
              onClick={hostHasNoWorkspace ? undefined : launchDefaultAgent}
            >
              <AgentIcon agent={defaultAgent} size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {hostHasNoWorkspace
              ? translate(
                  'components.floatingWorkspace.noWorkspaceOnHost',
                  FLOATING_HOST_NO_WORKSPACE_REASON
                )
              : translate(
                  'auto.components.floating.terminal.FloatingTerminalWindowControls.648352c51f',
                  'Open {{value0}} in floating workspace',
                  { value0: defaultAgentLabel ?? defaultAgent }
                )}
          </TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className={controlButtonClassName}
            aria-label={
              maximized
                ? translate(
                    'auto.components.floating.terminal.FloatingTerminalWindowControls.1c79cba25d',
                    'Restore floating workspace'
                  )
                : translate(
                    'auto.components.floating.terminal.FloatingTerminalWindowControls.3f4ca29961',
                    'Maximize floating workspace'
                  )
            }
            aria-pressed={maximized}
            onClick={onToggleMaximized}
          >
            {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {maximized
            ? withShortcutHint(
                translate(
                  'auto.components.floating.terminal.FloatingTerminalWindowControls.b5686fee1e',
                  'Restore'
                ),
                maximizeShortcutLabel
              )
            : withShortcutHint(
                translate(
                  'auto.components.floating.terminal.FloatingTerminalWindowControls.109870e023',
                  'Maximize'
                ),
                maximizeShortcutLabel
              )}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className={controlButtonClassName}
            aria-label={translate(
              'auto.components.floating.terminal.FloatingTerminalWindowControls.1bbaa0302f',
              'Minimize floating workspace'
            )}
            onClick={onMinimize}
          >
            <Minus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {withShortcutHint(
            translate(
              'auto.components.floating.terminal.FloatingTerminalWindowControls.2f6054342c',
              'Minimize'
            ),
            minimizeShortcutLabel
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
