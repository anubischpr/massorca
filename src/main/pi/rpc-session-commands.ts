import { classifyAgentSessionFunctions } from '../../shared/agent-session-provider-functions'
import type { AgentSessionSlashCommand } from '../../shared/agent-session-wire'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import type { PiRpcCommandCatalog } from './rpc-command-catalog'
import { readPiRpcCommands, type PiRpcRequester } from './rpc-options'

/** The `/` commands one running Pi child reports for itself, remembered per runtime for chats at rest. */
export class PiRpcSessionCommands {
  list?: AgentSessionSlashCommand[]

  constructor(
    private readonly deps: {
      rpc: PiRpcRequester
      sessionOptions: Readonly<Record<string, string>> | undefined
      catalog?: Pick<PiRpcCommandCatalog, 'recordFor'>
      logger: StructuredAgentSessionLogger
      sessionId: string
    }
  ) {}

  /** Verified by the child itself, so these run as ordinary prompts. */
  get functions() {
    return classifyAgentSessionFunctions({ commands: this.list, source: 'provider-session' })
  }

  /** A failed read leaves the last answer in place; the caller tries again when the child is idle. */
  async read(): Promise<void> {
    try {
      const { commands } = await readPiRpcCommands(this.deps.rpc)
      this.list = commands
      if (commands) {
        this.deps.catalog?.recordFor(this.deps.sessionOptions, commands)
      }
    } catch (error) {
      this.deps.logger.warn('Pi commands could not be read', {
        scope: 'pi-commands',
        sessionId: this.deps.sessionId,
        error
      })
    }
  }
}
