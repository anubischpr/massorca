import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeMergeReviewPart } from '../../../src/shared/prototype-merge-plan'
import type { RpcClient } from '../transport/rpc-client'
import { listedSet } from './mobile-prototype-sets.test-fixture'
import {
  useMobilePrototypeMergePreview,
  type MobileMergePreview
} from './use-mobile-prototype-merge-preview'

const readFile = vi.hoisted(() =>
  vi.fn<(client: unknown, params: { fileName: string }) => Promise<unknown>>(
    async (_client, params) => ({
      kind: 'ready',
      html: `<main>${params.fileName}</main>`
    })
  )
)
vi.mock('../session/mobile-prototype-host-rpc', () => ({ readMobilePrototypeFile: readFile }))

const CLIENT: RpcClient = Object.create(null)
const SET = listedSet({ requestId: 'req-1' })

let latest: MobileMergePreview | undefined

beforeEach(() => {
  readFile.mockClear()
  latest = undefined
})

function Probe(props: { client: RpcClient | null; parts: readonly PrototypeMergeReviewPart[] }) {
  latest = useMobilePrototypeMergePreview({
    client: props.client,
    set: SET,
    letters: ['A', 'C'],
    parts: props.parts
  })
  return null
}

function part(
  id: number,
  from: string,
  selectors: Record<string, string>,
  on = true
): PrototypeMergeReviewPart {
  return {
    id,
    name: `Part ${id}`,
    kind: 'section',
    selectors,
    selector: selectors[from] ?? '',
    suggested: from,
    from,
    on
  }
}

const PARTS = [part(0, 'A', { A: '.hero', C: '.hero' }), part(1, 'C', { C: '.buy' })]

/** Lets the directions' reads resolve and the hook settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function mount(props: {
  client: RpcClient | null
  parts: readonly PrototypeMergeReviewPart[]
}): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined
  await act(async () => {
    renderer = create(createElement(Probe, props))
  })
  await settle()
  if (renderer === undefined) {
    throw new Error('the probe did not mount')
  }
  return renderer
}

function currentRequestId(): number {
  const requestId = latest?.request?.requestId
  if (requestId === undefined) {
    throw new Error('no composer request')
  }
  return requestId
}

describe('the live merge preview hook', () => {
  it('asks for nothing while there is no connection', async () => {
    await mount({ client: null, parts: PARTS })
    expect(readFile).not.toHaveBeenCalled()
    expect(latest?.request).toBeNull()
    expect(latest?.html).toBeNull()
  })

  it('reads the latest file of each starred direction, then asks for the kept parts only', async () => {
    const left = [part(0, 'A', { A: '.hero', C: '.hero' }), part(1, 'C', { C: '.buy' }, false)]
    await mount({ client: CLIENT, parts: left })
    expect(readFile).toHaveBeenCalledWith(CLIENT, {
      sessionId: SET.sessionId,
      requestId: 'req-1',
      fileName: 'prototypes/req-1/A.html'
    })
    expect(latest?.request).toEqual({
      requestId: 1,
      directions: { A: '<main>prototypes/req-1/A.html</main>' },
      parts: [{ id: 0, from: 'A', selector: '.hero' }]
    })
  })

  it('shows the composed page of the latest answer, with where each part ended up', async () => {
    await mount({ client: CLIENT, parts: PARTS })
    act(() =>
      latest?.onResponse({
        requestId: currentRequestId(),
        ok: true,
        css: { A: '', C: '' },
        outer: { '0': '<h1>hero</h1>', '1': null }
      })
    )
    expect(latest?.html).toContain('<h1>hero</h1>')
    expect(latest?.placement).toEqual({ 0: 'placed', 1: 'unmatched' })
    expect(latest?.failed).toBe(false)
  })

  it('ignores an answer to parts that have since changed, until the new request is answered', async () => {
    const renderer = await mount({ client: CLIENT, parts: PARTS })
    const stale = currentRequestId()
    await act(async () => {
      renderer.update(
        createElement(Probe, {
          client: CLIENT,
          parts: [part(0, 'A', { A: '.hero', C: '.hero' }, false), part(1, 'C', { C: '.buy' })]
        })
      )
    })
    await settle()
    act(() =>
      latest?.onResponse({ requestId: stale, ok: true, css: {}, outer: { '1': '<p>old</p>' } })
    )
    expect(latest?.html).toBeNull()
    expect(currentRequestId()).not.toBe(stale)
  })

  it('reports a failed composition for the current request', async () => {
    await mount({ client: CLIENT, parts: PARTS })
    act(() => latest?.onResponse({ requestId: currentRequestId(), ok: false }))
    expect(latest?.failed).toBe(true)
    expect(latest?.html).toBeNull()
  })
})
