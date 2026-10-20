import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { PiRuntimeSelection } from '../../../shared/pi-runtime-selection'
import { resolvePiDisplayRuntime, type PiDisplayRuntime } from './pi-agent-display'
import { requestHostPiRuntimeAnswer, useHostPiRuntimeAnswer } from './pi-host-runtime-answer'
import { askHostPiRuntimeForWorktree } from './pi-terminal-host-runtime'

export type PiDisplayRuntimeOptions = {
  /** False for a non-Pi row, so no host is asked on its behalf. */
  enabled?: boolean
  /** The workspace whose host answers; defaults to the active workspace. */
  worktreeId?: string | null
  /** The chat's recorded runtime; it is final and wins over every other evidence. */
  chatRuntime?: PiRuntimeSelection | undefined
}

/**
 * The Pi runtime a label or icon should name: the chat's recorded runtime, else the configured Pi command,
 * else the workspace host's answer (asked once and cached), else `unknown`.
 */
export function usePiDisplayRuntime(options: PiDisplayRuntimeOptions = {}): PiDisplayRuntime {
  const enabled = options.enabled ?? true
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const worktreeId = enabled ? (options.worktreeId ?? activeWorktreeId ?? '') : ''
  const settingsLoaded = useAppStore((state) => state.settings !== null)
  const command = useAppStore((state) => state.settings?.agentCmdOverrides?.pi)
  const hostAnswer = useHostPiRuntimeAnswer(worktreeId)
  const commandSet = Boolean(command?.trim())
  useEffect(() => {
    if (worktreeId && settingsLoaded && !commandSet) {
      requestHostPiRuntimeAnswer(worktreeId, askHostPiRuntimeForWorktree)
    }
  }, [worktreeId, settingsLoaded, commandSet])
  return resolvePiDisplayRuntime({
    hostRecorded: options.chatRuntime,
    command,
    hostAnswer
  })
}
