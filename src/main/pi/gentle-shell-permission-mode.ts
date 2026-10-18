import { z } from 'zod'
import { isAgentSessionPermissionPreset } from '../../shared/agent-session-access-mode'
import { AgentSessionOptionRejectedError } from '../native-chat/agent-session-wire/structured-agent-session-option-error'
import type { PiRpcRequester } from './rpc-options'

/** Gentle Shell's session permission modes; stock Pi has none. */
export type GentleShellMode = 'normal' | 'auto' | 'yolo'

/** The Gentle Shell mode a session's access value names. `inherit` follows the global setting. */
export function gentleShellModeForAccess(
  accessMode: string | undefined,
  inheritedFullAccess: boolean
): GentleShellMode {
  switch (accessMode) {
    case undefined:
    case 'inherit':
      return inheritedFullAccess ? 'yolo' : 'normal'
    case 'default':
      return 'normal'
    case 'auto':
      return 'auto'
    case 'full-access':
      return 'yolo'
    default:
      throw new Error(
        isAgentSessionPermissionPreset(accessMode)
          ? `Gentle Shell has no ${accessMode} mode`
          : 'agent session access mode is invalid'
      )
  }
}

// `optional`: a failure of this command leaves the mode change itself standing.
type ModeCommand = { text: string; optional?: true }

/** Extension commands, in order. Leaving YOLO is explicit so a mode kept from an earlier run
 *  cannot outlive an Ask for approval or Auto pick. */
const GENTLE_SHELL_MODE_COMMANDS: Record<GentleShellMode, readonly ModeCommand[]> = {
  normal: [{ text: '/gentle:yolo disable', optional: true }, { text: '/gentle:mode normal' }],
  auto: [{ text: '/gentle:yolo disable', optional: true }, { text: '/gentle:mode auto' }],
  yolo: [{ text: '/gentle:yolo enable' }]
}

const REQUEST_TIMEOUT_MS = 10_000
const promptReplySchema = z.object({
  disposition: z.string().optional(),
  agentInvoked: z.boolean().optional()
})

function commandName(text: string): string {
  return text.slice(1).split(' ')[0]
}

export class GentleShellModeError extends Error {}

/**
 * Applies `mode` by running Gentle Shell's own slash commands through the RPC `prompt` command,
 * which runs an extension command without a model call. Every command must be listed by the
 * child first: a name Pi does not know would be sent to the model as ordinary text.
 */
export async function applyGentleShellMode(
  rpc: PiRpcRequester,
  commands: readonly { name: string }[] | undefined,
  mode: GentleShellMode
): Promise<void> {
  const known = new Set((commands ?? []).map((command) => command.name.replace(/^\//, '')))
  const sequence = GENTLE_SHELL_MODE_COMMANDS[mode].filter(
    (command) => !command.optional || known.has(commandName(command.text))
  )
  for (const { text } of sequence) {
    if (!known.has(commandName(text))) {
      throw new GentleShellModeError(`Gentle Shell does not offer ${commandName(text)}`)
    }
  }
  for (const { text, optional } of sequence) {
    try {
      const reply = promptReplySchema.safeParse(
        await rpc.request('prompt', { message: text }, { timeoutMs: REQUEST_TIMEOUT_MS })
      )
      if (
        !reply.success ||
        (reply.data.disposition !== 'handled' && reply.data.agentInvoked !== false)
      ) {
        throw new GentleShellModeError(`Gentle Shell did not run ${text}`)
      }
    } catch (error) {
      if (!optional) {
        throw error
      }
    }
  }
}

type GentleShellModeHost = {
  /** The child is Gentle Shell, the only Pi runtime with permission modes. */
  enabled: boolean
  rpc: PiRpcRequester
  commands: () => readonly { name: string }[] | undefined
  /** A prompt is in flight, so a command would have to steer it. */
  busy: () => boolean
  warn: (message: string, fields: Record<string, unknown>) => void
  notice: (text: string) => void
}

/** One child's Gentle Shell mode: set once after start, switched live while idle. */
export class GentleShellModeControl {
  constructor(private readonly host: GentleShellModeHost) {}

  get enabled(): boolean {
    return this.host.enabled
  }

  /** A mode that cannot be applied is announced and reported false, never assumed. */
  async applyAtStart(mode: GentleShellMode): Promise<boolean> {
    try {
      await applyGentleShellMode(this.host.rpc, this.host.commands(), mode)
      return true
    } catch (error) {
      this.host.warn('Gentle Shell mode could not be applied', { mode, error })
      this.host.notice(
        'Gentle Shell kept its previous permission mode: the selected mode could not be applied.'
      )
      return false
    }
  }

  async switchTo(value: string): Promise<void> {
    if (!this.host.enabled) {
      throw new AgentSessionOptionRejectedError('Pi has no permission modes to switch between.')
    }
    if (this.host.busy()) {
      throw new AgentSessionOptionRejectedError(
        'Gentle Shell can change its permission mode once the current turn ends.'
      )
    }
    try {
      await applyGentleShellMode(
        this.host.rpc,
        this.host.commands(),
        gentleShellModeForAccess(value, false)
      )
    } catch (error) {
      throw new AgentSessionOptionRejectedError(error)
    }
  }
}
