import { describe, expect, it } from 'vitest'
import { nestAiVaultDelegatedChildren } from './ai-vault-delegated-nesting'
import type { AiVaultSession } from './ai-vault-types'

function session(overrides: Partial<AiVaultSession> & { id: string }): AiVaultSession {
  return {
    executionHostId: 'local',
    agent: 'claude',
    sessionId: overrides.id,
    title: overrides.id,
    cwd: '/repo',
    branch: null,
    model: null,
    filePath: `/sessions/${overrides.id}.jsonl`,
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-10-29T10:00:00.000Z',
    modifiedAt: '2026-10-29T10:00:00.000Z',
    messageCount: 2,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    structuredSession: { sessionId: `chat-${overrides.id}`, workspaceId: 'ws' },
    ...overrides
  }
}

function child(id: string, parentId: string, overrides: Partial<AiVaultSession> = {}) {
  return session({
    id,
    delegatedFrom: { parentSessionId: `chat-${parentId}`, status: 'working' },
    ...overrides
  })
}

describe('nestAiVaultDelegatedChildren', () => {
  it('nests a child under its visible parent and keeps it out of the top level', () => {
    const parent = session({ id: 'parent' })
    const kid = child('kid', 'parent')

    const nesting = nestAiVaultDelegatedChildren([parent, kid], [parent, kid])

    expect(nesting.roots).toEqual([parent])
    expect(nesting.childrenByRootId.get('parent')).toEqual([kid])
  })

  it('shows a child as a root when its parent is out of scope', () => {
    const kid = child('kid', 'parent')

    const nesting = nestAiVaultDelegatedChildren([kid], [kid])

    expect(nesting.roots).toEqual([kid])
    expect(nesting.childrenByRootId.size).toBe(0)
  })

  it('shows a child as a root when the switch hides its parent', () => {
    const parent = session({ id: 'parent', title: 'You are a code reviewer. Review.' })
    const kid = child('kid', 'parent')

    const nesting = nestAiVaultDelegatedChildren([parent, kid], [kid])

    expect(nesting.roots).toEqual([kid])
    expect(nesting.childrenByRootId.size).toBe(0)
  })

  it('keeps an automated-run child nested under a visible parent when the switch is off', () => {
    const parent = session({ id: 'parent' })
    const automatedKid = child('kid', 'parent', { title: 'You are the sdd-apply subagent.' })

    const nesting = nestAiVaultDelegatedChildren([parent, automatedKid], [parent])

    expect(nesting.roots).toEqual([parent])
    expect(nesting.childrenByRootId.get('parent')).toEqual([automatedKid])
  })

  it('nests a grandchild under the same root, since the list has one level', () => {
    const parent = session({ id: 'parent' })
    const kid = child('kid', 'parent')
    const grandchild = child('grand', 'kid')

    const nesting = nestAiVaultDelegatedChildren(
      [parent, kid, grandchild],
      [parent, kid, grandchild]
    )

    expect(nesting.roots).toEqual([parent])
    expect(nesting.childrenByRootId.get('parent')).toEqual([kid, grandchild])
  })

  it('resolves every row once when two sessions name each other as parent', () => {
    const first = child('first', 'second')
    const second = child('second', 'first')

    const nesting = nestAiVaultDelegatedChildren([first, second], [first, second])

    const placed = [...nesting.roots, ...[...nesting.childrenByRootId.values()].flat()].map(
      (row) => row.id
    )
    expect(placed.sort()).toEqual(['first', 'second'])
  })

  it('does not match a parent on another execution host', () => {
    const remoteParent = session({
      id: 'parent',
      executionHostId: 'ssh:devbox',
      structuredSession: { sessionId: 'chat-parent', workspaceId: 'ws' }
    })
    const localKid = child('kid', 'parent')

    const nesting = nestAiVaultDelegatedChildren([remoteParent, localKid], [remoteParent, localKid])

    expect(nesting.roots).toEqual([remoteParent, localKid])
    expect(nesting.childrenByRootId.size).toBe(0)
  })

  it('leaves a parent without a structured session unmatched', () => {
    const plainParent = session({ id: 'parent', structuredSession: undefined })
    const kid = child('kid', 'parent')

    const nesting = nestAiVaultDelegatedChildren([plainParent, kid], [plainParent, kid])

    expect(nesting.roots).toEqual([plainParent, kid])
  })
})
