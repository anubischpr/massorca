// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readHostPiRuntimeAnswer, resetHostPiRuntimeAnswers } from '@/lib/pi-host-runtime-answer'
import { localMarketplaceAgents, readLocalPiAnswer } from './marketplace-local-agents'

const mocks = vi.hoisted(() => ({ askHostPiRuntimeForWorktree: vi.fn() }))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/lib/pi-terminal-host-runtime', () => ({
  askHostPiRuntimeForWorktree: (...args: unknown[]) => mocks.askHostPiRuntimeForWorktree(...args)
}))

beforeEach(() => {
  resetHostPiRuntimeAnswers()
  mocks.askHostPiRuntimeForWorktree.mockReset()
})

describe('localMarketplaceAgents', () => {
  it('lists the detected board agents, and no Gentle Shell, when no Pi is detected', () => {
    const agents = localMarketplaceAgents({
      detectedIds: ['claude'],
      command: undefined,
      hostAnswer: undefined
    })
    expect(agents.detected).toEqual(['claude'])
    expect(agents.gentleShell).toEqual({ kind: 'ready', value: false })
  })

  it.each([
    ['gentle-shell', { kind: 'ready', value: true }],
    ['pi', { kind: 'ready', value: false }],
    ['cliMissing', { kind: 'ready', value: false }],
    ['unknown', { kind: 'failed' }],
    [undefined, { kind: 'loading' }]
  ] as const)('reads Gentle Shell from a Pi detected host answer of %s', (hostAnswer, expected) => {
    const agents = localMarketplaceAgents({
      detectedIds: ['pi'],
      command: undefined,
      hostAnswer
    })
    expect(agents.gentleShell).toEqual(expected)
    expect(agents.detected).not.toContain('gentle-shell')
  })
})

describe('readLocalPiAnswer', () => {
  it('asks the workspace host once and keeps its answer, as the agent page does', async () => {
    mocks.askHostPiRuntimeForWorktree.mockResolvedValue('gentle-shell')
    await expect(readLocalPiAnswer('wt-1', undefined)).resolves.toBe('gentle-shell')
    expect(readHostPiRuntimeAnswer('wt-1')).toBe('gentle-shell')
    await expect(readLocalPiAnswer('wt-1', undefined)).resolves.toBe('gentle-shell')
    expect(mocks.askHostPiRuntimeForWorktree).toHaveBeenCalledTimes(1)
    expect(mocks.askHostPiRuntimeForWorktree).toHaveBeenCalledWith('wt-1')
  })

  it('reads a host that cannot be asked as unknown, and records that answer', async () => {
    mocks.askHostPiRuntimeForWorktree.mockResolvedValue(null)
    await expect(readLocalPiAnswer('wt-2', undefined)).resolves.toBe('unknown')
    expect(readHostPiRuntimeAnswer('wt-2')).toBe('unknown')
  })

  it('reads a failed ask as unknown', async () => {
    mocks.askHostPiRuntimeForWorktree.mockRejectedValue(new Error('host unreachable'))
    await expect(readLocalPiAnswer('wt-3', undefined)).resolves.toBe('unknown')
  })

  it('asks nothing without a workspace, and nothing when a Pi command is set', async () => {
    await expect(readLocalPiAnswer('', undefined)).resolves.toBe('unknown')
    await expect(readLocalPiAnswer('wt-4', '/usr/local/bin/pi')).resolves.toBeUndefined()
    expect(mocks.askHostPiRuntimeForWorktree).not.toHaveBeenCalled()
  })
})
