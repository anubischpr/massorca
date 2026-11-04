// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GhSignInEvent } from '../../../../preload/api/github-account-api'

const mocks = vi.hoisted(() => {
  const listeners: ((event: GhSignInEvent) => void)[] = []
  return {
    copyMarketplaceText: vi.fn(async () => undefined),
    startSignIn: vi.fn(),
    cancelSignIn: vi.fn(),
    openUrl: vi.fn(),
    listeners
  }
})

vi.mock('./marketplace-clipboard', () => ({ copyMarketplaceText: mocks.copyMarketplaceText }))

const { GitHubSignInDialog } = await import('./GitHubSignInDialog')

const roots: Root[] = []

function emitEvent(signInId: string, state: GhSignInEvent['state']): void {
  for (const listener of mocks.listeners) {
    listener({ signInId, state })
  }
}

function startedId(callIndex = 0): string {
  const call = mocks.startSignIn.mock.calls[callIndex]
  if (!call) {
    throw new Error('startSignIn was not called')
  }
  const args: unknown = call[0]
  if (typeof args === 'object' && args !== null && 'signInId' in args) {
    if (typeof args.signInId === 'string') {
      return args.signInId
    }
  }
  throw new Error('startSignIn was called without a signInId')
}

function buttonByText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
}

async function render(props: {
  onOpenChange?: (open: boolean) => void
  onSignedIn?: () => void
}): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(
      <GitHubSignInDialog
        open
        host="github.com"
        onOpenChange={props.onOpenChange ?? vi.fn()}
        onSignedIn={props.onSignedIn ?? vi.fn()}
      />
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  // Why: Radix portals the dialog into document.body, outside the render container.
  return document.body
}

describe('GitHubSignInDialog', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.listeners.length = 0
    mocks.startSignIn.mockResolvedValue({ ok: true })
    mocks.cancelSignIn.mockResolvedValue(undefined)
    mocks.openUrl.mockResolvedValue(undefined)
    Object.assign(window, {
      api: {
        gh: {
          startSignIn: mocks.startSignIn,
          cancelSignIn: mocks.cancelSignIn,
          onSignInEvent: (callback: (event: GhSignInEvent) => void) => {
            mocks.listeners.push(callback)
            return () => {
              mocks.listeners.splice(mocks.listeners.indexOf(callback), 1)
            }
          }
        },
        shell: { openUrl: mocks.openUrl }
      }
    })
  })

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount())
    }
    document.body.innerHTML = ''
  })

  it('shows the code and both steps, and opens the verification URL', async () => {
    const container = await render({})
    expect(mocks.startSignIn).toHaveBeenCalledWith({
      signInId: expect.any(String),
      host: 'github.com'
    })
    await act(async () => {
      emitEvent(startedId(), {
        kind: 'code',
        userCode: 'ABCD-1234',
        verificationUrl: 'https://github.com/login/device'
      })
    })
    expect(container.textContent).toContain('1. Copy this one-time code')
    expect(container.textContent).toContain('2. Paste it on GitHub and allow access')
    expect(container.textContent).toContain('ABCD-1234')
    expect(container.textContent).toContain('Waiting for GitHub. This page updates by itself.')
    expect(container.textContent).toContain('Signs in with the GitHub CLI on github.com.')
    await act(async () => {
      buttonByText(container, 'Open GitHub')?.click()
    })
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/login/device')
  })

  it('copies the one-time code', async () => {
    const container = await render({})
    await act(async () => {
      emitEvent(startedId(), {
        kind: 'code',
        userCode: 'ABCD-1234',
        verificationUrl: 'https://github.com/login/device'
      })
    })
    await act(async () => {
      buttonByText(container, 'Copy')?.click()
    })
    expect(mocks.copyMarketplaceText).toHaveBeenCalledWith('ABCD-1234')
  })

  it('refreshes accounts and closes once GitHub confirms', async () => {
    const onSignedIn = vi.fn()
    const onOpenChange = vi.fn()
    await render({ onSignedIn, onOpenChange })
    await act(async () => {
      emitEvent(startedId(), { kind: 'done', user: 'octocat' })
    })
    expect(onSignedIn).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ignores events for another sign-in', async () => {
    const onSignedIn = vi.fn()
    await render({ onSignedIn })
    await act(async () => {
      emitEvent('someone-else', { kind: 'done', user: 'mallory' })
    })
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('cancel closes the dialog and ends the flow on the host', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    function Harness(): React.JSX.Element {
      const [open, setOpen] = useState(true)
      return (
        <GitHubSignInDialog
          open={open}
          host="github.com"
          onOpenChange={setOpen}
          onSignedIn={vi.fn()}
        />
      )
    }
    await act(async () => {
      root.render(<Harness />)
    })
    const id = startedId()
    await act(async () => {
      buttonByText(document.body, 'Cancel')?.click()
    })
    expect(mocks.cancelSignIn).toHaveBeenCalledWith({ signInId: id })
  })

  it('shows a failure reason and restarts on Try again', async () => {
    const container = await render({})
    await act(async () => {
      emitEvent(startedId(), { kind: 'failed', reason: 'timeout' })
    })
    expect(container.textContent).toContain('The code expired before it was used.')
    await act(async () => {
      buttonByText(container, 'Try again')?.click()
    })
    expect(mocks.startSignIn).toHaveBeenCalledTimes(2)
  })

  it('copies the terminal command as the fallback', async () => {
    const container = await render({})
    await act(async () => {
      buttonByText(container, 'Use a terminal instead')?.click()
    })
    expect(mocks.copyMarketplaceText).toHaveBeenCalledWith('gh auth login --hostname github.com')
  })
})
