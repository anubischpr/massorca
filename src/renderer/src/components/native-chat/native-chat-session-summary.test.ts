import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'
import {
  nativeChatSessionConnectors,
  nativeChatSessionResults,
  nativeChatSessionServers
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
