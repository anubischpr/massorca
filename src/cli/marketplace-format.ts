import {
  isMarketplaceAgentEntryMissing,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppAgent,
  type MarketplaceAppAgentStatus,
  type MarketplaceAppId,
  type MarketplaceAppStatus
} from '../shared/marketplace-apps'

const APP_NAMES: Record<MarketplaceAppId, string> = {
  engram: 'Engram',
  openmetadata: 'OpenMetadata',
  github: 'GitHub'
}

// Why: Gentle Shell is never called Pi in user-facing text.
const AGENT_NAMES: Record<MarketplaceAppAgent, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  antigravity: 'Antigravity',
  'gentle-shell': 'Gentle Shell'
}

/** One agent's integration state in the words the Marketplace page uses; "Missing" is what Connect fills in. */
export function marketplaceAgentStateLabel(
  appId: MarketplaceAppId,
  agent: MarketplaceAppAgentStatus
): string {
  if (agent.installed === false) {
    return 'Not installed'
  }
  if (agent.allowed === false) {
    return 'Blocked by access policy'
  }
  if (agent.outsideHome === true) {
    return 'Left alone (settings file outside home)'
  }
  if (isMarketplaceAgentEntryMissing(appId, agent)) {
    return 'Missing'
  }
  switch (agent.entry) {
    case 'set':
      return 'Set'
    case 'built-in':
      return 'Built in'
    case 'unreadable':
      return 'Unreadable config'
    case 'missing':
      return 'Not set'
  }
}

function formatAccess(policy: MarketplaceAppAccessPolicy | undefined): string {
  if (!policy) {
    return 'everyone (host predates access policies)'
  }
  const agents =
    policy.agents.mode === 'everyone'
      ? 'everyone'
      : `${policy.agents.mode} ${policy.agents.ids.map((id) => AGENT_NAMES[id]).join(', ') || '(none)'}`
  const botCount = policy.bots.botIds.length + policy.bots.teamIds.length
  const bots =
    policy.bots.mode === 'everyone' ? 'everyone' : `${policy.bots.mode} ${botCount} picked`
  return `agents ${agents}; bots ${bots}`
}

export function formatMarketplaceApp(app: MarketplaceAppStatus): string {
  const lines = [
    `${APP_NAMES[app.id]} (${app.id}): ${app.connected ? 'connected' : 'not connected'}`
  ]
  if (app.program) {
    lines.push(
      `  program: ${app.program.found ? `found${app.program.version ? ` ${app.program.version}` : ''}` : 'not found'}`
    )
  }
  if (app.serverUrl !== undefined) {
    lines.push(`  server: ${app.serverUrl ?? '(none)'}`)
  }
  if (app.credential) {
    lines.push(`  token: ${app.credential.stored ? 'stored' : 'not stored'}`)
  }
  for (const profile of app.profiles ?? []) {
    lines.push(
      `  profile ${profile.name}: ${profile.url} (token ${profile.hasToken ? 'stored' : 'not stored'})`
    )
  }
  lines.push(`  access: ${formatAccess(app.access)}`)
  for (const agent of app.agents) {
    lines.push(`  ${AGENT_NAMES[agent.agent]}: ${marketplaceAgentStateLabel(app.id, agent)}`)
  }
  return lines.join('\n')
}

export function formatMarketplaceApps(apps: readonly MarketplaceAppStatus[]): string {
  return apps.length === 0
    ? 'No Marketplace apps on this host.'
    : apps.map(formatMarketplaceApp).join('\n\n')
}

export function formatMarketplaceAccess(app: MarketplaceAppStatus): string {
  return `${APP_NAMES[app.id]} access: ${formatAccess(app.access)}`
}
