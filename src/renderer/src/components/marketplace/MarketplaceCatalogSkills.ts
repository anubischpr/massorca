import { useEffect, useSyncExternalStore } from 'react'
import { INSTALLED_AGENT_SKILLS_CHANGED_EVENT } from '@/hooks/installed-agent-skills-change-event'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { markMarketplaceManagedSkills } from './marketplace-managed-skills'

/** The skills on the host the Marketplace shows. */
export type MarketplaceInstalledSkills =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; skills: readonly DiscoveredSkill[] }

type Snapshot = { key: string | null; state: MarketplaceInstalledSkills }

// Why: the sidebar and the page both list skills; one shared scan keeps them on the same answer.
let snapshot: Snapshot = { key: null, state: { status: 'loading' } }
let activeTarget: RuntimeClientTarget | null = null
let latestRequest = 0
const listeners = new Set<() => void>()

function targetKey(target: RuntimeClientTarget): string {
  return target.kind === 'local' ? 'local' : `environment:${target.environmentId}`
}

function publish(next: Snapshot): void {
  snapshot = next
  for (const listener of listeners) {
    listener()
  }
}

/** The installs MassOrca placed on this target; a listing that fails or is unsupported reads as none. */
async function readManagedInstalls(
  target: RuntimeClientTarget
): Promise<readonly ManagedSkillInstall[]> {
  try {
    const operation = await window.api.skills.listManagedInstalls(
      target.kind === 'local' ? undefined : target.environmentId
    )
    return operation.status === 'ok' ? operation.value : []
  } catch (cause) {
    console.warn('[skills] managed install listing failed:', cause)
    return []
  }
}

function scan(target: RuntimeClientTarget): void {
  const key = targetKey(target)
  activeTarget = target
  const request = ++latestRequest
  // Why: a refresh keeps the rows on screen until the new scan lands.
  if (snapshot.key !== key || snapshot.state.status !== 'ready') {
    publish({ key, state: { status: 'loading' } })
  }
  // Why: a failed managed-install listing never fails the scan; its skills stay unmarked, so hidden.
  Promise.all([discoverSkillsForRuntimeTarget(target), readManagedInstalls(target)]).then(
    ([result, installs]) => {
      if (request === latestRequest) {
        const skills = markMarketplaceManagedSkills(result.skills, installs)
        publish({ key, state: { status: 'ready', skills } })
      }
    },
    () => {
      if (request === latestRequest) {
        publish({ key, state: { status: 'failed' } })
      }
    }
  )
}

function onInstalledSkillsChanged(): void {
  if (activeTarget !== null) {
    scan(activeTarget)
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, onInstalledSkillsChanged)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, onInstalledSkillsChanged)
    }
  }
}

function getSnapshot(): Snapshot {
  return snapshot
}

/** The installed skills the Marketplace lists; scanned once and rescanned after an install. */
export function useMarketplaceInstalledSkills(): MarketplaceInstalledSkills {
  const target = useActiveSkillDiscoveryRuntimeTarget()
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const key = target === null ? null : targetKey(target)
  useEffect(() => {
    if (target !== null && snapshot.key !== key) {
      scan(target)
    }
  }, [key, target])
  if (key === null || current.key !== key) {
    return { status: 'loading' }
  }
  return current.state
}

/** Test seam: forgets the shared scan so each test starts from a fresh read. */
export function resetMarketplaceInstalledSkillsForTests(): void {
  latestRequest += 1
  activeTarget = null
  snapshot = { key: null, state: { status: 'loading' } }
}
