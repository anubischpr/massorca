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
  /** Set on the Pi rows only: the Pi runtime the row starts. */
  piRuntime?: PiRuntimeSelection
}

// Why: stock Pi lists before Gentle Shell, so the two rows keep one order on every host.
const PI_RUNTIME_ROW_ORDER: readonly PiRuntimeSelection[] = ['pi', 'gentle-shell']

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
  detectedAgentIds: Iterable<unknown> | null,
  piRuntimes?: readonly PiRuntimeSelection[] | null
): MobileNewTabAgentOption[] {
  if (!detectedAgentIds) {
    return []
  }
  return orderMobileNewTabAgents(
    settings?.defaultTuiAgent,
    detectedAgentIds,
    settings?.disabledTuiAgents
  ).flatMap((agent) =>
    agent === 'pi'
      ? piNewTabAgentOptions(settings, piRuntimes)
      : [{ agent, label: MOBILE_TUI_AGENT_LABELS[agent] }]
  )
}

// Why: detection reports one 'pi' id for both Pi runtimes, so the rows name the runtimes the host has.
// A host that names none keeps one row, labelled by the runtime its Command setting names.
function piNewTabAgentOptions(
  settings: MobileNewTabAgentSettings | null | undefined,
  piRuntimes: readonly PiRuntimeSelection[] | null | undefined
): MobileNewTabAgentOption[] {
  if (!piRuntimes?.length) {
    return [piRuntimeOption(legacyPiRuntime(settings))]
  }
  return PI_RUNTIME_ROW_ORDER.filter((runtime) => piRuntimes.includes(runtime)).map(piRuntimeOption)
}

/** The rows a prompt can launch. A prompt starts through agent.launch, which cannot name a Pi runtime:
 *  the host starts stock Pi whenever it has it, so Gentle Shell is offered only when stock Pi is absent. */
export function promptLaunchAgentOptions(
  options: readonly MobileNewTabAgentOption[]
): MobileNewTabAgentOption[] {
  const hasStockPi = options.some((option) => option.piRuntime === 'pi')
  return options.filter((option) => !(hasStockPi && option.piRuntime === 'gentle-shell'))
}

function piRuntimeOption(piRuntime: PiRuntimeSelection): MobileNewTabAgentOption {
  return {
    agent: 'pi',
    label: piRuntime === 'gentle-shell' ? GENTLE_SHELL_LABEL : MOBILE_TUI_AGENT_LABELS.pi,
    piRuntime
  }
}

function legacyPiRuntime(
  settings: MobileNewTabAgentSettings | null | undefined
): PiRuntimeSelection {
  const command = settings?.agentCmdOverrides?.pi
  return typeof command === 'string' ? selectedPiRuntime(command) : 'pi'
}
