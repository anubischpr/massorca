// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RecordedFileHostOutdatedError,
  RecordedFileRefusedError
} from '@/runtime/runtime-recorded-file-client'
import { NativeChatRecordedFileContent } from './NativeChatRecordedFileContent'

const mocks = vi.hoisted(() => {
  const settings: { activeRuntimeEnvironmentId: string | null } = {
    activeRuntimeEnvironmentId: 'env-other'
  }
  return { readPreview: vi.fn(), settings }
})

vi.mock('@/runtime/runtime-file-client', () => ({ readRuntimeFilePreview: mocks.readPreview }))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ settings: mocks.settings }) }
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))
vi.mock('./NativeChatVisualFrame', () => ({
  NativeChatVisualFrame: (props: { document: { html: string } }) => (
    <div data-testid="frame">{props.document.html}</div>
  )
}))
vi.mock('./NativeChatMarkdown', () => ({
  NativeChatMarkdown: (props: { content: string }) => (
    <div data-testid="markdown">{props.content}</div>
  )
}))

function sourceFor(path: string) {
  return {
    worktreeId: 'wt-1',
    worktreePath: '/remote/repo',
    runtimeEnvironmentId: 'env-1',
    sessionId: 'session-alpha',
    path
  }
}

afterEach(() => {
  mocks.settings = { activeRuntimeEnvironmentId: 'env-other' }
  cleanup()
  vi.clearAllMocks()
})

describe('NativeChatRecordedFileContent', () => {
  it('renders markdown in a region bounded by its container, scrolling inside it', async () => {
    mocks.readPreview.mockResolvedValue({ content: '# Notes', isBinary: false })
    render(<NativeChatRecordedFileContent source={sourceFor('/home/me/notes.md')} />)

    expect(await screen.findByTestId('markdown')).toHaveProperty('textContent', '# Notes')
    const body = screen.getByTestId('recorded-file-body')
    for (const name of ['flex', 'flex-col', 'min-h-0', 'flex-1', 'overflow-auto']) {
      expect(body.classList.contains(name)).toBe(true)
    }
  })

  it('wraps long plain text inside the body instead of running past its edge', async () => {
    mocks.readPreview.mockResolvedValue({ content: 'x'.repeat(400), isBinary: false })
    render(<NativeChatRecordedFileContent source={sourceFor('/home/me/log.txt')} />)

    const text = await screen.findByText('x'.repeat(400))
    for (const name of ['min-w-0', 'break-words', 'whitespace-pre-wrap']) {
      expect(text.classList.contains(name)).toBe(true)
    }
  })

  it("reads from the chat's own host, not the global active runtime", async () => {
    mocks.settings = { activeRuntimeEnvironmentId: null }
    mocks.readPreview.mockResolvedValue({ content: 'x', isBinary: false })
    render(<NativeChatRecordedFileContent source={sourceFor('/home/me/log.txt')} />)

    await screen.findByText('x')
    expect(mocks.readPreview.mock.calls[0]?.[0].settings).toEqual({
      activeRuntimeEnvironmentId: 'env-1'
    })
  })

  it('shows loading until the read settles', async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.readPreview.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    render(<NativeChatRecordedFileContent source={sourceFor('/home/me/log.txt')} />)

    expect(screen.getByText('Loading…')).toBeTruthy()
    await act(async () => finish({ content: 'done', isBinary: false }))
    expect(await screen.findByText('done')).toBeTruthy()
  })

  it('explains an outdated host without showing the raw error', async () => {
    mocks.readPreview.mockRejectedValue(new RecordedFileHostOutdatedError())
    render(<NativeChatRecordedFileContent source={sourceFor('/home/me/informes/report.html')} />)

    expect(
      await screen.findByText(
        'Update MassOrca on the remote host to open files the agent saved outside the workspace.'
      )
    ).toBeTruthy()
  })

  it('reports a file the host no longer has as missing', async () => {
    mocks.readPreview.mockRejectedValue(new RecordedFileRefusedError('not_found'))
    render(<NativeChatRecordedFileContent source={sourceFor('/home/me/log.txt')} />)

    expect(await screen.findByText('This file no longer exists on the remote host.')).toBeTruthy()
  })
})
