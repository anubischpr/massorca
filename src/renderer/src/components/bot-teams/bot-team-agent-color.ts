import type { BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'

/** Brand fills of the agent icons that have one; the monochrome icons leave a name in the text color. */
const AGENT_BRAND_COLOR: Readonly<Record<string, string>> = {
  claude: '#D97757',
  'claude-agent-teams': '#D97757',
  // Close to the main color of the bundled antigravity.png and gentle-shell.png icons.
  antigravity: '#4E8CF7',
  pi: '#E5486F'
}

/** The color of a bot's name, taken from its agent icon's brand fill. */
export function botAgentNameColor(agent: BotTeamBot['agent'] | undefined): string | undefined {
  return agent ? AGENT_BRAND_COLOR[agent] : undefined
}
