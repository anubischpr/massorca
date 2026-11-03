import type { TuiAgent } from '../../../../shared/tui-agent'
import type { TabBarProps } from './tab-bar-props'
import type { TabAgentLaunchOption } from './tab-agent-launch-options'

/** Sends the "+" menu's agent picks to the strip's host when it has one, else keeps the menu's own launch. */
export function withHostAgentLaunch<
  T extends { launchAgentFromNewTabEntry: (agent: TuiAgent) => void }
>(
  createMenu: T,
  createHost: TabBarProps['createHost'],
  agentLaunchOptions: readonly TabAgentLaunchOption[]
): T {
  if (!createHost) {
    return createMenu
  }
  return {
    ...createMenu,
    launchAgentFromNewTabEntry: (agent) => {
      const option = agentLaunchOptions.find((candidate) => candidate.agent === agent)
      createHost.launchAgent(agent, option?.label ?? agent)
    }
  }
}
