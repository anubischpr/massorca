// The real Claude CLI, launched through Orca's own launch resolution: asked for a child session, the
// agent must reach for `orca orchestration delegate`, not its built-in Task/Agent subagent tool.
// Opt-in, like every real-CLI suite: it spends one short turn on the signed-in account. The turn is
// stopped at the first tool call, so no subagent or delegation request is ever run to completion.
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import { agentSessionRecordFixture } from '../native-chat/agent-session-record-test-fixture'
import { claudeProviderHandle } from '../../shared/agent-session-provider-handle-encoding'
import { createClaudeStructuredLaunchResolver } from './claude-structured-launch-resolution'
import {
  realClaudeAuthenticated,
  realClaudeAvailable,
  realClaudeCliGate,
  realClaudeCommand,
  realClaudeLaunchHome
} from './claude-real-cli-availability-test-support'
import {
  ClaudeStructuredSessionAdapter,
  type ClaudeStructuredSessionEvent
} from './claude-structured-session-adapter'

const SESSION_ID = 'real-cli-delegation'
const suiteTitle = `Claude real CLI child-session delegation${realClaudeCliGate.skipReason ? ` (skipped: ${realClaudeCliGate.skipReason})` : ''}`

type ToolUse = { name: string; command: string }

function toolUses(frames: Record<string, unknown>[]): ToolUse[] {
  return frames.flatMap((frame) => {
    const content =
      frame.type === 'assistant' ? (frame.message as { content?: unknown })?.content : null
    if (!Array.isArray(content)) {
      return []
    }
    return content.flatMap((block: unknown) => {
      if (
        typeof block !== 'object' ||
        block === null ||
        !('type' in block) ||
        block.type !== 'tool_use'
      ) {
        return []
      }
      const name = 'name' in block && typeof block.name === 'string' ? block.name : ''
      const input = 'input' in block && typeof block.input === 'object' ? block.input : null
      const command =
        input && 'command' in input && typeof input.command === 'string' ? input.command : ''
      return [{ name, command }]
    })
  })
}

describe.skipIf(!realClaudeAvailable)(suiteTitle, () => {
  it.skipIf(!realClaudeAuthenticated)(
    'runs orca orchestration delegate for a child-session request instead of a Task subagent',
    async () => {
      const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude')
      const scratch = await mkdtemp(join(tmpdir(), 'orca-real-cli-delegation-'))
      const cwd = join(scratch, 'workspace')
      const record = agentSessionRecordFixture({
        sessionId: SESSION_ID,
        location: { workspaceId: 'real-cli-delegation-workspace' },
        accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: claudeConfigDir },
        launchDirectory: cwd
      })
      const resolveLaunch = createClaudeStructuredLaunchResolver({
        store: { getRecord: () => record, pinLaunchDirectory: vi.fn() },
        resolveWorkspacePath: async () => cwd,
        resolveCommand: () => realClaudeCommand,
        resolveLaunchArgs: () => [],
        resolveEnv: () => realClaudeLaunchHome().env,
        resolveAuthPolicy: () => ({ stripAuthEnv: false }),
        hasTranscript: async () => false
      })
      const identity: AgentSessionJournalIdentity = {
        sessionId: SESSION_ID,
        workspaceId: 'real-cli-delegation-workspace',
        hostId: 'local',
        agent: 'claude',
        providerHandle: null
      }
      const events: ClaudeStructuredSessionEvent[] = []
      const adapter = new ClaudeStructuredSessionAdapter({
        resolveLaunch,
        onEvent: (event) => events.push(event),
        readProcessStartTime: async () => 1,
        now: () => 2
      })
      const frames = (): Record<string, unknown>[] =>
        events.flatMap((event) => (event.type === 'message' ? [event.message] : []))
      const subagentTools = ['Task', 'Agent']
      try {
        await mkdir(cwd, { recursive: true })
        const launch = await resolveLaunch({ identity })
        expect(launch.options.systemPrompt).toMatchObject({ append: expect.any(String) })
        await adapter.acquire({
          identity: {
            ...identity,
            providerHandle: claudeProviderHandle(launch.providerSessionId, null)
          },
          fence: 1,
          spawnToken: 'real-cli-delegation'
        })
        await adapter.dispatch({
          sessionId: SESSION_ID,
          clientMessageId: 'real-cli-delegation-1',
          body: {
            kind: 'message',
            role: 'user',
            blocks: [
              { type: 'text', text: 'create a child session to explore Phase 3 improvements' }
            ]
          },
          fence: 1
        })
        const decided = (): boolean =>
          toolUses(frames()).some(
            (use) =>
              subagentTools.includes(use.name) ||
              use.command.includes('orca orchestration delegate')
          )
        await vi.waitFor(
          () => expect(decided(), JSON.stringify(frames().slice(-6)).slice(0, 3000)).toBe(true),
          { timeout: 120_000, interval: 200 }
        )
        const uses = toolUses(frames())
        expect(uses.filter((use) => subagentTools.includes(use.name))).toEqual([])
        expect(
          uses.some(
            (use) => use.name === 'Bash' && use.command.includes('orca orchestration delegate')
          )
        ).toBe(true)
      } finally {
        await adapter.closeAll()
        await rm(scratch, { recursive: true, force: true })
      }
    },
    150_000
  )
})
