import { useEffect, useSyncExternalStore } from 'react'
import { INSTALLED_AGENT_SKILLS_CHANGED_EVENT } from '@/hooks/installed-agent-skills-change-event'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import type { DiscoveredSkill } from '../../../../shared/skills'

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

function scan(target: RuntimeClientTarget): void {
  const key = targetKey(target)
  activeTarget = target
  const request = ++latestRequest
  // Why: a refresh keeps the rows on screen until the new scan lands.
  if (snapshot.key !== key || snapshot.state.status !== 'ready') {
    publish({ key, state: { status: 'loading' } })
  }
  discoverSkillsForRuntimeTarget(target).then(
    (result) => {
      if (request === latestRequest) {
        publish({ key, state: { status: 'ready', skills: result.skills } })
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
