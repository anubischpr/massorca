// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedProposal,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { listPrototypeSetsFromAllHosts, type PrototypeHostListing } from './prototype-host-targets'
import {
  usePrototypeProposalOfRequest,
  usePrototypeSetsOfSession
} from './use-prototype-set-for-request'

// The shared poll reads the hosts through this module. Each test answers that read with its own
// listing, so the real hook is what decides whether a proposal is returned.
vi.mock('./prototype-host-targets', () => ({
  listPrototypeSetsFromAllHosts: vi.fn()
}))

function designSystem(projectKey: string): PrototypeListedDesignSystem {
  return {
    projectKey,
    projectName: 'massorca',
    status: 'detected',
    version: 1,
    tokenCount: 8,
    swatches: []
  }
}

function proposal(requestId: string, projectKey: string): PrototypeListedProposal {
  return { requestId, projectKey }
}

function listingOf(
  designSystems: readonly PrototypeListedDesignSystem[],
  proposals: readonly PrototypeListedProposal[]
): PrototypeHostListing {
  return {
    sets: [],
    designSystems: [...designSystems],
    proposals: [...proposals],
    answered: true,
    onlyOutdated: false
  }
}

/** Renders the hook for one request, then lets the shared read land before the value is read. */
async function proposalFor(
  requestId: string,
  listing: PrototypeHostListing
): Promise<PrototypeListedProposal | null> {
  vi.mocked(listPrototypeSetsFromAllHosts).mockResolvedValue(listing)
  const { result } = renderHook(() => usePrototypeProposalOfRequest(requestId))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return result.current
}

describe('usePrototypeProposalOfRequest', () => {
  afterEach(cleanup)

  it('returns the proposal of the request it is asked for, not another proposal', async () => {
    const listing = listingOf(
      [designSystem('P1'), designSystem('P2')],
      [proposal('req-a', 'P1'), proposal('req-b', 'P2')]
    )
    expect(await proposalFor('req-b', listing)).toEqual(proposal('req-b', 'P2'))
  })

  it('returns null when no listed design system shares the proposal project', async () => {
    const listing = listingOf([designSystem('P2')], [proposal('req-a', 'P1')])
    expect(await proposalFor('req-a', listing)).toBeNull()
  })

  it('returns the proposal once a listed design system has the same project key', async () => {
    const listing = listingOf([designSystem('P2'), designSystem('P1')], [proposal('req-a', 'P1')])
    expect(await proposalFor('req-a', listing)).toEqual(proposal('req-a', 'P1'))
  })

  it('returns null for a request id that no proposal carries', async () => {
    const listing = listingOf([designSystem('P1')], [proposal('req-a', 'P1')])
    expect(await proposalFor('req-zzz', listing)).toBeNull()
  })

  it('returns null while no design system is listed at all', async () => {
    const listing = listingOf([], [proposal('req-a', 'P1')])
    expect(await proposalFor('req-a', listing)).toBeNull()
  })
})

function listedSet(requestId: string, sessionId: string, originSessionId?: string): PrototypeListedSet {
  return {
    requestId,
    sessionId,
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'Two directions',
    createdAt: `2026-11-03T0${requestId.length}:00:00.000Z`,
    count: 2,
    ...(originSessionId !== undefined ? { origin: { sessionId: originSessionId } } : {}),
    directions: []
  }
}

describe('usePrototypeSetsOfSession', () => {
  afterEach(cleanup)

  it('lists a task session sets made by its children, and nothing for a null scope', async () => {
    vi.mocked(listPrototypeSetsFromAllHosts).mockResolvedValue({
      ...listingOf([], []),
      sets: [listedSet('a', 'child-1'), listedSet('bb', 'child-2', 'task'), listedSet('ccc', 'other')]
    })
    type Props = { scope: { sessionId: string; childSessionIds?: string[] } | null }
    const initialProps: Props = { scope: { sessionId: 'task', childSessionIds: ['child-1'] } }
    const { result, rerender } = renderHook(
      ({ scope }: Props) => usePrototypeSetsOfSession(scope),
      { initialProps }
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(result.current.map((set) => set.requestId)).toEqual(['bb', 'a'])
    rerender({ scope: null })
    expect(result.current).toEqual([])
  })
})
