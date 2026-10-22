import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as admission from '@/lib/structured-agent-session-host-admission'

const askHostCreateSupport = vi.hoisted(() => vi.fn())

vi.mock('@/lib/structured-agent-session-host-admission', async (importOriginal) => {
  const actual = await importOriginal<typeof admission>()
  return { ...actual, askHostCreateSupport }
})

import {
  askHostPiTerminalRuntime,
  hostPiTerminalRuntimeFromCreateSupport
} from './pi-terminal-host-runtime'

describe('hostPiTerminalRuntimeFromCreateSupport', () => {
  it('reads the runtime an admitting host resolved for Pi', () => {
    expect(
      hostPiTerminalRuntimeFromCreateSupport({
        kind: 'admitted',
        seedOptions: { piRuntime: 'gentle-shell' }
      })
    ).toBe('gentle-shell')
    expect(
      hostPiTerminalRuntimeFromCreateSupport({ kind: 'admitted', seedOptions: { piRuntime: 'pi' } })
    ).toBe('pi')
  })

  it('reads stock Pi when an admitting host named no runtime', () => {
    expect(hostPiTerminalRuntimeFromCreateSupport({ kind: 'admitted' })).toBe('pi')
  })

  it('reads stock Pi for a host that refused only restricted access', () => {
    expect(hostPiTerminalRuntimeFromCreateSupport({ kind: 'policy-unsupported' })).toBe('pi')
  })

  it('reads neither runtime when the host named the missing CLI', () => {
    expect(
      hostPiTerminalRuntimeFromCreateSupport({
        kind: 'declined',
        cause: 'cliMissing'
      })
    ).toBe('cliMissing')
  })

  it('reads unknown for a refusal that names no cause, or an unreachable host', () => {
    expect(hostPiTerminalRuntimeFromCreateSupport({ kind: 'declined' })).toBe('unknown')
    expect(hostPiTerminalRuntimeFromCreateSupport({ kind: 'workspace-unresolved' })).toBe('unknown')
    expect(
      hostPiTerminalRuntimeFromCreateSupport({
        kind: 'unreachable',
        code: 'runtime_unavailable',
        message: 'down',
        error: new Error('down')
      })
    ).toBe('unknown')
  })
})

describe('askHostPiTerminalRuntime', () => {
  beforeEach(() => {
    askHostCreateSupport.mockReset()
  })

  it('asks the host for Pi on the workspace and maps its answer', async () => {
    askHostCreateSupport.mockResolvedValue({
      kind: 'admitted',
      seedOptions: { piRuntime: 'gentle-shell' }
    })
    const target = { kind: 'environment' as const, environmentId: 'env-1' }

    await expect(askHostPiTerminalRuntime(target, 'wt-1')).resolves.toBe('gentle-shell')
    expect(askHostCreateSupport).toHaveBeenCalledWith(target, 'wt-1', 'pi')
  })
})
