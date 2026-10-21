import type { AgentSessionProviderCommand } from '../../shared/agent-session-provider-command'
import { CODEX_USAGE_NOTICE_PRESENTATION } from '../../shared/agent-session-provider-command'
import type { AgentSessionProviderCommandOutcome } from '../native-chat/agent-session-wire/structured-agent-session-provider-command-adapter'
import { isCodexAppServerRequestError } from './codex-app-server-request-error'
import { codexPluginsListing, codexSkillsListing } from './codex-provider-command-listings'
import type { CodexSession } from './codex-structured-session-state'

type CodexCommandSession = Pick<CodexSession, 'connection' | 'threadId'>

/** Codex answers a method its version lacks as method-not-found, or as an experimental API it was
 *  not asked to enable. */
function lacksMethod(error: unknown): boolean {
  return (
    isCodexAppServerRequestError(error) &&
    (error.code === -32601 || /method not found|experimental|unknown variant/i.test(error.message))
  )
}

function notice(
  text: string,
  options: { presentation?: string; tone?: 'notice' | 'warning' } = {}
): AgentSessionProviderCommandOutcome {
  return { ok: true, notice: { text, ...options } }
}

function unsupported(command: AgentSessionProviderCommand): AgentSessionProviderCommandOutcome {
  return notice(`/${command} is not supported by this version of Codex.`, { tone: 'warning' })
}

/** Runs one provider command on a live Codex thread. */
export async function runCodexProviderCommand(
  session: CodexCommandSession,
  input: { command: AgentSessionProviderCommand; argument?: string },
  timeoutMs: number | undefined
): Promise<AgentSessionProviderCommandOutcome> {
  const { command } = input
  const request = (method: string, params: Record<string, unknown>): Promise<unknown> =>
    session.connection.request(method, params, { timeoutMs })
  try {
    switch (command) {
      case 'usage':
        return notice('Codex usage windows are shown in the usage meters.', {
          presentation: CODEX_USAGE_NOTICE_PRESENTATION
        })
      case 'skills':
        return notice(codexSkillsListing(await request('skills/list', {})), {
          presentation: 'command-output'
        })
      case 'plugins':
        return notice(codexPluginsListing(await request('plugin/list', {})), {
          presentation: 'command-output'
        })
      case 'memories':
        return notice(
          'Use /memories on or /memories off to choose whether this chat uses memories. Codex does not report the current setting.'
        )
      case 'rename':
      case 'fork':
      case 'review':
      case 'approve':
      case 'stop':
      case 'name':
      case 'export':
        return { ok: false, rejected: `/${command} is not available for Codex chats.` }
    }
  } catch (error) {
    if (lacksMethod(error)) {
      return unsupported(command)
    }
    if (isCodexAppServerRequestError(error)) {
      return { ok: false, rejected: error.message }
    }
    throw error
  }
}
