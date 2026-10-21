import type { AgentSessionProviderCommand } from '../../shared/agent-session-provider-command'
import type { AgentSessionProviderCommandOutcome } from '../native-chat/agent-session-wire/structured-agent-session-provider-command-adapter'
import { JsonlRpcResponseError } from '../jsonl-rpc/peer'
import type { PiRpcSession } from './rpc-session'

/** What Pi answers in a chat. Its `/fork` needs a message to fork from, which the chat has no picker for. */
export const PI_PROVIDER_COMMANDS = [
  'name',
  'export'
] as const satisfies readonly AgentSessionProviderCommand[]

function notice(
  text: string,
  tone: 'notice' | 'warning' = 'notice'
): Extract<AgentSessionProviderCommandOutcome, { ok: true }> {
  return { ok: true, notice: { text, tone } }
}

function exportedPath(data: unknown): string | null {
  const path = typeof data === 'object' && data !== null ? Reflect.get(data, 'path') : null
  return typeof path === 'string' && path.length > 0 ? path : null
}

/** Runs `/name` and `/export` on a live Pi session. */
export async function runPiProviderCommand(
  session: Pick<PiRpcSession, 'connection'>,
  input: { command: AgentSessionProviderCommand; argument?: string }
): Promise<AgentSessionProviderCommandOutcome> {
  const { command, argument } = input
  try {
    switch (command) {
      case 'name':
        if (argument === undefined) {
          return { ok: false, rejected: 'Give a name after /name.' }
        }
        await session.connection.request('set_session_name', { name: argument })
        return { ...notice(`Named this session "${argument}".`), conversationName: argument }
      case 'export': {
        const data = await session.connection.request(
          'export_html',
          argument === undefined ? {} : { outputPath: argument }
        )
        const path = exportedPath(data)
        return notice(
          path === null
            ? 'Exported the session on the host that runs Pi.'
            : `Exported the session to ${path} on the host that runs Pi.`
        )
      }
      case 'usage':
      case 'skills':
      case 'plugins':
      case 'memories':
      case 'rename':
      case 'fork':
      case 'review':
      case 'approve':
      case 'stop':
        return { ok: false, rejected: `/${command} is not available for Pi chats.` }
    }
  } catch (error) {
    if (!(error instanceof JsonlRpcResponseError)) {
      throw error
    }
    return /unknown command|unsupported command/i.test(error.message)
      ? notice(`/${command} is not supported by this version of Pi.`, 'warning')
      : { ok: false, rejected: error.message }
  }
}
