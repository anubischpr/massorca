import type { AgentSessionProviderCommand } from '../../shared/agent-session-provider-command'
import { CODEX_USAGE_NOTICE_PRESENTATION } from '../../shared/agent-session-provider-command'
import type { AgentSessionProviderCommandOutcome } from '../native-chat/agent-session-wire/structured-agent-session-provider-command-adapter'
import { isCodexAppServerRequestError } from './codex-app-server-request-error'
import {
  codexGuardianAssessmentEvent,
  codexGuardianDenialOf,
  type CodexGuardianDenial
} from './codex-guardian-denial'
import { readRecord, readString } from './codex-item-field-readers'
import { codexPluginsListing, codexSkillsListing } from './codex-provider-command-listings'
import type { CodexSession } from './codex-structured-session-state'

type CodexCommandSession = Pick<CodexSession, 'connection' | 'threadId'>

/** What Codex answers in a chat, in menu order. */
export const CODEX_PROVIDER_COMMANDS = [
  'usage',
  'skills',
  'plugins',
  'memories',
  'rename',
  'fork',
  'review',
  'approve',
  'stop'
] as const satisfies readonly AgentSessionProviderCommand[]

// Not on the session's state: a denial matters to `/approve` alone.
const denials = new WeakMap<object, CodexGuardianDenial>()

/** Keeps the denial an auto-review reports until a new turn begins or `/approve` overrules it. */
export function observe(session: CodexCommandSession, method: string, params: unknown): void {
  const denial = codexGuardianDenialOf(method, params)
  if (denial?.threadId === session.threadId) {
    denials.set(session, denial)
  } else if (method === 'turn/started') {
    denials.delete(session)
  }
}

/** `/approve` is offered only while a denied action waits for it. */
export function available(
  session: CodexCommandSession | undefined
): readonly AgentSessionProviderCommand[] {
  return CODEX_PROVIDER_COMMANDS.filter(
    (command) => command !== 'approve' || (session !== undefined && denials.has(session))
  )
}

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
): Extract<AgentSessionProviderCommandOutcome, { ok: true }> {
  return { ok: true, notice: { text, tone: 'notice', ...options } }
}

function unsupported(command: AgentSessionProviderCommand): AgentSessionProviderCommandOutcome {
  return notice(`/${command} is not supported by this version of Codex.`, { tone: 'warning' })
}

const FORK_RELEASE_POLLS = 20
const FORK_RELEASE_POLL_MS = 150

/** `thread/fork` leaves the new thread loaded, and writable, in this chat's app-server. The chat
 *  that adopts it starts an app-server of its own, whose `thread/resume` is refused ("already has an
 *  active writer") until this one has let go. */
async function releaseForkedThread(
  request: (method: string, params: Record<string, unknown>) => Promise<unknown>,
  threadId: string
): Promise<void> {
  try {
    await request('thread/unsubscribe', { threadId })
    for (let poll = 0; poll < FORK_RELEASE_POLLS; poll += 1) {
      const loaded = readRecord(await request('thread/loaded/list', {})).data
      if (!Array.isArray(loaded) || !loaded.includes(threadId)) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, FORK_RELEASE_POLL_MS))
    }
  } catch {
    // The fork exists either way; an adopter that still finds it held reports that itself.
  }
}

/** Runs one provider command on a live Codex thread. */
export async function run(
  session: CodexCommandSession,
  input: { command: AgentSessionProviderCommand; argument?: string },
  timeoutMs: number | undefined
): Promise<AgentSessionProviderCommandOutcome> {
  const { command, argument } = input
  const { threadId } = session
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
        if (argument === undefined) {
          return notice(
            'Use /memories on or /memories off to choose whether this chat uses memories. Codex does not report the current setting.'
          )
        }
        await request('thread/memoryMode/set', {
          threadId,
          mode: argument === 'on' ? 'enabled' : 'disabled'
        })
        return notice(`Memories are ${argument} for this chat.`)
      case 'rename':
        if (argument === undefined) {
          return { ok: false, rejected: 'Give a name after /rename.' }
        }
        await request('thread/name/set', { threadId, name: argument })
        return { ...notice(`Renamed this chat to "${argument}".`), conversationName: argument }
      case 'fork': {
        const response = await request('thread/fork', { threadId })
        const forked = readString(readRecord(readRecord(response).thread), 'id')
        if (forked === null) {
          return { ok: false, rejected: 'Codex did not name the forked conversation.' }
        }
        await releaseForkedThread(request, forked)
        // No row: the fork opens as its own chat, and a row here would move the chat the user is reading.
        return { ok: true, forkedProviderSessionId: forked }
      }
      case 'review':
        // Inline: the review runs as a turn of this thread, so its items stream into this chat.
        await request('review/start', {
          threadId,
          delivery: 'inline',
          target:
            argument === undefined
              ? { type: 'uncommittedChanges' }
              : { type: 'custom', instructions: argument }
        })
        return { ok: true }
      case 'approve': {
        const denial = denials.get(session)
        if (!denial) {
          return notice('No denied action is waiting for approval.')
        }
        await request('thread/approveGuardianDeniedAction', {
          threadId,
          event: codexGuardianAssessmentEvent(denial)
        })
        denials.delete(session)
        return notice('Approved the denied action. Codex can retry it.')
      }
      case 'stop':
        await request('thread/backgroundTerminals/clean', { threadId })
        return notice('Stopped the background terminals.')
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
