import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import {
  isPiRuntimeSelection,
  type PiRuntimeSelection
} from '../../../../shared/pi-runtime-selection'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { readHostApps } from './marketplace-apps-host-client'
import { detectWslAgents } from './marketplace-host-wsl'
import type { CatalogCheck, HostUnanswered } from './MarketplaceCatalogRows'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/** The git, GitHub CLI and GitLab CLI states a picked runtime host reports. */
export type RemoteTools = {
  git: boolean
  gh: { installed: boolean; authenticated: boolean }
  glab: { installed: boolean; authenticated: boolean } | undefined
}

/** Each read a picked host answers for the Marketplace rows. */
export type RemoteHostReads = {
  tools: CatalogCheck<RemoteTools>
  agents: CatalogCheck<ReadonlySet<string>>
  piRuntimes: CatalogCheck<readonly PiRuntimeSelection[]>
  skills: CatalogCheck<readonly DiscoveredSkill[]>
  apps: CatalogCheck<readonly MarketplaceAppStatus[]>
}

const RPC_TIMEOUT_MS = 30_000
const LOADING: HostUnanswered = { kind: 'loading' }
const FAILED: HostUnanswered = { kind: 'failed' }
const LOADING_READS: RemoteHostReads = {
  tools: LOADING,
  agents: LOADING,
  piRuntimes: LOADING,
  skills: LOADING,
  apps: LOADING
}
const FAILED_READS: RemoteHostReads = {
  tools: FAILED,
  agents: FAILED,
  piRuntimes: FAILED,
  skills: FAILED,
  apps: FAILED
}

const GhStateSchema = z.object({ installed: z.boolean(), authenticated: z.boolean() })
const ToolsAnswerSchema = z.object({
  git: z.object({ installed: z.boolean() }),
  gh: GhStateSchema,
  glab: GhStateSchema.optional()
})

function remoteHostKey(target: MarketplaceVaultHostTarget): string {
  switch (target.kind) {
    case 'ssh':
      return `ssh:${target.connectionId}`
    case 'wsl':
      return `wsl:${target.distro}`
    case 'runtime':
      return `runtime:${target.environmentId}`
  }
}

/** A host that predates a call answers it method_not_found, and a phone scope without it answers forbidden. */
function predatesCall(error: unknown): boolean {
  return (
    hasRuntimeRpcErrorCode(error, 'method_not_found') || hasRuntimeRpcErrorCode(error, 'forbidden')
  )
}

function failureOf(error: unknown): HostUnanswered {
  return predatesCall(error) ? { kind: 'update-required' } : FAILED
}

function answered<T>(value: T | null): CatalogCheck<T> {
  return value === null ? FAILED : { kind: 'ready', value }
}

function parseTools(answer: unknown): RemoteTools | null {
  const parsed = ToolsAnswerSchema.safeParse(answer)
  return parsed.success
    ? { git: parsed.data.git.installed, gh: parsed.data.gh, glab: parsed.data.glab }
    : null
}

function parseAgentIds(answer: unknown): ReadonlySet<string> | null {
  const parsed = z.array(z.string()).safeParse(answer)
  return parsed.success ? new Set(parsed.data) : null
}

function parsePiRuntimes(answer: unknown): readonly PiRuntimeSelection[] | null {
  const parsed = z.array(z.unknown()).safeParse(answer)
  return parsed.success ? parsed.data.filter(isPiRuntimeSelection) : null
}

async function readRuntimeCall<T>(
  environmentId: string,
  method: string,
  params: Record<string, unknown> | undefined,
  parse: (answer: unknown) => T | null
): Promise<CatalogCheck<T>> {
  try {
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId },
      method,
      params,
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    return answered(parse(answer))
  } catch (error) {
    return failureOf(error)
  }
}

async function readRuntimeSkills(
  environmentId: string
): Promise<CatalogCheck<readonly DiscoveredSkill[]>> {
  try {
    const result = await discoverSkillsForRuntimeTarget({ kind: 'environment', environmentId })
    return { kind: 'ready', value: result.skills }
  } catch (error) {
    return failureOf(error)
  }
}

async function readSshAgents(connectionId: string): Promise<CatalogCheck<ReadonlySet<string>>> {
  try {
    const ids: unknown = await window.api.preflight.detectRemoteAgents({ connectionId })
    return answered(parseAgentIds(ids))
  } catch {
    return FAILED
  }
}

async function readApps(
  target: MarketplaceVaultHostTarget
): Promise<CatalogCheck<readonly MarketplaceAppStatus[]>> {
  const result = await readHostApps(target)
  if (result.ok) {
    return { kind: 'ready', value: result.apps }
  }
  return result.reason === 'host-needs-update' ? { kind: 'update-required' } : FAILED
}

/** A WSL distro answers its git, GitHub CLI and agents through its own probes; the rest has no WSL path yet. */
async function readWslHostChecks(distro: string): Promise<RemoteHostReads> {
  const [tools, agents] = await Promise.all([readWslTools(distro), readWslAgents(distro)])
  return { ...FAILED_READS, tools, agents }
}

async function readWslTools(distro: string): Promise<CatalogCheck<RemoteTools>> {
  try {
    const status = await window.api.preflight.check({ wslDistro: distro })
    return { kind: 'ready', value: { git: status.git.installed, gh: status.gh, glab: status.glab } }
  } catch {
    return FAILED
  }
}

async function readWslAgents(distro: string): Promise<CatalogCheck<ReadonlySet<string>>> {
  try {
    return { kind: 'ready', value: new Set(await detectWslAgents(distro)) }
  } catch {
    return FAILED
  }
}

/**
 * Reads a picked host the way the phone does: the same preflight calls on a runtime host, its skills
 * and apps. An SSH host answers its agents through its own probe; what has no path there stays failed.
 */
export async function readRemoteHostChecks(
  target: MarketplaceVaultHostTarget
): Promise<RemoteHostReads> {
  if (target.kind === 'wsl') {
    return readWslHostChecks(target.distro)
  }
  if (target.kind === 'ssh') {
    const [agents, apps] = await Promise.all([readSshAgents(target.connectionId), readApps(target)])
    return { ...FAILED_READS, agents, apps }
  }
  const environmentId = target.environmentId
  const [tools, agents, piRuntimes, skills, apps] = await Promise.all([
    readRuntimeCall(environmentId, 'preflight.check', {}, parseTools),
    readRuntimeCall(environmentId, 'preflight.detectAgents', undefined, parseAgentIds),
    readRuntimeCall(environmentId, 'preflight.detectPiRuntimes', undefined, parsePiRuntimes),
    readRuntimeSkills(environmentId),
    readApps(target)
  ])
  return { tools, agents, piRuntimes, skills, apps }
}

/**
 * The picked host's reads: loading until that host answers, and never an earlier host's answer.
 * No target (this computer, or a host the catalog was not given) reads as failed, never as loading.
 */
export function useMarketplaceRemoteDetection(
  target: MarketplaceVaultHostTarget | null
): RemoteHostReads {
  const key = target === null ? null : remoteHostKey(target)
  const latest = useRef(target)
  const [answer, setAnswer] = useState<{ key: string; reads: RemoteHostReads } | null>(null)

  useEffect(() => {
    latest.current = target
  }, [target])

  useEffect(() => {
    const picked = latest.current
    if (picked === null) {
      return
    }
    const pickedKey = remoteHostKey(picked)
    let stale = false
    void readRemoteHostChecks(picked).then(
      (reads) => {
        if (!stale) {
          setAnswer({ key: pickedKey, reads })
        }
      },
      () => {
        if (!stale) {
          setAnswer({ key: pickedKey, reads: FAILED_READS })
        }
      }
    )
    return () => {
      stale = true
    }
  }, [key])

  if (target === null) {
    return FAILED_READS
  }
  return answer !== null && answer.key === key ? answer.reads : LOADING_READS
}
