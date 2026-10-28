import { useState } from 'react'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import {
  NEW_WORKTREE_AGENT_OPTIONS,
  NEW_WORKTREE_BLANK_AGENT,
  newWorktreeAgentRowKey,
  newWorktreeAgentRows,
  resolveNewWorktreeAgentSelection,
  type NewWorktreeAgentOption,
  type NewWorktreeRuntimeSettings
} from './new-worktree-agent-selection'

export function useNewWorkspaceAgentSelection(args: {
  visible: boolean
  runtimeSettings: NewWorktreeRuntimeSettings | null
  detectedAgentIds: Set<string> | null
  detectedPiRuntimes: readonly PiRuntimeSelection[] | null
}): {
  selectedAgent: NewWorktreeAgentOption
  setSelectedAgent: (agent: NewWorktreeAgentOption) => void
  setAgentOverridden: (overridden: boolean) => void
  pickerAgentOptions: NewWorktreeAgentOption[]
} {
  const [selectedAgentState, setSelectedAgent] = useState<NewWorktreeAgentOption>(
    NEW_WORKTREE_AGENT_OPTIONS[0]!
  )
  const [agentOverriddenState, setAgentOverridden] = useState(false)
  const rows = newWorktreeAgentRows(
    args.detectedAgentIds,
    args.detectedPiRuntimes,
    args.runtimeSettings
  )
  const resolution = resolveNewWorktreeAgentSelection({
    visible: args.visible,
    selectedAgent: selectedAgentState,
    agentOverridden: agentOverriddenState,
    runtimeSettings: args.runtimeSettings,
    detectedAgentIds: args.detectedAgentIds,
    rows
  })
  if (
    newWorktreeAgentRowKey(selectedAgentState) !==
      newWorktreeAgentRowKey(resolution.selectedAgent) ||
    agentOverriddenState !== resolution.agentOverridden
  ) {
    setSelectedAgent(resolution.selectedAgent)
    setAgentOverridden(resolution.agentOverridden)
  }
  return {
    selectedAgent: resolution.selectedAgent,
    setSelectedAgent,
    setAgentOverridden,
    pickerAgentOptions: [...rows, NEW_WORKTREE_BLANK_AGENT]
  }
}
