import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MobilePrototypeDesignSystem } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import {
  useMobilePrototypeDesignSystemContent,
  type MobileDesignSystemContentState
} from './use-mobile-prototype-design-system-content'

const host = vi.hoisted(() => ({ read: vi.fn(), readVersion: vi.fn() }))
vi.mock('../session/mobile-prototype-host-rpc', () => ({
  readMobilePrototypeDesignSystem: host.read,
  readMobilePrototypeDesignSystemVersion: host.readVersion
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

const READY: MobilePrototypeDesignSystem = {
  kind: 'ready',
  projectKey: '/work/nexuscare',
  projectName: 'nexuscare',
  fileNames: ['design/system/tokens.json'],
  tokensJson: JSON.stringify({ color: { primary: { $value: '#2563eb' } } })
}

type Props = { sessionId: string | undefined; reloadKey: string; version?: number | null }
const latest: { state: MobileDesignSystemContentState | null } = { state: null }

function Probe({ sessionId, reloadKey, version }: Props) {
  latest.state = useMobilePrototypeDesignSystemContent(CLIENT, sessionId, reloadKey, version)
  return null
}

async function mount(props: Props): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined
  await act(async () => {
    renderer = create(createElement(Probe, props))
  })
  if (renderer === undefined) {
    throw new Error('the probe did not mount')
  }
  return renderer
}

async function rerender(tree: ReactTestRenderer, props: Props): Promise<void> {
  await act(async () => {
    tree.update(createElement(Probe, props))
  })
}

beforeEach(() => {
  latest.state = null
  host.read.mockReset()
  host.readVersion.mockReset()
})

describe('useMobilePrototypeDesignSystemContent', () => {
  it('reads the files of the project through its chat', async () => {
    host.read.mockResolvedValue(READY)
    await mount({ sessionId: 'session-1', reloadKey: 'a' })
    expect(host.read).toHaveBeenCalledWith(CLIENT, { sessionId: 'session-1' })
    expect(latest.state?.status).toBe('ready')
    expect(latest.state?.status === 'ready' && latest.state.content.tokens[0]?.id).toBe(
      'color.primary'
    )
  })

  it('is an error when the project has no chat to read through', async () => {
    await mount({ sessionId: undefined, reloadKey: 'a' })
    expect(host.read).not.toHaveBeenCalled()
    expect(latest.state).toEqual({ status: 'error' })
  })

  it('is an error when the host refuses', async () => {
    host.read.mockResolvedValue({ kind: 'refused' })
    await mount({ sessionId: 'session-1', reloadKey: 'a' })
    expect(latest.state).toEqual({ status: 'error' })
  })

  it('keeps the files shown when a later read fails', async () => {
    host.read.mockResolvedValueOnce(READY).mockResolvedValueOnce({ kind: 'unreachable' })
    const tree = await mount({ sessionId: 'session-1', reloadKey: 'a' })
    await rerender(tree, { sessionId: 'session-1', reloadKey: 'b' })
    expect(host.read).toHaveBeenCalledTimes(2)
    expect(latest.state?.status).toBe('ready')
  })

  it('reads an earlier version through the version read, and the current system without one', async () => {
    host.readVersion.mockResolvedValue(READY)
    host.read.mockResolvedValue(READY)
    await mount({ sessionId: 'session-1', reloadKey: 'a', version: 3 })
    expect(host.readVersion).toHaveBeenCalledWith(CLIENT, { sessionId: 'session-1', version: 3 })
    expect(host.read).not.toHaveBeenCalled()
    expect(latest.state?.status).toBe('ready')
  })
})
