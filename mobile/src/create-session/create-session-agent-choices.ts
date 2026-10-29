import { GENTLE_SHELL_LABEL } from '../../../src/shared/agent-type-label'
import {
  isPiRuntimeSelection,
  selectedPiRuntime,
  type PiRuntimeSelection
} from '../../../src/shared/pi-runtime-selection'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import type { CreateSessionSelection } from './create-session-model'

/** One row of the agent sheet. A Pi row names its runtime, so Gentle Shell and stock Pi are two rows. */
export type CreateSessionAgentChoice = {
  value: string
  agent: TuiAgent
  /** The Pi runtime the row runs; null for an agent that is not Pi. */
  piRuntime: PiRuntimeSelection | null
  label: string
}

export type CreateSessionAgentChoiceInputs = {
  catalog: readonly { id: TuiAgent; label: string }[]
  /** The agents the host found; null while detection is still running. */
  detectedAgentIds: ReadonlySet<string> | null
  isEnabled: (agent: TuiAgent) => boolean
  /** The Pi runtimes the host reported; null or empty when it reported none, as an older host does. */
  piRuntimes: readonly PiRuntimeSelection[] | null
  /** The Pi command the user set, which names the one runtime a host without a report would start. */
  piCommand: string | undefined
}

const PI_RUNTIME_LABELS: Readonly<Record<PiRuntimeSelection, string>> = {
  pi: 'Pi',
  'gentle-shell': GENTLE_SHELL_LABEL
}

export function piRuntimeChoiceLabel(runtime: PiRuntimeSelection): string {
  return PI_RUNTIME_LABELS[runtime]
}

/** The value a sheet row and the selection share: the agent id, or the Pi agent with its runtime. */
export function createSessionAgentChoiceValue(
  agent: TuiAgent,
  piRuntime: PiRuntimeSelection | null
): string {
  return piRuntime === null ? agent : `${agent}:${piRuntime}`
}

/** The Pi runtimes a host reported; unknown entries are dropped. Null when the answer is not a list. */
export function readPiRuntimeReport(value: unknown): PiRuntimeSelection[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const runtimes: PiRuntimeSelection[] = []
  for (const entry of value) {
    if (isPiRuntimeSelection(entry) && !runtimes.includes(entry)) {
      runtimes.push(entry)
    }
  }
  return runtimes
}

function piRowRuntimes(inputs: CreateSessionAgentChoiceInputs): readonly PiRuntimeSelection[] {
  // Why: Pi is detected here, so a host that reports no runtime still gets one row, named by the command.
  return inputs.piRuntimes && inputs.piRuntimes.length > 0
    ? inputs.piRuntimes
    : [selectedPiRuntime(inputs.piCommand)]
}

/** The agent sheet's rows: Pi splits into one row per runtime the host reports. */
export function buildCreateSessionAgentChoices(
  inputs: CreateSessionAgentChoiceInputs
): CreateSessionAgentChoice[] {
  const choices: CreateSessionAgentChoice[] = []
  for (const entry of inputs.catalog) {
    const detected = inputs.detectedAgentIds === null || inputs.detectedAgentIds.has(entry.id)
    if (!detected || !inputs.isEnabled(entry.id)) {
      continue
    }
    if (entry.id !== 'pi') {
      choices.push({ value: entry.id, agent: entry.id, piRuntime: null, label: entry.label })
      continue
    }
    for (const piRuntime of piRowRuntimes(inputs)) {
      choices.push({
        value: createSessionAgentChoiceValue('pi', piRuntime),
        agent: 'pi',
        piRuntime,
        label: piRuntimeChoiceLabel(piRuntime)
      })
    }
  }
  return choices
}

/** Keeps the row the selection names; else the same agent's row, the preferred agent's, else the first. */
export function withAvailableCreateSessionChoice(
  selection: CreateSessionSelection,
  choices: readonly CreateSessionAgentChoice[],
  preferred: TuiAgent | null
): CreateSessionSelection {
  const first = choices[0]
  if (first === undefined) {
    return selection.agent === null && selection.piRuntime === null
      ? selection
      : { ...selection, agent: null, piRuntime: null }
  }
  const stillListed = choices.some(
    (choice) => choice.agent === selection.agent && choice.piRuntime === selection.piRuntime
  )
  if (stillListed) {
    return selection
  }
  const chosen =
    choices.find((choice) => choice.agent === selection.agent) ??
    choices.find((choice) => choice.agent === preferred) ??
    first
  return { ...selection, agent: chosen.agent, piRuntime: chosen.piRuntime }
}
