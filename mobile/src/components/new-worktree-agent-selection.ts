import { GENTLE_SHELL_LABEL } from '../../../src/shared/agent-type-label'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { legacyPiRuntime, PI_RUNTIME_ROW_ORDER } from '../session/mobile-new-tab-agent-options'
import { MOBILE_AGENT_CATALOG } from '../tasks/mobile-agent-catalog'
import { isMobileTuiAgentEnabled } from '../tasks/mobile-tui-agents'
import { pickWorkspaceAgent } from '../tasks/workspace-agent-selection'

export type NewWorktreeRuntimeSettings = {
  defaultTuiAgent?: TuiAgent | 'blank' | null
  disabledTuiAgents?: TuiAgent[]
  agentCmdOverrides?: Partial<Record<TuiAgent, unknown>> | null
}

export type NewWorktreeAgentOption = {
  id: TuiAgent | '__blank__'
  label: string
  faviconDomain?: string
  /** Set on a Pi row only: the Pi runtime the row creates the workspace with. */
  piRuntime?: PiRuntimeSelection
}

export const NEW_WORKTREE_AGENT_OPTIONS: NewWorktreeAgentOption[] = MOBILE_AGENT_CATALOG

export const NEW_WORKTREE_BLANK_AGENT: NewWorktreeAgentOption = {
  id: '__blank__',
  label: 'Blank Terminal'
}

/** Pi rows share the `pi` id, so each row is told apart by a key that also names its runtime. */
export function newWorktreeAgentRowKey(option: NewWorktreeAgentOption): string {
  return option.piRuntime ? `${option.id}:${option.piRuntime}` : option.id
}

export function newWorktreeAgentOptionFor(id: string | null | undefined): NewWorktreeAgentOption {
  if (id === 'blank' || id === '__blank__') {
    return NEW_WORKTREE_BLANK_AGENT
  }
  return NEW_WORKTREE_AGENT_OPTIONS.find((agent) => agent.id === id) ?? NEW_WORKTREE_BLANK_AGENT
}

/** The picker's agent rows: the catalog filtered by detection and the enabled set, with the Pi entry
 *  split into one row per Pi runtime the host has. Detection still pending (null) lists the catalog. */
export function newWorktreeAgentRows(
  detectedAgentIds: Set<string> | null,
  piRuntimes: readonly PiRuntimeSelection[] | null,
  runtimeSettings: NewWorktreeRuntimeSettings | null
): NewWorktreeAgentOption[] {
  return NEW_WORKTREE_AGENT_OPTIONS.flatMap((agent) => {
    if (
      agent.id === '__blank__' ||
      (detectedAgentIds !== null && !detectedAgentIds.has(agent.id)) ||
      !isMobileTuiAgentEnabled(agent.id, runtimeSettings?.disabledTuiAgents)
    ) {
      return []
    }
    return agent.id === 'pi' ? piRuntimeRows(agent, piRuntimes, runtimeSettings) : [agent]
  })
}

// Why: a host that names no Pi runtime keeps one row, labelled by the runtime its Command setting names.
function piRuntimeRows(
  agent: NewWorktreeAgentOption,
  piRuntimes: readonly PiRuntimeSelection[] | null,
  runtimeSettings: NewWorktreeRuntimeSettings | null
): NewWorktreeAgentOption[] {
  const runtimes = piRuntimes?.length
    ? PI_RUNTIME_ROW_ORDER.filter((runtime) => piRuntimes.includes(runtime))
    : [legacyPiRuntime(runtimeSettings)]
  return runtimes.map((piRuntime) => ({
    ...agent,
    label: piRuntime === 'gentle-shell' ? GENTLE_SHELL_LABEL : agent.label,
    piRuntime
  }))
}

export function pickPreferredNewWorktreeAgent(
  settings: NewWorktreeRuntimeSettings | null,
  detectedAgentIds: Set<string> | null,
  rows: readonly NewWorktreeAgentOption[] = NEW_WORKTREE_AGENT_OPTIONS
): NewWorktreeAgentOption {
  const picked = pickWorkspaceAgent(
    {
      defaultTuiAgent: settings?.defaultTuiAgent,
      disabledTuiAgents: settings?.disabledTuiAgents
    },
    detectedAgentIds
  )
  // The first row for the picked agent: the stock Pi row before a Gentle Shell row.
  return rows.find((row) => row.id === picked) ?? newWorktreeAgentOptionFor(picked)
}

function isSelectableAgent(
  agent: NewWorktreeAgentOption,
  settings: NewWorktreeRuntimeSettings | null,
  detectedAgentIds: Set<string>,
  rows: readonly NewWorktreeAgentOption[]
): boolean {
  if (agent.id === '__blank__') {
    return true
  }
  return (
    isMobileTuiAgentEnabled(agent.id, settings?.disabledTuiAgents) &&
    detectedAgentIds.has(agent.id) &&
    rows.some((row) => newWorktreeAgentRowKey(row) === newWorktreeAgentRowKey(agent))
  )
}

export function resolveNewWorktreeAgentSelection({
  visible,
  selectedAgent,
  agentOverridden,
  runtimeSettings,
  detectedAgentIds,
  rows = NEW_WORKTREE_AGENT_OPTIONS
}: {
  visible: boolean
  selectedAgent: NewWorktreeAgentOption
  agentOverridden: boolean
  runtimeSettings: NewWorktreeRuntimeSettings | null
  detectedAgentIds: Set<string> | null
  rows?: readonly NewWorktreeAgentOption[]
}): { selectedAgent: NewWorktreeAgentOption; agentOverridden: boolean } {
  if (!visible) {
    return { selectedAgent, agentOverridden }
  }

  const preferred = pickPreferredNewWorktreeAgent(runtimeSettings, detectedAgentIds, rows)
  if (!agentOverridden) {
    return { selectedAgent: preferred, agentOverridden: false }
  }

  if (
    detectedAgentIds !== null &&
    !isSelectableAgent(selectedAgent, runtimeSettings, detectedAgentIds, rows)
  ) {
    return { selectedAgent: preferred, agentOverridden: false }
  }

  return { selectedAgent, agentOverridden: true }
}
