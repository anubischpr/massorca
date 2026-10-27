// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RecordedFileHostOutdatedError,
  RecordedFileRefusedError
} from '@/runtime/runtime-recorded-file-client'
import { NativeChatRecordedFileViewer } from './NativeChatRecordedFileViewer'
import {
  closeNativeChatRecordedFile,
  openNativeChatRecordedFile
} from './native-chat-recorded-file-request'

const mocks = vi.hoisted(() => ({ readPreview: vi.fn() }))

vi.mock('@/runtime/runtime-file-client', () => ({ readRuntimeFilePreview: mocks.readPreview }))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ settings: { activeRuntimeEnvironmentId: 'env-1' } }) }
}))
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

function open(path: string, sessionId = 'session-alpha'): void {
  act(() => {
    openNativeChatRecordedFile({
      sessionId,
      path,
      worktreeId: 'wt-1',
      worktreePath: '/remote/repo'
    })
  })
}

afterEach(() => {
  act(() => closeNativeChatRecordedFile())
  cleanup()
  vi.clearAllMocks()
})

describe('NativeChatRecordedFileViewer', () => {
  it('reads the file for its own chat only, through the chat-scoped read', async () => {
    mocks.readPreview.mockResolvedValue({ content: '<h1>Report</h1>', isBinary: false })
    render(<NativeChatRecordedFileViewer sessionId="session-alpha" />)
    expect(screen.queryByRole('dialog')).toBeNull()

    open('/home/me/informes/report.html', 'session-other')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.readPreview).not.toHaveBeenCalled()

    open('/home/me/informes/report.html')
    expect(await screen.findByTestId('frame')).toHaveProperty('textContent', '<h1>Report</h1>')
    expect(mocks.readPreview).toHaveBeenCalledWith(
      {
        settings: { activeRuntimeEnvironmentId: 'env-1' },
        worktreeId: 'wt-1',
        worktreePath: '/remote/repo',
        agentSessionId: 'session-alpha'
      },
      '/home/me/informes/report.html'
    )
    expect(screen.getByText(/Read-only preview/)).toBeTruthy()
  })

  it('renders markdown, images and plain text by what the file is', async () => {
    mocks.readPreview.mockResolvedValue({ content: '# Notes', isBinary: false })
    render(<NativeChatRecordedFileViewer sessionId="session-alpha" />)
    open('/home/me/notes.md')
    expect(await screen.findByTestId('markdown')).toHaveProperty('textContent', '# Notes')

    mocks.readPreview.mockResolvedValue({
      content: 'iVBORw0=',
      isBinary: true,
      isImage: true,
      mimeType: 'image/png'
    })
    open('/home/me/chart.png')
    const image = await screen.findByRole('img')
    expect(image.getAttribute('src')).toBe('data:image/png;base64,iVBORw0=')

    mocks.readPreview.mockResolvedValue({ content: 'a < b', isBinary: false })
    open('/home/me/log.txt')
    expect(await screen.findByText('a < b')).toBeTruthy()
  })

  it('says a binary file it cannot draw is not previewable', async () => {
    mocks.readPreview.mockResolvedValue({ content: '', isBinary: true })
    render(<NativeChatRecordedFileViewer sessionId="session-alpha" />)
    open('/home/me/data.bin')
    expect(await screen.findByText("This file type can't be previewed here.")).toBeTruthy()
  })

  it.each([
    [
      new RecordedFileHostOutdatedError(),
      'Update Orca on the remote host to open files the agent saved outside the workspace.'
    ],
    [
      new RecordedFileRefusedError('not_recorded'),
      "This file is outside the workspace on the remote host, so Orca can't open it."
    ],
    [new RecordedFileRefusedError('not_found'), 'This file no longer exists on the remote host.'],
    [new RecordedFileRefusedError('too_large'), 'This file is too large to preview.'],
    [new Error('socket closed'), 'Could not load this file.']
  ])('explains a failed read (%s) without showing the raw error', async (error, message) => {
    mocks.readPreview.mockRejectedValue(error)
    render(<NativeChatRecordedFileViewer sessionId="session-alpha" />)
    open('/home/me/informes/report.html')
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByText(/socket closed/)).toBeNull()
  })
})
