import { useEffect, useMemo, useState } from 'react'
import type { ExecutionHostId } from '../../../src/shared/execution-host'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { buildHostLabelById } from '../../../src/shared/worktree/host-context-labels'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import { hostSshTargetSummariesRead } from '../host-screen/host-screen-operations'
import { isMobileTuiAgent } from '../tasks/mobile-tui-agents'
import type { RpcClient } from '../transport/rpc-client'
import { optionalSettingsRead } from '../transport/settings-read-operations'
import { repoHostId } from './create-session-model'

export type CreateSessionHostSettings = {
  preferredAgent: TuiAgent | null
  /** Raw persisted list; the mobile agent helpers discard anything that is not an array. */
  disabledAgents: unknown
  /** The Pi command the user set; undefined keeps the stock command. */
  piCommand: string | undefined
  hostLabelById: ReadonlyMap<ExecutionHostId, string>
}

const NO_LABELS: ReadonlyMap<ExecutionHostId, string> = new Map()

function readSettingsRecord(settings: unknown): Record<string, unknown> {
  // Boxed so a primitive settings value reads as absent members instead of throwing.
  const record: Record<string, unknown> = Object(settings)
  return record
}

/**
 * What the create screen needs from the host settings: the default agent, the disabled agents,
 * the Pi command and the names of the SSH hosts. Every read is decoration: a refusal leaves the defaults.
 */
export function useCreateSessionHostSettings(
  client: RpcClient | null,
  repos: readonly MobileWorkspaceRepo[]
): CreateSessionHostSettings {
  const [settings, setSettings] = useState<unknown>(undefined)
  const [sshTargets, setSshTargets] = useState<readonly { id: string; label: string }[]>([])
  const multipleHosts = new Set(repos.map(repoHostId)).size > 1

  useEffect(() => {
    if (!client) {
      return
    }
    let stale = false
    optionalSettingsRead
      .request(client)
      .then((reply) => {
        const verdict = optionalSettingsRead.interpret(reply)
        if (!stale && verdict.accepted) {
          setSettings(verdict.value)
        }
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [client])

  useEffect(() => {
    if (!client || !multipleHosts) {
      return
    }
    let stale = false
    hostSshTargetSummariesRead
      .request(client)
      .then((reply) => {
        const verdict = hostSshTargetSummariesRead.interpret(reply)
        if (!stale && verdict.accepted) {
          setSshTargets(verdict.value)
        }
      })
      .catch(() => undefined)
    return () => {
      stale = true
    }
  }, [client, multipleHosts])

  return useMemo(() => {
    const record = readSettingsRecord(settings)
    const preferred = record.defaultTuiAgent
    const overrides = readSettingsRecord(record.agentCmdOverrides)
    return {
      preferredAgent: isMobileTuiAgent(preferred) ? preferred : null,
      disabledAgents: record.disabledTuiAgents,
      piCommand: typeof overrides.pi === 'string' ? overrides.pi : undefined,
      hostLabelById: multipleHosts
        ? buildHostLabelById({
            sshTargets,
            hostSettingOverrides: record.hostSettingOverrides
          })
        : NO_LABELS
    }
  }, [settings, sshTargets, multipleHosts])
}
