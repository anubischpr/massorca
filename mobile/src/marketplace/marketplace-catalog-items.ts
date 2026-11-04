import {
  MARKETPLACE_APP_AGENTS,
  type MarketplaceAppAgent,
  type MarketplaceAppStatus
} from '../../../src/shared/marketplace-apps'
import type { MarketplaceGlyphName } from './marketplace-glyphs'
import {
  catalogAgentDesc,
  catalogAgentName,
  isAgentDetected,
  type CatalogItem,
  type CatalogKind,
  type CatalogSource,
  type CatalogState
} from './marketplace-catalog-model'

function agentKnown(agent: MarketplaceAppAgent, source: CatalogSource): boolean {
  return agent === 'gentle-shell' ? source.piRuntimes !== null : source.agentIds !== null
}

function connectedApp(apps: readonly MarketplaceAppStatus[], id: string): boolean {
  return apps.some((app) => app.id === id && app.connected)
}

function agentPath(agent: MarketplaceAppAgent): string {
  return `/marketplace/agent/${agent}`
}

/**
 * A row the host reports nothing for. It shows the not-yet-set action (Install or Connect) in a
 * neutral tone, with no tap target, so it never claims a state the host did not report.
 */
function boardItem(
  id: string,
  kind: CatalogKind,
  name: string,
  desc: string,
  glyph: MarketplaceGlyphName,
  state: CatalogState
): CatalogItem {
  return {
    id,
    kind,
    name,
    desc,
    icon: { kind: 'glyph', glyph },
    state,
    source: 'board',
    openPath: null,
    actionPath: null
  }
}

/** Board rows always appear; host rows appear only for the reads that answered. */
export function buildCatalogItems(source: CatalogSource): CatalogItem[] {
  const items: CatalogItem[] = []
  const tools = source.tools
  const apps = source.apps
  if (tools !== null) {
    items.push({
      id: 'git',
      kind: 'tool',
      name: 'Git',
      desc: 'Versions of files and code.',
      icon: { kind: 'glyph', glyph: 'branch' },
      state: tools.git ? 'installed' : 'missing',
      source: 'host',
      openPath: '/marketplace/git',
      actionPath: tools.git ? '/marketplace/git' : null
    })
    items.push({
      id: 'gh',
      kind: 'tool',
      name: 'GitHub CLI',
      desc: 'Signs in to GitHub.',
      icon: { kind: 'glyph', glyph: 'term' },
      state: tools.gh.installed ? 'installed' : 'missing',
      source: 'host',
      openPath: null,
      actionPath: null
    })
  }
  items.push(boardItem('node', 'tool', 'Node.js', 'Runs JavaScript tools.', 'hex', 'missing'))
  if (apps !== null) {
    items.push({
      id: 'engram',
      kind: 'tool',
      name: 'Engram',
      desc: 'Memory agents keep between sessions.',
      icon: { kind: 'glyph', glyph: 'brain' },
      state: connectedApp(apps, 'engram') ? 'installed' : 'missing',
      source: 'host',
      openPath: '/marketplace/engram',
      actionPath: '/marketplace/engram'
    })
  }
  for (const agent of MARKETPLACE_APP_AGENTS) {
    if (!agentKnown(agent, source)) {
      continue
    }
    items.push({
      id: agent,
      kind: 'agent',
      name: catalogAgentName(agent),
      desc: catalogAgentDesc(agent),
      icon: { kind: 'agent', agentId: agent },
      state: isAgentDetected(agent, source) ? 'found' : 'missing',
      source: 'host',
      openPath: agentPath(agent),
      actionPath: agentPath(agent)
    })
  }
  items.push(
    boardItem('browser', 'skill', 'Browser use', 'Agents use the browser pane.', 'book', 'missing')
  )
  items.push(
    boardItem('linear', 'skill', 'Linear', 'Agents update Linear issues.', 'book', 'missing')
  )
  items.push(
    boardItem('orch', 'skill', 'Orchestration', 'Agents hand work to agents.', 'book', 'missing')
  )
  items.push(boardItem('price', 'skill', 'Price check', 'Made by Development.', 'book', 'missing'))
  if (apps !== null) {
    items.push({
      id: 'openmetadata',
      kind: 'service',
      name: 'OpenMetadata',
      desc: 'Company context, over MCP.',
      icon: { kind: 'glyph', glyph: 'db' },
      state: connectedApp(apps, 'openmetadata') ? 'connected' : 'off',
      source: 'host',
      openPath: '/marketplace/openmetadata',
      actionPath: '/marketplace/openmetadata'
    })
    items.push({
      id: 'github',
      kind: 'service',
      name: 'GitHub',
      desc: 'Repositories and pull requests.',
      icon: { kind: 'glyph', glyph: 'github' },
      state: connectedApp(apps, 'github') ? 'connected' : 'off',
      source: 'host',
      openPath: '/marketplace/github',
      actionPath: '/marketplace/github'
    })
  }
  if (tools !== null && tools.glab !== null) {
    items.push({
      id: 'gitlab',
      kind: 'service',
      name: 'GitLab',
      desc: 'Repositories and merge requests.',
      icon: { kind: 'glyph', glyph: 'gitlab' },
      state: tools.glab.authenticated ? 'connected' : 'off',
      source: 'host',
      openPath: null,
      actionPath: null
    })
  }
  items.push(boardItem('email', 'service', 'Email', 'Bot teams read and send mail.', 'mail', 'off'))
  items.push(
    boardItem('calendar', 'service', 'Calendar', 'Bot teams read and add events.', 'cal', 'off')
  )
  items.push(
    boardItem('drive', 'service', 'Shared drive', 'Bot teams save shared files.', 'drive', 'off')
  )
  items.push(boardItem('crm', 'service', '[CRM]', 'Bot teams read customers.', 'users', 'off'))
  return items
}
