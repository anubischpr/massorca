import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import {
  cachedRecordedFileContent,
  readRecordedFilePreview,
  resetRecordedFileCacheForTest
} from './mobile-recorded-file-cache'
import { readMobileRecordedFile, type MobileRecordedFileRead } from './mobile-recorded-file-read'

vi.mock('./mobile-recorded-file-read', () => ({
  readMobileRecordedFile: vi.fn()
}))

const read = vi.mocked(readMobileRecordedFile)
const client = {} as RpcClient
const source = { client, sessionId: 'session-1' }

function answer(result: MobileRecordedFileRead): void {
  read.mockResolvedValueOnce(result)
}

describe('recorded file cache', () => {
  beforeEach(() => {
    resetRecordedFileCacheForTest()
    read.mockReset()
  })

  it('keeps a ready page so the viewer reuses what the thumbnail read', async () => {
    answer({ kind: 'ready', content: '<h1>usage</h1>' })
    await expect(readRecordedFilePreview(source, 'usage.html')).resolves.toBe('<h1>usage</h1>')
    expect(cachedRecordedFileContent(source, 'usage.html')).toBe('<h1>usage</h1>')
    await expect(readRecordedFilePreview(source, 'usage.html')).resolves.toBe('<h1>usage</h1>')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('shares one request between concurrent readers of the same file', async () => {
    answer({ kind: 'ready', content: 'x' })
    const [first, second] = await Promise.all([
      readRecordedFilePreview(source, 'a.html'),
      readRecordedFilePreview(source, 'a.html')
    ])
    expect([first, second]).toEqual(['x', 'x'])
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('never keeps a refusal, so the next reader asks the host again', async () => {
    answer({ kind: 'refused', reason: 'not_found' })
    answer({ kind: 'ready', content: 'back' })
    await expect(readRecordedFilePreview(source, 'gone.html')).resolves.toBeNull()
    expect(cachedRecordedFileContent(source, 'gone.html')).toBeNull()
    await expect(readRecordedFilePreview(source, 'gone.html')).resolves.toBe('back')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps each host apart, so one host never answers for another', async () => {
    answer({ kind: 'ready', content: 'one' })
    answer({ kind: 'ready', content: 'two' })
    const other = { client: {} as RpcClient, sessionId: 'session-1' }
    await readRecordedFilePreview(source, 'p.html')
    await expect(readRecordedFilePreview(other, 'p.html')).resolves.toBe('two')
    expect(read).toHaveBeenCalledTimes(2)
  })
})
