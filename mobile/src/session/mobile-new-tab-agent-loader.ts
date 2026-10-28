import { newTabSettingsRead } from '../transport/settings-read-operations'
import {
  type MobileRuntimeRepoSummary,
  newTabRepoListRead,
  preflightDetectAgentsRead,
  preflightDetectPiRuntimesRead,
  preflightDetectRemoteAgentsRead,
  preflightDetectRemotePiRuntimesRead
} from './mobile-session-read-operations'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import { isFloatingWorkspaceWorktreeId } from './floating-workspace'
import { getRepoIdFromMobileWorktreeId } from './mobile-session-route-helpers'
import {
  buildMobileNewTabAgentOptions,
  type MobileNewTabAgentOption,
  type MobileNewTabAgentSettings
} from './mobile-new-tab-agent-options'
import {
  isPiRuntimeSelection,
  type PiRuntimeSelection
} from '../../../src/shared/pi-runtime-selection'

/** What a launch in this workspace can choose from: the host's settings, the agents detected on
 *  the workspace's execution host, the Pi runtimes it has (null when it did not say), and the
 *  workspace's repo (absent for the floating workspace). */
export type MobileAgentLaunchContext = {
  settings: unknown
  detectedAgents: unknown[]
  piRuntimes: PiRuntimeSelection[] | null
  repo: MobileRuntimeRepoSummary | null
}

export async function loadMobileAgentLaunchContext(args: {
  client: RpcClient
  worktreeId: string
}): Promise<MobileAgentLaunchContext> {
  const { client, worktreeId } = args
  // Started before the settings read, not inside the array: the detection request goes on the wire
  // first, and the recorded sender order is what says so.
  const detectedAgentsRequest = loadDetectedAgents(client, worktreeId)
  const [settingsResponse, detectedAgents] = await Promise.all([
    newTabSettingsRead.request(client),
    detectedAgentsRequest
  ])
  const readSettings = newTabSettingsRead.interpret(settingsResponse)
  // Interpreted after the group, not inside it: whichever peer failed first must not decide the
  // error the sheet shows, and main raised the detection refusal only once settings had settled.
  const detected = detectedAgents.interpret(detectedAgents.reply)
  // Asked only when the host reports pi: the answer says which of its two Pi runtimes it has.
  const piRuntimes = detected.includes('pi')
    ? await loadHostPiRuntimes(client, detectedAgents.connectionId)
    : null
  return {
    settings: readSettings(),
    detectedAgents: detected,
    piRuntimes,
    repo: detectedAgents.repo
  }
}

export async function loadMobileNewTabAgentOptions(args: {
  client: RpcClient
  worktreeId: string
}): Promise<MobileNewTabAgentOption[]> {
  const context = await loadMobileAgentLaunchContext(args)
  return buildMobileNewTabAgentOptions(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Preserve the established response shape at this boundary.
    context.settings as MobileNewTabAgentSettings | undefined,
    context.detectedAgents,
    context.piRuntimes
  )
}

/** The reply and the operation that reads it: two methods detect agents and each reads its own. */
type DetectedAgentsReply = {
  reply: RpcResponse
  interpret: (reply: RpcResponse) => unknown[]
  repo: MobileRuntimeRepoSummary | null
  /** The SSH connection the detection ran over; null for a local host. */
  connectionId: string | null
}

/** The Pi runtimes a host has, or null when it did not say. Advisory: a host that refuses the read,
 *  or predates it, leaves the Pi row as it was. */
export async function loadHostPiRuntimes(
  client: RpcClient,
  connectionId: string | null
): Promise<PiRuntimeSelection[] | null> {
  try {
    if (connectionId) {
      const accepted = preflightDetectRemotePiRuntimesRead.interpret(
        await preflightDetectRemotePiRuntimesRead.request(client, { connectionId })
      )
      return accepted.accepted ? accepted.value.filter(isPiRuntimeSelection) : null
    }
    const accepted = preflightDetectPiRuntimesRead.interpret(
      await preflightDetectPiRuntimesRead.request(client)
    )
    return accepted.accepted ? accepted.value.filter(isPiRuntimeSelection) : null
  } catch {
    return null
  }
}

async function loadDetectedAgents(
  client: RpcClient,
  worktreeId: string
): Promise<DetectedAgentsReply> {
  // Why: the floating workspace runs on the paired host, so it has no repo connection to resolve.
  if (isFloatingWorkspaceWorktreeId(worktreeId)) {
    return {
      reply: await preflightDetectAgentsRead.request(client),
      interpret: preflightDetectAgentsRead.interpret,
      repo: null,
      connectionId: null
    }
  }
  const repoResponse = await newTabRepoListRead.request(client)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Preserve the established response shape at this boundary.
  const repos = (newTabRepoListRead.interpret(repoResponse) as MobileRuntimeRepoSummary[]) ?? []
  const repoId = getRepoIdFromMobileWorktreeId(worktreeId)
  const repo = repos.find((candidate) => candidate.id === repoId)
  if (!repo) {
    throw new Error('worktree_repo_not_found')
  }
  const connectionId = repo.connectionId?.trim() || null
  return connectionId
    ? {
        reply: await preflightDetectRemoteAgentsRead.request(client, { connectionId }),
        interpret: preflightDetectRemoteAgentsRead.interpret,
        repo,
        connectionId
      }
    : {
        reply: await preflightDetectAgentsRead.request(client),
        interpret: preflightDetectAgentsRead.interpret,
        repo,
        connectionId: null
      }
}
