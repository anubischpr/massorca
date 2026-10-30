import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  initInternalAgentRunRegistry,
  listInternalAgentRuns,
  resetInternalAgentRunRegistryForTests
} from '../ai-vault/internal-agent-run-registry'
import { createMockDiscoveryChild } from './commit-message-text-generation-test-harness'
import { generateConversationName } from './conversation-name-generation-request'
import type { SpawnedSourceControlAgentProcess } from './source-control-text-generation-types'

afterEach(() => resetInternalAgentRunRegistryForTests())

describe('background generation run recording', () => {
  it('records a local run at spawn and its end when the agent exits', async () => {
    initInternalAgentRunRegistry({ filePath: '' })
    const child = createMockDiscoveryChild()
    const spawnAgent = vi.fn(() => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The test child implements every process member the generation lane reads.
      return child as unknown as SpawnedSourceControlAgentProcess
    })
    const pending = generateConversationName({
      context: { firstPrompt: 'Fix login' },
      params: { agentId: 'claude', model: 'haiku' },
      target: { kind: 'local', cwd: '/repo' },
      spawnAgent
    })
    await vi.waitFor(() => expect(spawnAgent).toHaveBeenCalled())
    expect(listInternalAgentRuns()).toMatchObject([
      { agentId: 'claude', cwd: '/repo', endedAtMs: null }
    ])

    child.stdout.emit('data', Buffer.from('Fix login flow\n'))
    child.emit('close', 0)
    expect(await pending).toMatchObject({ success: true })
    expect(listInternalAgentRuns()[0].endedAtMs).toEqual(expect.any(Number))
  })

  it('does not record a remote run, whose transcript lives on another host', async () => {
    initInternalAgentRunRegistry({ filePath: '' })
    await generateConversationName({
      context: { firstPrompt: 'Fix login' },
      params: { agentId: 'custom', model: '', customAgentCommand: 'agent' },
      target: {
        kind: 'remote',
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: async () => ({ stdout: 'Fix login', stderr: '', exitCode: 0, timedOut: false })
      },
      spawnAgent: vi.fn()
    })
    expect(listInternalAgentRuns()).toEqual([])
  })
})
