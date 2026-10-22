import { classifyAgentSessionFunctions } from '../../shared/agent-session-provider-functions'
import type { AgentSessionSlashCommand } from '../../shared/agent-session-wire'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type { PiRpcCommandCatalog } from './rpc-command-catalog'
import { readPiRpcCommands, type PiRpcRequester } from './rpc-options'

/** The `/` commands one running Pi child reports for itself, remembered per runtime for chats at rest. */
export class PiRpcSessionCommands {
  list?: AgentSessionSlashCommand[]
  private reading?: Promise<void>

  constructor(
    private readonly deps: {
      rpc: PiRpcRequester
      /** The runtime the child runs, which a saved record's options may not name. */
      runtime: PiRuntimeSelection
      catalog?: Pick<PiRpcCommandCatalog, 'record'>
      logger: StructuredAgentSessionLogger
      sessionId: string
    }
  ) {}

  /** Verified by the child itself, so these run as ordinary prompts. */
  get functions() {
    return classifyAgentSessionFunctions({ commands: this.list, source: 'provider-session' })
  }

  /** A failed read leaves the last answer in place; the caller tries again when the child is idle. */
  read(): Promise<void> {
    // One read at a time: a slow child must not collect a request per idle.
    this.reading ??= this.readOnce().finally(() => {
      this.reading = undefined
    })
    return this.reading
  }

  private async readOnce(): Promise<void> {
    try {
      const { commands } = await readPiRpcCommands(this.deps.rpc)
      this.list = commands
      if (commands) {
        this.deps.catalog?.record(this.deps.runtime, commands)
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
