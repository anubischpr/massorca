// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OpenFile } from '@/store/slices/editor'
import { RecordedFileTabPanel } from './RecordedFileTabPanel'

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
vi.mock('../native-chat/NativeChatMarkdown', () => ({
  NativeChatMarkdown: (props: { content: string }) => (
    <div data-testid="markdown">{props.content}</div>
  )
}))

const path = '/home/me/informes/report.md'
const file: OpenFile = {
  id: 'wt-1::recorded-file::session-alpha::/home/me/informes/report.md',
  filePath: 'wt-1::recorded-file::session-alpha::/home/me/informes/report.md',
  relativePath: path,
  worktreeId: 'wt-1',
  language: 'plaintext',
  isDirty: false,
  mode: 'recorded-file',
  recordedFile: {
    sessionId: 'session-alpha',
    path,
    worktreePath: '/remote/repo',
    runtimeEnvironmentId: 'env-1'
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RecordedFileTabPanel', () => {
  it('names the file, shows its full path with the read-only note, and scrolls the body in the pane', async () => {
    mocks.readPreview.mockResolvedValue({ content: '# Report', isBinary: false })
    const { container } = render(<RecordedFileTabPanel file={file} />)

    expect(screen.getByText('report.md')).toBeTruthy()
    expect(screen.getByText(new RegExp(path.replace(/[./]/g, '\\$&')))).toBeTruthy()
    expect(screen.getByText(/Read-only preview from the remote host/)).toBeTruthy()
    expect(await screen.findByTestId('markdown')).toHaveProperty('textContent', '# Report')
    expect(container.firstElementChild?.classList.contains('h-full')).toBe(true)
    const body = screen.getByTestId('recorded-file-body')
    expect(body.classList.contains('overflow-auto')).toBe(true)
    expect(body.classList.contains('min-h-0')).toBe(true)
  })

  it('renders nothing when the tab has no recorded file to read', () => {
    const { container } = render(
      <RecordedFileTabPanel file={{ ...file, recordedFile: undefined }} />
    )
    expect(container.firstElementChild).toBeNull()
  })
})
