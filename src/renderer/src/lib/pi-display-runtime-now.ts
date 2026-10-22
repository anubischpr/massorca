import { useAppStore } from '@/store'
import type { PiRuntimeSelection } from '../../../shared/pi-runtime-selection'
import { resolvePiDisplayRuntime, type PiDisplayRuntime } from './pi-agent-display'
import { readHostPiRuntimeAnswer, requestHostPiRuntimeAnswer } from './pi-host-runtime-answer'
import { askHostPiRuntimeForWorktree } from './pi-terminal-host-runtime'

/**
 * The Pi runtime for a caller that is not a React component (a launch or a toast): the chat's recorded
 * runtime, else the configured Pi command, else the workspace host's cached answer, asked when none is cached.
 */
export function currentPiDisplayRuntime(
  options: { worktreeId?: string | null; chatRuntime?: PiRuntimeSelection } = {}
): PiDisplayRuntime {
  const state = useAppStore.getState()
  const worktreeId = options.worktreeId ?? state.activeWorktreeId ?? ''
  const command = state.settings?.agentCmdOverrides?.pi
  if (worktreeId && state.settings !== null && !command?.trim()) {
    requestHostPiRuntimeAnswer(worktreeId, askHostPiRuntimeForWorktree)
  }
  return resolvePiDisplayRuntime({
    hostRecorded: options.chatRuntime,
    command,
    hostAnswer: readHostPiRuntimeAnswer(worktreeId)
  })
}
