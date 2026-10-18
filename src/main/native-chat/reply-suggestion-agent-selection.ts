import {
  piRuntimeCommandSettings,
  type PiRuntimeSelection
} from '../../shared/pi-runtime-selection'
import type { TuiAgent } from '../../shared/tui-agent'

export type ReplySuggestionAgent = { agentId: TuiAgent; model: string }

/** Claude's fast alias: a next-message guess needs no more, and it tracks the account's models. */
export const REPLY_SUGGESTION_CLAUDE_MODEL = 'haiku'

const NUMERIC_COLLATOR = new Intl.Collator('en', { numeric: true })

/** The newest catalog model whose id names Luna (the small Codex tier), else null. */
export function newestLunaModelId(modelIds: readonly string[]): string | null {
  const lunas = modelIds.filter((id) => /luna/iu.test(id))
  return lunas.toSorted((a, b) => NUMERIC_COLLATOR.compare(b, a))[0] ?? null
}

/**
 * Which one-shot CLI and model write a session's suggestion, or null when the agent has no
 * evidenced non-interactive print mode here (every agent without a text-generation spec). Codex
 * prefers the cheap Luna tier; Pi, Gentle Shell and Antigravity inherit the chat's own model.
 * Gentle Shell is Pi with its package loaded, so it shares Pi's spec (see the command override).
 */
export function selectReplySuggestionAgent(input: {
  provider: string
  sessionModel: string | undefined
  codexModelIds: readonly string[]
}): ReplySuggestionAgent | null {
  switch (input.provider) {
    case 'claude':
      return { agentId: 'claude', model: REPLY_SUGGESTION_CLAUDE_MODEL }
    case 'codex': {
      const model = newestLunaModelId(input.codexModelIds) ?? input.sessionModel
      return model ? { agentId: 'codex', model } : null
    }
    case 'pi':
      return { agentId: 'pi', model: input.sessionModel ?? 'default' }
    case 'antigravity':
      return { agentId: 'antigravity', model: input.sessionModel ?? 'default' }
    default:
      return null
  }
}

/**
 * The command the one-shot runs as, or undefined for the spec's own binary. Gentle Shell takes the
 * Pi arguments after `--` (`gentle-shell [options] [-- pi-args...]`), so the spec's own
 * `--print --no-session --no-tools` flags still apply and no tool can run. A Pi chat never takes a
 * configured Gentle Shell command, nor the reverse.
 */
export function replySuggestionCommandOverride(
  agentId: TuiAgent,
  piRuntime: PiRuntimeSelection,
  settings: { agentCmdOverrides?: Partial<Record<string, string>> }
): string | undefined {
  if (agentId !== 'pi') {
    return settings.agentCmdOverrides?.[agentId]?.trim() || undefined
  }
  const command = piRuntimeCommandSettings(settings, piRuntime).agentCmdOverrides?.pi?.trim()
  return piRuntime === 'gentle-shell' ? `${command || 'gentle-shell'} --` : command || undefined
}
