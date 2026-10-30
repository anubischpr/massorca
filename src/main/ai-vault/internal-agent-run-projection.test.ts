import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiVaultListResult, AiVaultSession } from '../../shared/ai-vault-types'
import { isAiVaultAutomatedRun } from '../../shared/ai-vault-automated-run'
import { projectInternalAgentRunAiVaultSessions } from './internal-agent-run-projection'
import {
  initInternalAgentRunRegistry,
  listInternalAgentRuns,
  recordInternalAgentRunStart,
  resetInternalAgentRunRegistryForTests,
  type InternalAgentRun
} from './internal-agent-run-registry'

const START = Date.parse('2026-05-01T10:00:00.000Z')
const CWD = 'D:\\projects\\repo'

function run(overrides: Partial<InternalAgentRun> = {}): InternalAgentRun {
  return { agentId: 'claude', cwd: CWD, startedAtMs: START, endedAtMs: START + 6_000, ...overrides }
}

function session(overrides: Partial<AiVaultSession> = {}): AiVaultSession {
  return {
    id: 'local:claude:s1:/p/s1.jsonl',
    executionHostId: 'local',
    agent: 'claude',
    sessionId: 's1',
    // A custom prompt template leaves no recognizable prefix in the title.
    title: 'Summarize this diff in one line',
    cwd: 'd:/projects/repo/',
    branch: null,
    model: null,
    filePath: '/p/s1.jsonl',
    codexHome: null,
    createdAt: new Date(START + 1_000).toISOString(),
    updatedAt: new Date(START + 5_000).toISOString(),
    modifiedAt: new Date(START + 5_000).toISOString(),
    messageCount: 2,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    ...overrides
  }
}

function project(sessions: AiVaultSession[], runs: InternalAgentRun[]): AiVaultSession[] {
  const result: AiVaultListResult = { sessions, issues: [], scannedAt: '2026-05-01T10:01:00.000Z' }
  return projectInternalAgentRunAiVaultSessions(result, runs).sessions
}

describe('projectInternalAgentRunAiVaultSessions', () => {
  it('marks the transcript a recorded run left behind, whatever its title says', () => {
    const [marked] = project([session()], [run()])
    expect(marked.headlessRun).toBe(true)
    expect(isAiVaultAutomatedRun(marked)).toBe(true)
  })

  it('marks a run still in flight', () => {
    const [marked] = project([session()], [run({ endedAtMs: null })])
    expect(marked.headlessRun).toBe(true)
  })

  it('leaves a session the user kept using after the run ended', () => {
    const [kept] = project(
      [session({ updatedAt: new Date(START + 600_000).toISOString() })],
      [run()]
    )
    expect(kept.headlessRun).toBeUndefined()
  })

  it('leaves a session that started outside the run window', () => {
    const early = session({ createdAt: new Date(START - 60_000).toISOString() })
    const late = session({ createdAt: new Date(START + 60_000).toISOString() })
    expect(project([early, late], [run()]).map((s) => s.headlessRun)).toEqual([
      undefined,
      undefined
    ])
  })

  it('leaves a session in another directory or another agent', () => {
    const otherCwd = session({ cwd: 'D:/projects/other' })
    const otherAgent = session({ agent: 'codex' })
    expect(project([otherCwd, otherAgent], [run()]).map((s) => s.headlessRun)).toEqual([
      undefined,
      undefined
    ])
  })

  it('lets a custom command match any agent', () => {
    const [marked] = project([session({ agent: 'codex' })], [run({ agentId: 'custom' })])
    expect(marked.headlessRun).toBe(true)
  })

  it('leaves another host and sessions with no start time alone', () => {
    const remote = session({ executionHostId: 'ssh:box' })
    const undated = session({ createdAt: null })
    expect(project([remote, undated], [run()]).map((s) => s.headlessRun)).toEqual([
      undefined,
      undefined
    ])
  })

  it('returns the same result when nothing matched', () => {
    const result: AiVaultListResult = { sessions: [session()], issues: [], scannedAt: 'x' }
    expect(projectInternalAgentRunAiVaultSessions(result, [])).toBe(result)
  })
})

describe('internal agent run registry', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orca-internal-runs-'))
    vi.useFakeTimers()
  })

  afterEach(async () => {
    vi.useRealTimers()
    resetInternalAgentRunRegistryForTests()
    await rm(dir, { recursive: true, force: true })
  })

  it('records the spawn, its end, and survives a restart', async () => {
    const filePath = join(dir, 'ai-vault', 'internal-agent-runs.json')
    initInternalAgentRunRegistry({ filePath })
    const end = recordInternalAgentRunStart({ agentId: 'claude', cwd: CWD }, Date.now())
    expect(listInternalAgentRuns()).toMatchObject([
      { agentId: 'claude', cwd: CWD, endedAtMs: null }
    ])
    end()
    expect(listInternalAgentRuns()[0].endedAtMs).not.toBeNull()

    await vi.advanceTimersByTimeAsync(1_500)
    expect(JSON.parse(await readFile(filePath, 'utf8')).runs).toHaveLength(1)

    resetInternalAgentRunRegistryForTests()
    initInternalAgentRunRegistry({ filePath })
    expect(listInternalAgentRuns()).toMatchObject([{ agentId: 'claude', cwd: CWD }])
  })

  it('drops records older than the retention window on load', async () => {
    const filePath = join(dir, 'runs.json')
    initInternalAgentRunRegistry({ filePath })
    recordInternalAgentRunStart({ agentId: 'claude', cwd: CWD }, Date.now() - 40 * 86_400_000)
    await vi.advanceTimersByTimeAsync(1_500)
    resetInternalAgentRunRegistryForTests()
    initInternalAgentRunRegistry({ filePath })
    expect(listInternalAgentRuns()).toEqual([])
  })
})
