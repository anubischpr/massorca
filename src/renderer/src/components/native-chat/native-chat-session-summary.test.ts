import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'
import {
  githubSlugFromIdentityKey,
  nativeChatSessionConnectors,
  nativeChatSessionPlan,
  nativeChatSessionPlanDocument,
  nativeChatSessionResultFiles,
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

  describe('result paths relative to the workspace root', () => {
    const patch = { head: '+x', byteLength: 2, digest: 'digest', truncated: false }
    const diffs = (...paths: string[]) =>
      paths.map((path, index) => item({ kind: 'diff', path, patch }, index + 1))

    it('shows a file under a remote POSIX root relatively, one row for relative and absolute reports', () => {
      expect(
        nativeChatSessionResultFiles(
          diffs(
            '/home/u/ws/resultados/agy-demo.md',
            'resultados/agy-demo.md',
            'resultados/./agy-demo.md'
          ),
          '/home/u/ws'
        )
      ).toEqual([
        {
          absolutePath: '/home/u/ws/resultados/agy-demo.md',
          displayPath: 'resultados/agy-demo.md'
        }
      ])
    })

    it('keeps a file outside the root absolute and opens the absolute path', () => {
      expect(
        nativeChatSessionResultFiles(diffs('/etc/hosts', '../other/a.md'), '/home/u/ws')
      ).toEqual([
        { absolutePath: '/home/u/other/a.md', displayPath: '/home/u/other/a.md' },
        { absolutePath: '/etc/hosts', displayPath: '/etc/hosts' }
      ])
    })

    it('reads Windows roots with either separator, ignoring drive-letter case', () => {
      expect(
        nativeChatSessionResultFiles(diffs(String.raw`c:\Repo\src\a.ts`, 'src/a.ts'), 'C:/Repo')
      ).toEqual([{ absolutePath: 'C:/Repo/src/a.ts', displayPath: 'src/a.ts' }])
    })

    it('leaves paths as reported when the chat has no workspace root', () => {
      expect(nativeChatSessionResultFiles(diffs('resultados/a.md'), null)).toEqual([
        { absolutePath: 'resultados/a.md', displayPath: 'resultados/a.md' }
      ])
    })
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

describe('selected chat plan document', () => {
  const written = (path: string, artifact: unknown, sequence: number, extra = {}) =>
    item(
      {
        kind: 'tool-call',
        name: 'write_file',
        input: { Path: path, ...(artifact ? { antigravityArtifact: artifact } : {}) },
        state: 'completed',
        ...extra
      },
      sequence
    )

  it('shows the newest user-facing artifact relative to the workspace, awaiting approval', () => {
    const document = nativeChatSessionPlanDocument(
      [
        written('/ws/old.md', { userFacing: true, summary: 'Old' }, 1),
        written('/ws/notes.md', undefined, 2),
        written('/ws/docs/plan.md', { userFacing: true, requestFeedback: true, summary: 'New' }, 3),
        written('/ws/failed.md', { userFacing: true }, 4, { state: 'failed' })
      ],
      '/ws'
    )
    expect(document).toEqual({
      file: { absolutePath: '/ws/docs/plan.md', displayPath: 'docs/plan.md' },
      summary: 'New',
      awaitingApproval: true,
      revisionKey: '3:1'
    })
  })

  it('shows only the file name for a document outside the workspace, full path as tooltip', () => {
    const document = nativeChatSessionPlanDocument(
      [
        written(
          '/home/u/.gemini/antigravity-cli/brain/c1/implementation_plan.md',
          { userFacing: true, requestFeedback: true },
          1
        )
      ],
      '/ws'
    )
    expect(document?.file).toEqual({
      absolutePath: '/home/u/.gemini/antigravity-cli/brain/c1/implementation_plan.md',
      displayPath: 'implementation_plan.md'
    })
  })

  it('changes its revision key when the document is rewritten', () => {
    const artifact = { userFacing: true }
    const first = nativeChatSessionPlanDocument([written('/ws/p.md', artifact, 1)], '/ws')
    const second = nativeChatSessionPlanDocument(
      [written('/ws/p.md', artifact, 1), written('/ws/p.md', artifact, 2)],
      '/ws'
    )
    expect(second?.revisionKey).not.toBe(first?.revisionKey)
  })

  it('is absent without a flagged artifact', () => {
    expect(nativeChatSessionPlanDocument([written('/ws/a.md', undefined, 1)], '/ws')).toBeNull()
  })
})

describe('selected chat summary plan', () => {
  it('builds a Claude TaskCreate/TaskUpdate list and ignores subagent and failed calls', () => {
    const call = (name: string, input: unknown, sequence: number, extra = {}) =>
      item(
        { kind: 'tool-call', name, input, state: 'completed', callId: `c${sequence}`, ...extra },
        sequence
      )
    const made = (subject: string, id: string, sequence: number) =>
      call('TaskCreate', { subject, description: 'd' }, sequence, {
        output: { head: `Task #${id} created successfully: ${subject}`, truncated: false }
      })
    expect(
      nativeChatSessionPlan([
        made('Split picker', '1', 1),
        made('Add tests', '2', 2),
        call('TaskUpdate', { taskId: '1', status: 'completed' }, 3),
        call('TaskUpdate', { taskId: '2', status: 'in_progress' }, 4, { state: 'failed' }),
        { ...call('TaskCreate', { subject: 'Child' }, 5), agentId: 'sub' },
        call('TaskList', {}, 6)
      ])
    ).toEqual({
      tasks: [
        { content: 'Split picker', status: 'completed' },
        { content: 'Add tests', status: 'pending' }
      ]
    })
  })

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
