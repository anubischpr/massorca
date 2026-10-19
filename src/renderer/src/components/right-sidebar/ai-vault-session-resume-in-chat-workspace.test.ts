import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STRUCTURED_AGENT_SESSION_RESUME_HISTORY_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'

const mocks = vi.hoisted(() => ({
  owner: vi.fn<() => string | null>(() => 'local'),
  localCapabilities: vi.fn<() => readonly string[] | null>(() => []),
  route: vi.fn<() => 'structured-native-chat' | 'terminal-tui'>(() => 'structured-native-chat'),
  state: { runtimeStatusByEnvironmentId: new Map<string, unknown>() }
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/runtime/structured-agent-session-owner', () => ({
  resolveStructuredAgentSessionOwner: mocks.owner
}))
vi.mock('@/runtime/local-runtime-capabilities', () => ({
  readLocalRuntimeCapabilitiesOrUnknown: mocks.localCapabilities
}))
// The route's own feasibility is pinned elsewhere; this suite pins the host rule on top of it.
vi.mock('@/lib/agent-session-launch-plan', () => ({
  structuredAgentSessionLaunchFeasible: () => true,
  resolveAgentSessionLaunchRoute: mocks.route
}))

import {
  resolveAiVaultPrimaryResumeSurface,
  resolveAiVaultSessionResumeInChatForWorkspace
} from './ai-vault-session-resume-in-chat-workspace'

const PAIRED_WORKSPACE = 'repo-1::/srv/orca'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields eligibility reads are staged.
const codexSession = {
  id: 'codex-1',
  agent: 'codex',
  executionHostId: 'local',
  cwd: '/Users/me/orca',
  filePath: '/Users/me/.codex/sessions/rollout-1.jsonl',
  messageCount: 4,
  previewMessages: []
} as unknown as AiVaultSession

function resumeInChat() {
  return resolveAiVaultSessionResumeInChatForWorkspace({
    session: codexSession,
    resumeState: { blocked: true, worktreeId: null, usesSessionWorktree: false },
    activeWorkspaceId: PAIRED_WORKSPACE,
    targetState: { folderWorkspaces: [], projectGroups: [], repos: [], worktreesByRepo: {} },
    settings: {
      experimentalNativeChat: true
    }
  })
}

beforeEach(() => {
  mocks.route.mockReturnValue('structured-native-chat')
  mocks.localCapabilities.mockReturnValue([
    STRUCTURED_AGENT_SESSION_RESUME_HISTORY_RUNTIME_CAPABILITY
  ])
  mocks.state.runtimeStatusByEnvironmentId = new Map([
    [
      'server-1',
      { status: { capabilities: [STRUCTURED_AGENT_SESSION_RESUME_HISTORY_RUNTIME_CAPABILITY] } }
    ]
  ])
})

describe('resuming a conversation from history in a chat', () => {
  // The conversation's transcript is on this machine, which the server cannot read; the
  // terminal resume refuses that target for the same reason.
  it("is not offered in a paired server's workspace for a conversation recorded here", () => {
    mocks.owner.mockReturnValue('runtime:server-1')

    expect(resumeInChat()).toEqual({ available: false, reason: 'workspace' })
  })

  it('is offered in a workspace on the machine that recorded it', () => {
    mocks.owner.mockReturnValue('local')

    expect(resumeInChat()).toEqual({ available: true, workspaceId: PAIRED_WORKSPACE })
  })

  it('asks the host that would run it whether it can resume, not another', () => {
    mocks.owner.mockReturnValue('local')
    mocks.localCapabilities.mockReturnValue([])

    expect(resumeInChat()).toEqual({ available: false, reason: 'workspace' })
  })
})

function rowFor(agent: string, cwd = '/Users/me/orca'): AiVaultSession {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields eligibility reads are staged.
  return {
    id: `${agent}-1`,
    agent,
    executionHostId: 'local',
    cwd,
    filePath: `/Users/me/.${agent}/sessions/session-1.jsonl`,
    messageCount: 4,
    previewMessages: []
  } as unknown as AiVaultSession
}

function primarySurface(session: AiVaultSession) {
  return resolveAiVaultPrimaryResumeSurface({
    session,
    targetWorkspaceId: PAIRED_WORKSPACE,
    targetState: {
      folderWorkspaces: [],
      projectGroups: [],
      repos: [],
      worktreesByRepo: {}
    },
    settings: { experimentalNativeChat: true }
  })
}

// The primary Resume continues the conversation in a chat exactly when a new launch of that agent
// would open a chat, and the host can adopt the conversation; otherwise it opens the terminal.
describe('the surface a history row primary Resume opens', () => {
  it('opens a Codex chat in the target workspace when the host adopts and Chat is on', () => {
    mocks.owner.mockReturnValue('local')
    expect(primarySurface(rowFor('codex'))).toEqual({
      surface: 'chat',
      workspaceId: PAIRED_WORKSPACE
    })
  })

  // Claude looks its transcript up under the launch directory, so it resumes only from the
  // workspace it was recorded in; any other target keeps the terminal.
  it('keeps the terminal for a Claude row recorded in another directory', () => {
    mocks.owner.mockReturnValue('local')
    expect(primarySurface(rowFor('claude'))).toEqual({ surface: 'terminal' })
  })

  it.each(['claude', 'codex', 'antigravity', 'pi'])(
    'opens the terminal for %s when the Chat UI switch routes launches there',
    (agent) => {
      mocks.owner.mockReturnValue('local')
      mocks.route.mockReturnValue('terminal-tui')
      expect(primarySurface(rowFor(agent))).toEqual({ surface: 'terminal' })
    }
  )

  it('opens the terminal when the host does not advertise resume-history support', () => {
    mocks.owner.mockReturnValue('local')
    mocks.localCapabilities.mockReturnValue([])
    expect(primarySurface(rowFor('codex'))).toEqual({ surface: 'terminal' })
  })

  // The host adopts a conversation only for Claude and Codex: Antigravity and Pi have no wire
  // handle, no adopted-link arm and no transcript importer, so the host would refuse the create.
  it.each(['antigravity', 'pi'])(
    'keeps the terminal for %s, which the host cannot adopt',
    (agent) => {
      mocks.owner.mockReturnValue('local')
      expect(primarySurface(rowFor(agent))).toEqual({ surface: 'terminal' })
    }
  )
})
