// The host side of a delegated child's first prompt: its chat record, the Pi runtime its workspace runs, and the
// request folder made for it. Every read and write is on this runtime.
import { rm } from 'node:fs/promises'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { launchDirectoryOfChat } from '../native-chat/chat-launch-directory'
import { createPrototypeRequest } from '../native-chat/prototype-requests'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { DelegatedChildFirstPromptDeps } from './delegated-child-first-prompt'

/** The chat and request access a child's first prompt needs, all on this runtime. */
export function delegatedChildPromptDeps(
  runtime: OrcaRuntimeService
): DelegatedChildFirstPromptDeps {
  return {
    readChat: async (sessionId) => {
      const host = getStructuredAgentSessionHost()
      const record = host?.deps.store.getRecord(sessionId)
      if (!host || !record) {
        return null
      }
      // Why: only a Pi chat has a Pi runtime to read; any other agent is named by its own id.
      const piRuntime =
        record.provider === 'pi'
          ? await piRuntimeOfWorkspace(runtime, record.location.workspaceId)
          : undefined
      return {
        agent: record.provider,
        launchDirectory: await launchDirectoryOfChat(record, host.deps.resolveWorkspacePath),
        workspaceId: record.location.workspaceId,
        ...(piRuntime ? { piRuntime } : {})
      }
    },
    readPrototypeCount: () => runtime.readPrototypeCountSetting(),
    createRequest: (input) =>
      createPrototypeRequest({
        stateDirectory: getProfileUserDataPath(),
        sessionId: input.sessionId,
        launchDirectory: input.launchDirectory,
        request: {
          agent: input.agent,
          originalPrompt: input.text,
          count: input.count,
          worktreeId: input.worktreeId,
          designSystem: 'use'
        },
        originSessionId: input.originSessionId,
        now: new Date(),
        random: Math.random
      }),
    removeFolder: (folderPath) => rm(folderPath, { recursive: true, force: true })
  }
}

/** The Pi runtime the workspace runs for the agent `pi`; undefined when the workspace cannot run it. */
async function piRuntimeOfWorkspace(
  runtime: OrcaRuntimeService,
  workspaceId: string
): Promise<PiRuntimeSelection | undefined> {
  const support = await runtime.getStructuredAgentSessionCreateSupport(`id:${workspaceId}`, 'pi')
  return support.supported ? support.piRuntime : undefined
}
