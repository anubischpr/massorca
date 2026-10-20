import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readHostPiRuntimeAnswer,
  recordHostPiRuntimeAnswer,
  requestHostPiRuntimeAnswer,
  resetHostPiRuntimeAnswers
} from './pi-host-runtime-answer'

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('requestHostPiRuntimeAnswer', () => {
  beforeEach(() => {
    resetHostPiRuntimeAnswers()
  })

  it('asks the host once for a workspace, even for concurrent requests', async () => {
    const ask = vi.fn().mockResolvedValue('gentle-shell')
    requestHostPiRuntimeAnswer('wt-1', ask)
    requestHostPiRuntimeAnswer('wt-1', ask)
    await flush()
    requestHostPiRuntimeAnswer('wt-1', ask)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('records a host answer that labels read back, and does not ask again for it', async () => {
    const ask = vi.fn().mockResolvedValue('gentle-shell')
    expect(readHostPiRuntimeAnswer('wt-2')).toBeUndefined()
    requestHostPiRuntimeAnswer('wt-2', ask)
    await flush()
    expect(readHostPiRuntimeAnswer('wt-2')).toBe('gentle-shell')
    requestHostPiRuntimeAnswer('wt-2', ask)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('asks again when the host cannot be asked yet', async () => {
    const ask = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('pi')
    requestHostPiRuntimeAnswer('wt-3', ask)
    await flush()
    expect(readHostPiRuntimeAnswer('wt-3')).toBeUndefined()
    requestHostPiRuntimeAnswer('wt-3', ask)
    await flush()
    expect(readHostPiRuntimeAnswer('wt-3')).toBe('pi')
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('treats a failed ask as an unknown answer, which is not asked again', async () => {
    const ask = vi.fn().mockRejectedValue(new Error('offline'))
    requestHostPiRuntimeAnswer('wt-4', ask)
    await flush()
    expect(readHostPiRuntimeAnswer('wt-4')).toBe('unknown')
    requestHostPiRuntimeAnswer('wt-4', ask)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('ignores an empty workspace id', () => {
    const ask = vi.fn().mockResolvedValue('pi')
    requestHostPiRuntimeAnswer('', ask)
    expect(ask).not.toHaveBeenCalled()
    recordHostPiRuntimeAnswer('', 'pi')
  })
})
