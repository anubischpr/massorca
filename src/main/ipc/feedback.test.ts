import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, createIssueInRepositoryMock, fetchMock } = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  createIssueInRepositoryMock: vi.fn(),
  fetchMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: vi.fn(),
    handle: (channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  net: { fetch: fetchMock }
}))

vi.mock('../github/issue-create', () => ({
  createIssueInRepository: createIssueInRepositoryMock
}))

import { registerFeedbackHandlers, submitFeedback } from './feedback'

const MASSORCA_REPO = { owner: 'anubischpr', repo: 'massorca' }

describe('submitFeedback', () => {
  beforeEach(() => {
    handlers.clear()
    createIssueInRepositoryMock.mockReset()
    fetchMock.mockReset()
    createIssueInRepositoryMock.mockResolvedValue({
      ok: true,
      number: 7,
      url: 'https://github.com/anubischpr/massorca/issues/7'
    })
  })

  it('creates the issue on the MassOrca repo and never calls the upstream service', async () => {
    const result = await submitFeedback({ feedback: 'Tabs feel slow\n\nMore detail' })

    expect(result).toEqual({
      ok: true,
      url: 'https://github.com/anubischpr/massorca/issues/7'
    })
    expect(createIssueInRepositoryMock).toHaveBeenCalledTimes(1)
    expect(createIssueInRepositoryMock).toHaveBeenCalledWith(
      MASSORCA_REPO,
      { encoding: 'utf-8' },
      'Feedback: Tabs feel slow',
      'Tabs feel slow\n\nMore detail'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caps the derived title at one short line', async () => {
    await submitFeedback({ feedback: `\n  ${'x'.repeat(200)}\nsecond line` })

    const title = createIssueInRepositoryMock.mock.calls[0]?.[2] as string
    expect(title).toBe(`Feedback: ${'x'.repeat(79)}…`)
  })

  it('uses an explicit title when the caller provides one', async () => {
    await submitFeedback({ title: 'Crash report: gpu crashed', feedback: '[Crash Report]' })

    expect(createIssueInRepositoryMock.mock.calls[0]?.[2]).toBe('Crash report: gpu crashed')
  })

  it('reports a gh failure so the dialog can keep the draft', async () => {
    createIssueInRepositoryMock.mockResolvedValue({ ok: false, error: 'gh auth login required' })

    await expect(submitFeedback({ feedback: 'Report' })).resolves.toEqual({
      ok: false,
      status: null,
      error: 'gh auth login required'
    })
  })

  it('reports an unexpected create failure instead of rejecting', async () => {
    createIssueInRepositoryMock.mockRejectedValue(new Error('gh missing'))

    await expect(submitFeedback({ feedback: 'Report' })).resolves.toEqual({
      ok: false,
      status: null,
      error: 'gh missing'
    })
  })
})

describe('feedback:submit handler', () => {
  beforeEach(() => {
    handlers.clear()
    createIssueInRepositoryMock.mockReset()
    createIssueInRepositoryMock.mockResolvedValue({ ok: true, number: 1, url: 'u' })
    registerFeedbackHandlers()
  })

  it('publishes only the feedback text, dropping any other renderer field', async () => {
    const handler = handlers.get('feedback:submit')
    await handler?.(null, {
      feedback: 'Report',
      title: 'Forged title',
      images: [{ contentType: 'image/png', data: new Uint8Array([1]) }]
    })

    expect(createIssueInRepositoryMock).toHaveBeenCalledWith(
      MASSORCA_REPO,
      { encoding: 'utf-8' },
      'Feedback: Report',
      'Report'
    )
  })

  it('rejects a non-string payload without creating an issue', async () => {
    const handler = handlers.get('feedback:submit')
    await expect(handler?.(null, { feedback: 42 })).resolves.toEqual({
      ok: false,
      status: null,
      error: 'Feedback text is required.'
    })
    expect(createIssueInRepositoryMock).not.toHaveBeenCalled()
  })
})
