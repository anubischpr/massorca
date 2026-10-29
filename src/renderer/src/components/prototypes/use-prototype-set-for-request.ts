import { useEffect, useState } from 'react'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedProposal,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
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
