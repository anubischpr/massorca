import { useEffect, useMemo, useState } from 'react'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedProposal,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import {
  prototypeSessionScopeKey,
  prototypeSetsOfSession,
  type PrototypeSessionScope
} from '../../../../shared/prototype-session-sets'
import { listPrototypeSetsFromAllHosts } from './prototype-host-targets'

const POLL_MS = 10_000

/** What the shared poll last read from every host: the sets, the design systems and the proposals. */
type Listing = {
  sets: readonly PrototypeListedSet[]
  designSystems: readonly PrototypeListedDesignSystem[]
  proposals: readonly PrototypeListedProposal[]
}

type Listener = (listing: Listing) => void

// One shared poll for every chat link card on screen, so many cards cost one list per host.
const listeners = new Set<Listener>()
let latest: Listing = { sets: [], designSystems: [], proposals: [] }
let timer: number | null = null

function refresh(): void {
  void listPrototypeSetsFromAllHosts().then((listed) => {
    if (listed.answered) {
      latest = {
        sets: listed.sets,
        designSystems: listed.designSystems,
        proposals: listed.proposals
      }
      listeners.forEach((listener) => listener(latest))
    }
  })
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    refresh()
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

/** The listed set of one request, once its agent has written a direction; null until then. */
export function usePrototypeSetForRequest(requestId: string): PrototypeListedSet | null {
  const [listing, setListing] = useState<Listing>(latest)
  useEffect(() => subscribe(setListing), [])
  return listing.sets.find((set) => set.requestId === requestId) ?? null
}

/** The sets a delegated child chat made, newest first, so its finish notice in the parent can open them. */
export function usePrototypeSetsOfChildSession(
  childSessionId: string | null
): readonly PrototypeListedSet[] {
  const [listing, setListing] = useState<Listing>(latest)
  useEffect(() => subscribe(setListing), [])
  return useMemo(
    () =>
      childSessionId === null
        ? []
        : listing.sets
            .filter((set) => set.sessionId === childSessionId)
            .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [listing.sets, childSessionId]
  )
}

/**
 * The sets a session made itself or through its delegated children, newest first; a bot's Conference room
 * post for a task renders one `PrototypeSetLinkCard` per set. Null scope lists nothing.
 */
export function usePrototypeSetsOfSession(
  scope: PrototypeSessionScope | null
): readonly PrototypeListedSet[] {
  const [listing, setListing] = useState<Listing>(latest)
  useEffect(() => subscribe(setListing), [])
  // Why a key: callers pass a fresh scope object each render.
  const key = prototypeSessionScopeKey(scope)
  return useMemo(() => {
    const [sessionId, ...childSessionIds] = key.split(' ').filter(Boolean)
    return sessionId === undefined
      ? []
      : prototypeSetsOfSession(listing.sets, { sessionId, childSessionIds })
  }, [listing.sets, key])
}

/**
 * The proposal a request made, with the project it proposes for, once that project's design system is listed;
 * null for a request that is not a proposal, and while there is no system yet to review.
 */
export function usePrototypeProposalOfRequest(requestId: string): PrototypeListedProposal | null {
  const [listing, setListing] = useState<Listing>(latest)
  useEffect(() => subscribe(setListing), [])
  const proposal = listing.proposals.find((candidate) => candidate.requestId === requestId)
  return proposal !== undefined &&
    listing.designSystems.some((system) => system.projectKey === proposal.projectKey)
    ? proposal
    : null
}
