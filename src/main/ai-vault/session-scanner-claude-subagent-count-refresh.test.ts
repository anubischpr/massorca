import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resetSessionParseCacheForTests } from './session-parse-cache-store'
import { scanAiVaultSessions } from './session-scanner'
import { isolatedScanRoots, jsonLines } from './session-scanner-test-fixtures'

let tempRoots: string[] = []

afterEach(async () => {
  resetSessionParseCacheForTests()
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

describe('scanAiVaultSessions subagent count while a child runs', () => {
  it('counts a subagent that starts after the parent was last written', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-subagent-count-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    const projectDir = join(roots.claudeProjectsDir, 'project')
    await mkdir(projectDir, { recursive: true })
    await writeFile(
      join(projectDir, 'claude-session.jsonl'),
      jsonLines([
        {
          type: 'user',
          sessionId: 'claude-session',
          timestamp: '2026-05-01T10:00:00.000Z',
          cwd: '/repo/app',
          message: { role: 'user', content: 'Spawn a Task' }
        },
        {
          type: 'assistant',
          sessionId: 'claude-session',
          timestamp: '2026-05-01T10:00:05.000Z',
          cwd: '/repo/app',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Spawning' }] }
        }
      ])
    )

    const first = await scanAiVaultSessions({ ...roots, platform: 'darwin' })
    expect(first.sessions[0]).toMatchObject({ messageCount: 2, subagentTranscriptCount: 0 })

    // The parent transcript is untouched: only the child writes while it runs.
    const subagentsDir = join(projectDir, 'claude-session', 'subagents')
    await mkdir(subagentsDir, { recursive: true })
    await writeFile(
      join(subagentsDir, 'agent-abc123.jsonl'),
      jsonLines([
        {
          type: 'user',
          sessionId: 'claude-session',
          isSidechain: true,
          agentId: 'abc123',
          timestamp: '2026-05-01T10:01:00.000Z',
          message: { role: 'user', content: 'Subagent task prompt' }
        }
      ])
    )

    const second = await scanAiVaultSessions({ ...roots, platform: 'darwin' })
    expect(second.sessions).toHaveLength(1)
    expect(second.sessions[0]).toMatchObject({ messageCount: 2, subagentTranscriptCount: 1 })
  })
})
