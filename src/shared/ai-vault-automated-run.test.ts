import { describe, expect, it } from 'vitest'
import {
  aiVaultAutomatedRunKind,
  applyAiVaultAutomatedRunsSwitch,
  isAiVaultAutomatedRun
} from './ai-vault-automated-run'
import { filterAiVaultSessions, type AiVaultSessionFilterState } from './ai-vault-session-filters'
import type { AiVaultSession } from './ai-vault-types'

function session(overrides: Partial<AiVaultSession> = {}): AiVaultSession {
  return {
    id: 'claude:1',
    executionHostId: 'local',
    agent: 'claude',
    sessionId: 'session-1',
    title: 'Implement vault filters',
    cwd: '/Users/ada/repo/app',
    branch: null,
    model: null,
    filePath: '/Users/ada/.claude/projects/session-1.jsonl',
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-05-01T10:10:00.000Z',
    modifiedAt: '2026-05-01T10:10:00.000Z',
    messageCount: 2,
    totalTokens: 0,
    previewMessages: [{ role: 'user', text: 'add the scope tabs', timestamp: null }],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    ...overrides
  }
}

const REVIEW_PROMPT = 'You are a code reviewer. Review the staged diff and report findings.'
const SDD_PROMPT = 'You are the sdd-apply subagent. Implement the tasks for this change.'

describe('aiVaultAutomatedRunKind', () => {
  it('names a code review from the title', () => {
    expect(aiVaultAutomatedRunKind(session({ title: REVIEW_PROMPT }))).toBe('review')
  })

  it('names an SDD worker from the title', () => {
    expect(aiVaultAutomatedRunKind(session({ title: SDD_PROMPT }))).toBe('sdd')
  })

  it('still names a run whose title is truncated with an ellipsis', () => {
    expect(
      aiVaultAutomatedRunKind(
        session({ title: 'You are the sdd-verify subagent. Check the cha...' })
      )
    ).toBe('sdd')
    expect(
      aiVaultAutomatedRunKind(session({ title: 'You are a code reviewer for the wor...' }))
    ).toBe('review')
  })

  it('reads the opening prompt when the title is a generated one', () => {
    const generated = session({
      title: 'Review of the auth change',
      previewMessages: [
        { role: 'user', text: REVIEW_PROMPT, timestamp: null },
        { role: 'assistant', text: 'Reviewing now.', timestamp: null }
      ]
    })

    expect(aiVaultAutomatedRunKind(generated)).toBe('review')
  })

  it('does not read a preview window that starts mid-conversation', () => {
    const truncated = session({
      title: 'Ship the scope tabs',
      previewMessagesTruncated: true,
      previewMessages: [{ role: 'user', text: REVIEW_PROMPT, timestamp: null }]
    })

    expect(aiVaultAutomatedRunKind(truncated)).toBeNull()
  })

  it('uses the stored first prompt for a truncated window', () => {
    const stored = session({
      title: 'Ship the scope tabs',
      previewMessagesTruncated: true,
      firstUserPrompt: SDD_PROMPT
    })

    expect(aiVaultAutomatedRunKind(stored)).toBe('sdd')
  })

  it('ignores leading whitespace before the prefix', () => {
    expect(aiVaultAutomatedRunKind(session({ title: `\n  ${REVIEW_PROMPT}` }))).toBe('review')
  })

  it('needs the exact prefixes, not a sentence that mentions them', () => {
    expect(
      aiVaultAutomatedRunKind(session({ title: 'Please act as a code reviewer for this diff' }))
    ).toBeNull()
    expect(
      aiVaultAutomatedRunKind(session({ title: 'You are the sdd-apply worker for this change' }))
    ).toBeNull()
  })

  it('returns null for an ordinary session', () => {
    expect(aiVaultAutomatedRunKind(session())).toBeNull()
  })
})

describe('isAiVaultAutomatedRun', () => {
  it('is true for a prompt-named run of either kind', () => {
    expect(isAiVaultAutomatedRun(session({ title: REVIEW_PROMPT }))).toBe(true)
    expect(isAiVaultAutomatedRun(session({ title: SDD_PROMPT }))).toBe(true)
  })

  it('is true for a Codex exec run with no known prefix, which gets no kind', () => {
    const codexExec = session({
      id: 'codex:2',
      agent: 'codex',
      title: 'Rename the settings key',
      headlessRun: true
    })

    expect(aiVaultAutomatedRunKind(codexExec)).toBeNull()
    expect(isAiVaultAutomatedRun(codexExec)).toBe(true)
  })

  it('is false for an ordinary session', () => {
    expect(isAiVaultAutomatedRun(session())).toBe(false)
  })
})

describe('applyAiVaultAutomatedRunsSwitch', () => {
  const REPO_PATH = '/Users/ada/repo/app'
  const ordinary = session({
    id: 'claude:ordinary',
    sessionId: 'ordinary',
    title: 'Fix the tab bar',
    updatedAt: '2026-05-01T10:00:00.000Z'
  })
  const review = session({
    id: 'claude:review',
    sessionId: 'review',
    title: REVIEW_PROMPT,
    updatedAt: '2026-05-01T11:00:00.000Z'
  })
  const sddWorker = session({
    id: 'claude:sdd',
    sessionId: 'sdd',
    title: SDD_PROMPT,
    updatedAt: '2026-05-01T12:00:00.000Z'
  })
  const codexExec = session({
    id: 'codex:exec',
    agent: 'codex',
    sessionId: 'exec',
    title: 'Rename the settings key',
    headlessRun: true,
    updatedAt: '2026-05-01T09:00:00.000Z'
  })
  const emptyReview = session({
    id: 'claude:empty-review',
    sessionId: 'empty-review',
    title: REVIEW_PROMPT,
    messageCount: 0,
    previewMessages: [],
    updatedAt: '2026-05-01T08:00:00.000Z'
  })
  const elsewhere = session({
    id: 'claude:elsewhere',
    sessionId: 'elsewhere',
    title: REVIEW_PROMPT,
    cwd: '/Users/ada/other/app',
    updatedAt: '2026-05-01T07:00:00.000Z'
  })
  const sessions = [ordinary, review, sddWorker, codexExec, emptyReview, elsewhere]
  const filters: AiVaultSessionFilterState = {
    query: '',
    agents: ['claude', 'codex'],
    scope: 'all',
    sort: 'updated',
    activeWorktreePaths: [REPO_PATH],
    hideEmptySessions: false
  }
  const inScope = (overrides: Partial<AiVaultSessionFilterState>) =>
    filterAiVaultSessions(sessions, { ...filters, ...overrides })
  const idsOf = (rows: readonly AiVaultSession[]): string[] => rows.map((row) => row.id)

  it('hides automated runs by default, in the all and workspace scopes', () => {
    expect(idsOf(applyAiVaultAutomatedRunsSwitch(inScope({}), false).sessions)).toEqual([
      'claude:ordinary'
    ])
    expect(
      idsOf(applyAiVaultAutomatedRunsSwitch(inScope({ scope: 'workspace' }), false).sessions)
    ).toEqual(['claude:ordinary'])
  })

  it('shows every automated run, newest first, when the switch is on', () => {
    expect(idsOf(applyAiVaultAutomatedRunsSwitch(inScope({}), true).sessions)).toEqual([
      'claude:sdd',
      'claude:review',
      'claude:ordinary',
      'codex:exec',
      'claude:empty-review',
      'claude:elsewhere'
    ])
  })

  it('counts the scope automated runs whether or not the switch shows them', () => {
    expect(applyAiVaultAutomatedRunsSwitch(inScope({}), false).automatedRunCount).toBe(5)
    expect(applyAiVaultAutomatedRunsSwitch(inScope({}), true).automatedRunCount).toBe(5)
    expect(
      applyAiVaultAutomatedRunsSwitch(inScope({ scope: 'workspace' }), false).automatedRunCount
    ).toBe(4)
  })

  it('counts after the agent and empty-session filters', () => {
    expect(
      applyAiVaultAutomatedRunsSwitch(inScope({ agents: ['claude'] }), false).automatedRunCount
    ).toBe(4)
    expect(
      applyAiVaultAutomatedRunsSwitch(inScope({ hideEmptySessions: true }), false).automatedRunCount
    ).toBe(4)
  })

  it('counts only the rows the query matches', () => {
    expect(
      applyAiVaultAutomatedRunsSwitch(inScope({ query: 'settings' }), false).automatedRunCount
    ).toBe(1)
  })
})
