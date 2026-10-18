import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockDiscoveryChild } from './commit-message-text-generation-test-harness'
import {
  generateReplySuggestion,
  REPLY_SUGGESTION_TIMEOUT_MS
} from './reply-suggestion-generation-request'
import { cancelLocalGeneration } from './source-control-generation-lanes'
import type {
  SourceControlAgentSpawnInput,
  SpawnedSourceControlAgentProcess
} from './source-control-text-generation-types'

const exchange = {
  userMessage: 'Fix login',
  assistantMessage: 'The fix is applied and tests pass.'
}

function spawnFor(child: ReturnType<typeof createMockDiscoveryChild>) {
  return vi.fn((_input: SourceControlAgentSpawnInput) => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The test child implements every process member the generation lane reads.
    return child as unknown as SpawnedSourceControlAgentProcess
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('generateReplySuggestion', () => {
  it('plans the agent one-shot with the chosen model and returns one sanitized line', async () => {
    const child = createMockDiscoveryChild()
    const spawnAgent = spawnFor(child)
    const pending = generateReplySuggestion({
      exchange,
      params: { agentId: 'claude', model: 'haiku' },
      target: { kind: 'local', cwd: '/repo' },
      spawnAgent
    })
    expect(spawnAgent).toHaveBeenCalledOnce()
    const spawned = spawnAgent.mock.calls[0]?.[0]
    expect(spawned?.args).toEqual(expect.arrayContaining(['-p', '--model', 'haiku']))
    expect(child.stdin.end).toHaveBeenCalledWith(expect.stringContaining('Fix login'))

    child.stdout.emit('data', Buffer.from('"Run the full test suite"\nand explain\n'))
    child.emit('close', 0)
    expect(await pending).toEqual({ success: true, text: 'Run the full test suite' })
  })

  it('fails when the output sanitizes to nothing', async () => {
    const child = createMockDiscoveryChild()
    const pending = generateReplySuggestion({
      exchange,
      params: { agentId: 'claude', model: 'haiku' },
      target: { kind: 'local', cwd: '/repo' },
      spawnAgent: spawnFor(child)
    })
    child.stdout.emit('data', Buffer.from('...\n'))
    child.emit('close', 0)
    expect(await pending).toMatchObject({ success: false })
  })

  it('runs in its own cancellable lane', async () => {
    const child = createMockDiscoveryChild()
    const pending = generateReplySuggestion({
      exchange,
      params: { agentId: 'antigravity', model: 'default' },
      target: { kind: 'local', cwd: '/repo-lane' },
      spawnAgent: spawnFor(child)
    })
    cancelLocalGeneration('reply-suggestion', '/repo-lane')
    expect(await pending).toMatchObject({ success: false, canceled: true })
  })

  it('gives up after the short suggestion cap, not the source-control minute', async () => {
    vi.useFakeTimers()
    const child = createMockDiscoveryChild()
    const pending = generateReplySuggestion({
      exchange,
      params: { agentId: 'pi', model: 'default' },
      target: { kind: 'local', cwd: '/repo-timeout' },
      spawnAgent: spawnFor(child)
    })
    await vi.advanceTimersByTimeAsync(REPLY_SUGGESTION_TIMEOUT_MS)
    expect(await pending).toMatchObject({
      success: false,
      error: 'Generation timed out after 20s.'
    })
  })
})
