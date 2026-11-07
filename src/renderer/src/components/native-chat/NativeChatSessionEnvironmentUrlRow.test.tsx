// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatEnvironmentUrl } from '../../../../shared/native-chat-environment-urls'
import { NativeChatSessionEnvironmentUrlRow } from './NativeChatSessionEnvironmentUrlRow'
import { clientRouteForEnvironmentUrl } from './use-native-chat-port-route'

const openUrl = vi.fn(async () => {})
const copy = vi.fn(async () => {})
Object.defineProperty(window, 'api', {
  configurable: true,
  value: { shell: { openUrl } }
})
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function entry(overrides: Partial<NativeChatEnvironmentUrl> = {}): NativeChatEnvironmentUrl {
  return {
    url: 'https://shop-bbb.vercel.app',
    source: 'tool-output',
    itemId: 'i-1',
    loopback: false,
    previous: false,
    ...overrides
  }
}

describe('environment URL row', () => {
  it('only names the URL while compact', () => {
    render(<NativeChatSessionEnvironmentUrlRow entry={entry()} route={null} />)
    expect(screen.getByText('https://shop-bbb.vercel.app')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens and copies the URL when expanded', () => {
    render(
      <NativeChatSessionEnvironmentUrlRow
        entry={entry()}
        route="https://shop-bbb.vercel.app"
        expanded
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(openUrl).toHaveBeenCalledWith('https://shop-bbb.vercel.app')
    fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }))
    expect(copy).toHaveBeenCalledWith('https://shop-bbb.vercel.app')
  })

  it('marks a replaced URL as previous', () => {
    render(
      <NativeChatSessionEnvironmentUrlRow entry={entry({ previous: true })} route="x" expanded />
    )
    expect(screen.getByText('Previous')).toBeDefined()
  })

  it('keeps a remote loopback URL with no route copyable but not openable', () => {
    render(
      <NativeChatSessionEnvironmentUrlRow
        entry={entry({ url: 'http://localhost:3000', loopback: true })}
        route={null}
        expanded
      />
    )
    expect(screen.getByRole('button', { name: 'Open' }).hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByText('This URL is on the remote host. Forward its port to open it on this PC.')
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }))
    expect(copy).toHaveBeenCalledWith('http://localhost:3000')
  })
})

describe('clientRouteForEnvironmentUrl', () => {
  const noForward = { local: false, forwardedUrl: () => null }

  it('opens public and local-session URLs as they are', () => {
    expect(clientRouteForEnvironmentUrl('https://a.vercel.app', false, noForward)).toBe(
      'https://a.vercel.app'
    )
    expect(
      clientRouteForEnvironmentUrl('http://localhost:3000', true, { ...noForward, local: true })
    ).toBe('http://localhost:3000')
  })

  it('routes a remote loopback URL through its port forward, keeping the path', () => {
    const forwardedUrl = vi.fn(() => 'http://127.0.0.1:43000')
    expect(
      clientRouteForEnvironmentUrl('http://localhost:3000/app?x=1', true, {
        local: false,
        forwardedUrl
      })
    ).toBe('http://127.0.0.1:43000/app?x=1')
    expect(forwardedUrl).toHaveBeenCalledWith(3000, false)
  })

  it('has no route for a remote loopback URL without a forward', () => {
    expect(clientRouteForEnvironmentUrl('http://localhost:3000', true, noForward)).toBeNull()
  })
})
