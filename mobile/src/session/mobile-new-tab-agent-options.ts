import { GENTLE_SHELL_LABEL } from '../../../src/shared/agent-type-label'
import {
  type PiRuntimeSelection,
  selectedPiRuntime
} from '../../../src/shared/pi-runtime-selection'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import {
  filterEnabledMobileTuiAgents,
  isMobileTuiAgent,
  MOBILE_TUI_AGENT_AUTO_PICK_ORDER,
  MOBILE_TUI_AGENT_LABELS
} from '../tasks/mobile-tui-agents'

export type MobileNewTabAgentSettings = {
  defaultTuiAgent?: TuiAgent | 'blank' | null
  disabledTuiAgents?: unknown
  agentCmdOverrides?: Partial<Record<TuiAgent, unknown>> | null
}

export type MobileNewTabAgentOption = {
  agent: TuiAgent
  label: string
  /** Set on the Pi row only: the Pi runtime the host is configured for. */
  piRuntime?: PiRuntimeSelection
}

export function orderMobileNewTabAgents(
  defaultAgent: TuiAgent | 'blank' | null | undefined,
  detectedAgents: Iterable<unknown>,
  disabledAgents?: unknown
): TuiAgent[] {
  const detected = new Set([...detectedAgents].filter(isMobileTuiAgent))
  const enabledDetected = filterEnabledMobileTuiAgents(
    MOBILE_TUI_AGENT_AUTO_PICK_ORDER,
    disabledAgents
  ).filter((agent) => detected.has(agent))

  if (defaultAgent && defaultAgent !== 'blank' && enabledDetected.includes(defaultAgent)) {
    return [defaultAgent, ...enabledDetected.filter((agent) => agent !== defaultAgent)]
  }
  return enabledDetected
}

export function buildMobileNewTabAgentOptions(
  settings: MobileNewTabAgentSettings | null | undefined,
  detectedAgentIds: Iterable<unknown> | null
): MobileNewTabAgentOption[] {
  if (!detectedAgentIds) {
    return []
  }
  return orderMobileNewTabAgents(
    settings?.defaultTuiAgent,
    detectedAgentIds,
    settings?.disabledTuiAgents
  ).map((agent) => mobileNewTabAgentOption(agent, settings))
}

// Why: detection reports one 'pi' id for both Pi runtimes, so the row names the one the host runs.
function mobileNewTabAgentOption(
  agent: TuiAgent,
  settings: MobileNewTabAgentSettings | null | undefined
): MobileNewTabAgentOption {
  if (agent !== 'pi') {
    return { agent, label: MOBILE_TUI_AGENT_LABELS[agent] }
  }
  const command = settings?.agentCmdOverrides?.pi
  const piRuntime: PiRuntimeSelection =
    typeof command === 'string' ? selectedPiRuntime(command) : 'pi'
  return {
    agent,
    label: piRuntime === 'gentle-shell' ? GENTLE_SHELL_LABEL : MOBILE_TUI_AGENT_LABELS.pi,
    piRuntime
  }
}
