import type { SpawnSourceControlAgent } from '../text-generation/source-control-text-generation-types'
import {
  claudeBotRunDisallowedTools,
  deleteBotRunDeniedEnv,
  type BotRunDenial
} from '../marketplace/marketplace-bot-run-denial'

const DISALLOWED_TOOLS_FLAG = '--disallowedTools'

/** Merges deny rules into the turn's own `--disallowedTools` list, or adds the flag when it has none. */
function withDeniedTools(args: readonly string[], rules: readonly string[]): string[] {
  const at = args.indexOf(DISALLOWED_TOOLS_FLAG)
  if (at === -1 || at + 1 >= args.length) {
    return [...args, DISALLOWED_TOOLS_FLAG, rules.join(',')]
  }
  // Why: one flag, one list: a repeated flag may replace the first instead of adding to it.
  return args.map((arg, index) => (index === at + 1 ? `${arg},${rules.join(',')}` : arg))
}

/**
 * A bot reply's agent spawn without the Marketplace apps its bot is kept out of: their tokens are
 * gone from the env, and a Claude turn, which loads the user's own MCP servers, denies every tool of
 * theirs. The spawn is returned as is when the bot is kept out of nothing.
 */
export function withBotRunDeniedSpawn(
  spawn: SpawnSourceControlAgent,
  agentId: string,
  denial: BotRunDenial | null
): SpawnSourceControlAgent {
  if (!denial) {
    return spawn
  }
  const rules = claudeBotRunDisallowedTools(denial)
  return (input) =>
    spawn({
      ...input,
      ...(agentId === 'claude' && rules.length > 0
        ? { args: withDeniedTools(input.args, rules) }
        : {}),
      env: deleteBotRunDeniedEnv({ ...(input.env ?? process.env) }, denial)
    })
}
