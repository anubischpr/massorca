import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { MobilePrototypeFile } from '../session/mobile-prototype-host-rpc'
import {
  useMobilePrototypeFile,
  type MobilePrototypeFileHtml,
  type MobilePrototypeFileRef
} from './use-mobile-prototype-file'

type PendingRead = {
  fileName: string
  resolve: (read: MobilePrototypeFile) => void
  reject: (error: unknown) => void
}

// Each read waits here until the test answers it, so the order of answers is the test's choice.
const host = vi.hoisted(() => {
  const state: { pending: PendingRead[] } = { pending: [] }
  return state
})

vi.mock('../session/mobile-prototype-host-rpc', () => ({
  readMobilePrototypeFile: (_client: unknown, params: { fileName: string }) =>
    new Promise<MobilePrototypeFile>((resolve, reject) => {
      host.pending.push({ fileName: params.fileName, resolve, reject })
    })
}))

// The read is mocked, so the client is only an identity the hook passes along.
const CLIENT: RpcClient = {
  sendRequest: () => Promise.reject(new Error('the read is mocked')),
  subscribe: () => () => {},
  updateTerminalSubscriptionViewport: () => {},
  getState: () => 'connected',
  getReconnectAttempt: () => 0,
  getLastConnectedAt: () => null,
  onStateChange: () => () => {},
  notifyForeground: () => {},
  close: () => {}
}

type ProbeProps = { client: RpcClient | null; file: MobilePrototypeFileRef | null }

const latest: { state: MobilePrototypeFileHtml | null } = { state: null }

function Probe({ client, file }: ProbeProps) {
  latest.state = useMobilePrototypeFile(client, file)
  return null
}

const A: MobilePrototypeFileRef = {
  sessionId: 'session-1',
  requestId: 'request-1',
  fileName: 'A.html'
}
const B: MobilePrototypeFileRef = {
  sessionId: 'session-1',
  requestId: 'request-1',
  fileName: 'B.html'
}

function mount(props: ProbeProps): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(createElement(Probe, props))
  })
  if (renderer === undefined) {
    throw new Error('the probe did not mount')
  }
  return renderer
}

function rerender(renderer: ReactTestRenderer, props: ProbeProps): void {
  act(() => {
    renderer.update(createElement(Probe, props))
  })
}

/** Answers the read of `fileName`, the first one still waiting for it. */
async function answer(fileName: string, read: MobilePrototypeFile): Promise<void> {
  const index = host.pending.findIndex((pending) => pending.fileName === fileName)
  const pending = host.pending.splice(index, 1)[0]
  await act(async () => {
    pending?.resolve(read)
  })
}

describe('useMobilePrototypeFile', () => {
  beforeEach(() => {
    host.pending.length = 0
    latest.state = null
  })

  it('loads the file, then shows its HTML when the host answers ready', async () => {
    const renderer = mount({ client: CLIENT, file: A })
    expect(latest.state).toEqual({ status: 'loading' })
    await answer('A.html', { kind: 'ready', html: '<main>A</main>' })
    expect(latest.state).toEqual({ status: 'ready', html: '<main>A</main>' })
    renderer.unmount()
  })

  it('shows an error when the host refuses the file', async () => {
    mount({ client: CLIENT, file: A })
    await answer('A.html', { kind: 'refused', error: 'not_found' })
    expect(latest.state).toEqual({ status: 'error' })
  })

  it('shows an error when the host is an older one without the method', async () => {
    mount({ client: CLIENT, file: A })
    await answer('A.html', { kind: 'unsupported-host' })
    expect(latest.state).toEqual({ status: 'error' })
  })

  it('keeps loading when the host is out of contact, which is not an unreadable file', async () => {
    mount({ client: CLIENT, file: A })
    await answer('A.html', { kind: 'unreachable' })
    expect(latest.state).toEqual({ status: 'loading' })
  })

  it('shows an error when the read itself throws, instead of loading forever', async () => {
    mount({ client: CLIENT, file: A })
    const pending = host.pending.splice(0, 1)[0]
    await act(async () => {
      pending?.reject(new Error('read failed'))
    })
    expect(latest.state).toEqual({ status: 'error' })
  })

  it('reads again for a new file, and ignores the answer to the file it has left', async () => {
    const renderer = mount({ client: CLIENT, file: A })
    rerender(renderer, { client: CLIENT, file: B })
    expect(latest.state).toEqual({ status: 'loading' })
    await answer('A.html', { kind: 'ready', html: '<main>A</main>' })
    expect(latest.state).toEqual({ status: 'loading' })
    await answer('B.html', { kind: 'ready', html: '<main>B</main>' })
    expect(latest.state).toEqual({ status: 'ready', html: '<main>B</main>' })
  })

  it('shows nothing of an earlier file while there is no connection', async () => {
    const renderer = mount({ client: CLIENT, file: A })
    await answer('A.html', { kind: 'ready', html: '<main>A</main>' })
    rerender(renderer, { client: null, file: B })
    expect(latest.state).toEqual({ status: 'loading' })
  })

  it('has no file to show when it names none', () => {
    mount({ client: CLIENT, file: null })
    expect(latest.state).toEqual({ status: 'error' })
  })
})
