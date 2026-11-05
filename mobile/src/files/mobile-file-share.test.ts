import { Buffer } from 'buffer/index.js'
import * as Sharing from 'expo-sharing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcResponse } from '../transport/types'
import type { MobileFilePreviewRpcSender } from './mobile-file-preview-operations'
import { shareMobileFile } from './mobile-file-share'

vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(), shareAsync: vi.fn() }))
const sink = vi.hoisted(() => ({
  append: vi.fn(),
  finish: vi.fn(() => 'file:///cache/q3.pdf'),
  dispose: vi.fn()
}))
vi.mock('./mobile-media-preview-cache', () => ({ createMobileMediaSink: () => sink }))

const ok = (result: unknown): RpcResponse => ({
  id: '1',
  ok: true,
  result,
  _meta: { runtimeId: 'host' }
})
const target = { worktreeId: 'folder:1', relativePath: 'reports/q3.pdf' }

function hostReplying(replies: RpcResponse[]) {
  const sendRequest = vi.fn(async (_method: string, _params?: unknown, _options?: unknown) => {
    const reply = replies.shift()
    if (!reply) {
      throw new Error('Unexpected request')
    }
    return reply
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The share path only calls sendRequest.
  return { sendRequest, client: { sendRequest } as never as MobileFilePreviewRpcSender }
}

describe('shareMobileFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downloads the room file through the media download path and shares its local copy', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const { client, sendRequest } = hostReplying([
      ok({ size: 3, mtime: 1, isDirectory: false }),
      ok({ contentBase64: Buffer.from(bytes).toString('base64'), bytesRead: 3, eof: true }),
      ok({ size: 3, mtime: 1, isDirectory: false })
    ])
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    vi.mocked(Sharing.shareAsync).mockResolvedValue(undefined)

    await expect(shareMobileFile(client, target, 'q3.pdf')).resolves.toBe('shared')

    expect(sendRequest.mock.calls.map((call) => call[0])).toEqual([
      'files.stat',
      'files.readChunk',
      'files.stat'
    ])
    expect(sendRequest.mock.calls[0]?.[1]).toEqual({
      worktree: 'id:folder:1',
      relativePath: 'reports/q3.pdf'
    })
    expect(sink.append).toHaveBeenCalledOnce()
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/q3.pdf', {
      mimeType: 'application/octet-stream',
      dialogTitle: 'q3.pdf'
    })
  })

  it('says sharing is unavailable without downloading the file', async () => {
    const { client, sendRequest } = hostReplying([])
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)

    await expect(shareMobileFile(client, target, 'q3.pdf')).resolves.toBe('unavailable')

    expect(sendRequest).not.toHaveBeenCalled()
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
  })
})
