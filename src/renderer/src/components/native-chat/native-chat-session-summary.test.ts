import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'
import {
  githubSlugFromIdentityKey,
  nativeChatSessionConnectors,
  nativeChatSessionPlan,
  nativeChatSessionResults,
  nativeChatSessionServers,
  workspaceBranchName,
  workspaceFolderName
} from './native-chat-session-summary'

function item(body: AgentJournalRenderItem['body'], sequence = 1): AgentJournalRenderItem {
  return { itemId: String(sequence), sequence, revision: 1, observedAt: 100, body }
}

describe('selected chat summary evidence', () => {
  it('includes successful created files across providers and excludes unfinished and failed writes', () => {
    expect(
      nativeChatSessionResults([
        item({
          kind: 'tool-call',
          name: 'Write',
          input: { file_path: 'created.md', content: 'hello' },
          state: 'completed'
        }),
        item(
          {
            kind: 'tool-call',
            name: 'Write',
            input: { file_path: 'pending.md', content: 'hello' },
            state: 'running'
          },
          2
        ),
        item(
          {
            kind: 'tool-call',
            name: 'Write',
            input: { file_path: 'failed.md', content: 'hello' },
            state: 'failed'
          },
          3
        )
      ])
    ).toEqual(['created.md'])
  })

  it('lists explicit file changes once and ignores files mentioned in prose', () => {
    const patch = { head: '+hello', byteLength: 6, digest: 'digest', truncated: false }
    expect(
      nativeChatSessionResults([
        item({ kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'maybe.txt' }] }),
        item({ kind: 'diff', path: 'actual.txt', patch }, 2),
        item({ kind: 'diff', path: 'actual.txt', patch }, 3)
      ])
    ).toEqual(['actual.txt'])
  })

  it('orders file changes by their most recent touch', () => {
    const patch = { head: '+x', byteLength: 2, digest: 'digest', truncated: false }
    expect(
      nativeChatSessionResults([
        item({ kind: 'diff', path: 'first.txt', patch }, 1),
        item({ kind: 'diff', path: 'second.txt', patch }, 2),
        item({ kind: 'diff', path: 'first.txt', patch }, 3)
      ])
    ).toEqual(['first.txt', 'second.txt'])
  })

  it('uses explicit MCP identity and retains the most recent failure without claiming connection', () => {
    const connectors = nativeChatSessionConnectors([
      item({ kind: 'tool-call', name: 'ordinary_tool', input: {}, state: 'completed' }),
      item({ kind: 'tool-call', name: 'mcp__docs__search', input: {}, state: 'completed' }, 2),
      item(
        {
          kind: 'tool-call',
          name: 'provider_alias',
          input: {},
          state: 'failed',
          mcpIdentity: { server: 'docs', tool: 'fetch' },
          output: { head: 'Access refused', byteLength: 14, digest: 'digest', truncated: false }
        },
        3
      )
    ])
    expect(connectors).toEqual([
      { server: 'Docs', tool: 'fetch', state: 'failed', error: 'Access refused' }
    ])
  })

  it('isolates host and workspace ports and distinguishes absent scans from empty scans', () => {
    const local: WorkspacePortScanResult = {
      platform: 'win32',
      scannedAt: 100,
      ports: [
        {
          id: 'local',
          kind: 'workspace',
          bindHost: '127.0.0.1',
          connectHost: 'localhost',
          port: 3000,
          protocol: 'http',
          owner: {
            worktreeId: 'selected',
            repoId: 'repo',
            displayName: 'Selected',
            path: 'C:/selected',
            confidence: 'cwd'
          }
        }
      ]
    }
    const remote: WorkspacePortScanResult = { ...local, platform: 'linux', ports: [] }
    const scans = { 'local:all': local, 'environment:remote:all': remote }
    expect(nativeChatSessionServers(scans, { kind: 'local' }, 'selected').ports).toHaveLength(1)
    expect(nativeChatSessionServers(scans, { kind: 'local' }, 'other').ports).toEqual([])
    expect(
      nativeChatSessionServers(scans, { kind: 'environment', environmentId: 'remote' }, 'selected')
    ).toEqual({ scan: remote, ports: [] })
    expect(
      nativeChatSessionServers(scans, { kind: 'environment', environmentId: 'missing' }, 'selected')
    ).toEqual({ scan: undefined, ports: [] })
  })
})

describe('selected chat summary plan', () => {
  it('reports a Gentle Shell todo list from the snapshot its result carried', () => {
    const gentleTodo = (tasks: unknown[]) => ({ action: 'write', gentleTodo: { tasks } })
    expect(
      nativeChatSessionPlan([
        item({
          kind: 'tool-call',
          name: 'todo',
          input: gentleTodo([
            { title: 'Parse', status: 'done' },
            { title: 'Test', status: 'in_progress', note: 'writing RED' },
            { title: 'Ship', status: 'pending' }
          ]),
          state: 'completed'
        }),
        // A running call only holds the action, and a later list read changes nothing.
        item(
          { kind: 'tool-call', name: 'todo', input: { action: 'update', id: 2 }, state: 'running' },
          2
        )
      ])
    ).toEqual({
      tasks: [
        { content: 'Parse', status: 'completed' },
        { content: 'Test', status: 'in_progress', activeForm: 'writing RED' },
        { content: 'Ship', status: 'pending' }
      ]
    })
  })

  it('reports the latest TodoWrite plan and ignores a failed call', () => {
    expect(
      nativeChatSessionPlan([
        item({
          kind: 'tool-call',
          name: 'TodoWrite',
          input: { todos: [{ content: 'Read', status: 'pending' }] },
          state: 'completed'
        }),
        item(
          {
            kind: 'tool-call',
            name: 'TodoWrite',
            input: {
              todos: [
                { content: 'Write', status: 'in_progress', activeForm: 'Writing' },
                { content: 'Test', status: 'completed' }
              ]
            },
            state: 'completed'
          },
          2
        ),
        item({ kind: 'tool-call', name: 'TodoWrite', input: { todos: [] }, state: 'failed' }, 3)
      ])
    ).toEqual({
      tasks: [
        { content: 'Write', status: 'in_progress', activeForm: 'Writing' },
        { content: 'Test', status: 'completed' }
      ]
    })
  })

  it('reads Codex plan notifications and lets neither subagent rows nor truncated frames replace the plan', () => {
    const plan = JSON.stringify({ plan: [{ step: 'Ship', status: 'inProgress' }] })
    const frame = (head: string, truncated = false): AgentJournalRenderItem['body'] => ({
      kind: 'status',
      text: 'plan',
      providerFrame: {
        provider: 'codex',
        kind: 'notification:turn/plan/updated',
        payload: { head, byteLength: head.length, digest: 'digest', truncated }
      }
    })
    expect(nativeChatSessionPlan([item(frame(plan), 1)])).toEqual({
      tasks: [{ content: 'Ship', status: 'in_progress' }]
    })
    const subagentTodo = {
      ...item(
        {
          kind: 'tool-call',
          name: 'TodoWrite',
          input: { todos: [{ content: 'Child task', status: 'pending' }] },
          state: 'completed'
        },
        2
      ),
      agentId: 'child-agent'
    }
    expect(nativeChatSessionPlan([item(frame(plan), 1), subagentTodo])).toEqual({
      tasks: [{ content: 'Ship', status: 'in_progress' }]
    })
    expect(nativeChatSessionPlan([item(frame(plan, true), 1)])).toBeNull()
  })

  it('reports no plan when the chat carries no plan data', () => {
    expect(
      nativeChatSessionPlan([
        item({ kind: 'tool-call', name: 'Read', input: {}, state: 'completed' })
      ])
    ).toBeNull()
  })
})

describe('selected chat workspace labels', () => {
  it('names a folder from either separator and strips the branch ref prefix', () => {
    expect(workspaceFolderName('C:\\repo\\feature-wt\\')).toBe('feature-wt')
    expect(workspaceFolderName('/home/me/wt-ssh')).toBe('wt-ssh')
    expect(workspaceFolderName('')).toBeNull()
    expect(workspaceBranchName('refs/heads/feature/x')).toBe('feature/x')
    expect(workspaceBranchName('  main ')).toBe('main')
    expect(workspaceBranchName('')).toBeNull()
    expect(workspaceBranchName(undefined)).toBeNull()
  })

  it('reads owner/repo from a cached identity key with or without a host', () => {
    expect(githubSlugFromIdentityKey('acme/app')).toBe('acme/app')
    expect(githubSlugFromIdentityKey('ghe.example.com/acme/app')).toBe('acme/app')
  })
})
