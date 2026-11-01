// @vitest-environment happy-dom

import React, { act, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  getVersion: vi.fn(),
  submit: vi.fn(),
  viewer: vi.fn(),
  writeClipboardText: vi.fn(),
  toastWarning: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: mocks.toastWarning
  }
}))

vi.mock('@/components/ui/dialog', async () => {
  const ReactModule = await import('react')
  const Section = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Dialog: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogContent: ReactModule.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        children?: ReactNode
        onOpenAutoFocus?: (event: Event) => void
      }
    >(function DialogContent({ children, onOpenAutoFocus: _onOpenAutoFocus, ...props }, ref) {
      return (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    }),
    DialogDescription: Section,
    DialogFooter: Section,
    DialogHeader: Section,
    DialogTitle: Section
  }
})

import { SidebarFeedbackDialog } from './SidebarFeedbackDialog'
import { useAppStore } from '@/store'

beforeEach(() => {
  mocks.submit.mockReset()
  mocks.toastWarning.mockReset()
  mocks.getPlatform.mockReset()
  mocks.viewer.mockReset()
  mocks.writeClipboardText.mockReset()
  mocks.writeClipboardText.mockResolvedValue(undefined)
  mocks.viewer.mockResolvedValue({ login: 'octocat', email: null })
  mocks.getVersion.mockReset()
  mocks.submit.mockResolvedValue({
    ok: true,
    url: 'https://github.com/anubischpr/massorca/issues/1'
  })
  mocks.getPlatform.mockReturnValue({
    platform: 'darwin',
    osRelease: '25.0.0',
    arch: 'arm64',
    shell: '/bin/zsh',
    displayServer: null
  })
  mocks.getVersion.mockResolvedValue('1.4.178-rc.2')
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      feedback: { submit: mocks.submit },
      gh: { viewer: mocks.viewer },
      shell: { openUrl: vi.fn() },
      ui: { writeClipboardText: mocks.writeClipboardText },
      platform: {
        get: mocks.getPlatform
      },
      updater: { getVersion: mocks.getVersion }
    }
  })
})

afterEach(() => {
  cleanup()
  // Why: the draft outlives the dialog on purpose now, so it also outlives a
  // test unless each one starts from an empty store.
  useAppStore.getState().clearFeedbackDraft()
})

describe('SidebarFeedbackDialog GitHub issue', () => {
  it('names the active account and warns the issue is public', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)

    await screen.findByText('Anyone can read this issue. It will be published as octocat.')
  })

  it('submits only the report text', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    await screen.findByText('Anyone can read this issue. It will be published as octocat.')
    fireEvent.change(screen.getByPlaceholderText('What could we improve?'), {
      target: { value: 'Tabs feel slow' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create GitHub Issue' }))

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1))
    expect(Object.keys(mocks.submit.mock.calls[0]?.[0] ?? {})).toEqual(['feedback'])
  })

  it('offers only copy when no GitHub account is available', async () => {
    mocks.viewer.mockResolvedValue(null)
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    await screen.findByText(
      'Sign in with `gh auth login` to create an issue, or copy your feedback instead.'
    )
    fireEvent.change(screen.getByPlaceholderText('What could we improve?'), {
      target: { value: 'Tabs feel slow' }
    })

    const create = screen.getByRole('button', { name: 'Create GitHub Issue' })
    expect((create as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(mocks.writeClipboardText).toHaveBeenCalledTimes(1))
    expect(mocks.writeClipboardText.mock.calls[0]?.[0]).toContain('Tabs feel slow')
    expect(mocks.submit).not.toHaveBeenCalled()
  })
})

describe('SidebarFeedbackDialog environment prefill', () => {
  it('pre-inserts Orca version and OS info when the dialog opens', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement

    await waitFor(() => {
      expect(textarea.value).toContain('Orca: 1.4.178-rc.2')
      expect(textarea.value).toContain('OS: darwin 25.0.0 (arm64)')
      expect(textarea.value).toContain('Shell: /bin/zsh')
    })
    expect(
      (screen.getByRole('button', { name: 'Create GitHub Issue' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('keeps version info when the user types above the prefilled block', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain('Orca: 1.4.178-rc.2'))

    fireEvent.change(textarea, {
      target: { value: `Tabs feel slow\n\n${textarea.value.trim()}` }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create GitHub Issue' }))

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1))
    const submitted = mocks.submit.mock.calls[0]?.[0].feedback as string
    expect(submitted).toContain('Tabs feel slow')
    expect(submitted).toContain('Orca: 1.4.178-rc.2')
  })

  it('preserves early typing and appends the footer after version loading finishes', async () => {
    let finishVersion: ((version: string) => void) | undefined
    mocks.getVersion.mockReturnValue(
      new Promise((resolve) => {
        finishVersion = resolve
      })
    )
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'Typed before loading' } })
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    await act(async () => finishVersion?.('1.4.178-rc.2'))

    await waitFor(() => expect(textarea.value).toContain('Orca: 1.4.178-rc.2'))
    expect(textarea.value).toContain('Typed before loading')
    expect(textarea.selectionStart).toBe('Typed before loading'.length)
  })

  it('enables Send when the user types below the prefilled footer', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain('Orca: 1.4.178-rc.2'))

    fireEvent.change(textarea, {
      target: { value: `${textarea.value.trim()}\nText below footer` }
    })

    expect(
      (screen.getByRole('button', { name: 'Create GitHub Issue' }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('keeps Send disabled for an edited footer with no user text', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain('Orca: 1.4.178-rc.2'))

    fireEvent.change(textarea, {
      target: { value: '---\nOrca: custom build\nOS: edited' }
    })

    expect(
      (screen.getByRole('button', { name: 'Create GitHub Issue' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('allows a real report after the prefilled footer is deleted', async () => {
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain('Orca: 1.4.178-rc.2'))
    const send = screen.getByRole('button', { name: 'Create GitHub Issue' }) as HTMLButtonElement

    fireEvent.change(textarea, { target: { value: '' } })
    expect(send.disabled).toBe(true)
    fireEvent.change(textarea, { target: { value: 'Tabs hang after waking the laptop.' } })
    expect(send.disabled).toBe(false)
  })

  it('still prefills best-effort details when preload lookups fail', async () => {
    mocks.getPlatform.mockImplementation(() => {
      throw new Error('platform unavailable')
    })
    mocks.getVersion.mockRejectedValue(new Error('version unavailable'))

    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('What could we improve?') as HTMLTextAreaElement
      expect(textarea.value).toContain('Orca: unknown')
    })
  })
})

describe('SidebarFeedbackDialog layout', () => {
  it('keeps the dialog scrollable within short windows', () => {
    const { container } = render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    const content = container.querySelector('.scrollbar-sleek')

    expect(content?.className).toContain('max-h-[calc(100vh-3rem)]')
    expect(content?.className).toContain('overflow-y-auto')
  })
})

describe('SidebarFeedbackDialog draft survival', () => {
  const REPORT = 'The terminal froze right after a rebase'

  function textarea(): HTMLTextAreaElement {
    return screen.getByPlaceholderText<HTMLTextAreaElement>('What could we improve?')
  }

  async function issueButtonReady(): Promise<HTMLElement> {
    await screen.findByText('Anyone can read this issue. It will be published as octocat.')
    return screen.getByRole('button', { name: 'Create GitHub Issue' })
  }

  // Why: orca#22466's third complaint. The dialog renders inside the sidebar
  // subtree, so collapsing the sidebar unmounts it; with the draft in component
  // state that silently discarded a report the user had not managed to send.
  it('keeps the typed report when the sidebar unmounts and remounts the dialog', () => {
    const first = render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(textarea(), { target: { value: REPORT } })

    first.unmount()
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)

    expect(textarea().value).toContain(REPORT)
  })

  it('keeps the report after a submit the server refused outright', async () => {
    mocks.submit.mockResolvedValue({ ok: false, status: 500, error: 'status 500' })
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(textarea(), { target: { value: REPORT } })

    fireEvent.click(await issueButtonReady())
    await waitFor(() => expect(mocks.submit).toHaveBeenCalled())

    expect(textarea().value).toContain(REPORT)
    expect(useAppStore.getState().feedbackDraft.feedback).toContain(REPORT)
  })

  it('clears the draft once delivery is confirmed', async () => {
    mocks.submit.mockResolvedValue({
      ok: true,
      url: 'https://github.com/anubischpr/massorca/issues/1'
    })
    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(textarea(), { target: { value: REPORT } })

    fireEvent.click(await issueButtonReady())

    await waitFor(() => expect(useAppStore.getState().feedbackDraft.feedback).toBe(''))
  })

  // Why: collapsing the sidebar while the request is in flight unmounts the
  // dialog. The delivery still lands, so the draft has to go with it or the
  // sent report comes back on the next open and invites a duplicate send.
  it('clears the draft when the sidebar unmounts before the submit resolves', async () => {
    let resolveSubmit: ((result: { ok: true }) => void) | undefined
    mocks.submit.mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        resolveSubmit = resolve
      })
    )
    const { unmount } = render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(textarea(), { target: { value: REPORT } })

    fireEvent.click(await issueButtonReady())
    await waitFor(() => expect(mocks.submit).toHaveBeenCalled())
    unmount()
    await act(async () => {
      resolveSubmit?.({ ok: true })
    })

    expect(useAppStore.getState().feedbackDraft.feedback).toBe('')
  })

  // Why: the unmounted handler's mountedRef stays false forever, so an
  // unconditional clear would wipe whatever the user typed after reopening.
  it('keeps a report typed after remount while the previous submit is still in flight', async () => {
    const SECOND_REPORT = 'Different bug, typed after reopening the dialog'
    let resolveSubmit: ((result: { ok: true }) => void) | undefined
    mocks.submit.mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        resolveSubmit = resolve
      })
    )
    const first = render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(textarea(), { target: { value: REPORT } })
    fireEvent.click(await issueButtonReady())
    await waitFor(() => expect(mocks.submit).toHaveBeenCalled())
    first.unmount()

    render(<SidebarFeedbackDialog open onOpenChange={vi.fn()} />)
    fireEvent.change(textarea(), { target: { value: SECOND_REPORT } })
    await act(async () => {
      resolveSubmit?.({ ok: true })
    })

    expect(useAppStore.getState().feedbackDraft.feedback).toContain(SECOND_REPORT)
    expect(textarea().value).toContain(SECOND_REPORT)
  })
})
