import type { RawListeningPort } from './local-workspace-port-scan-state'

const AGENT_PROCESS_NAMES = new Set([
  'agy',
  'claude',
  'codex',
  'pi',
  'omp',
  'opencode',
  'gentle-shell',
  'gentle-pi',
  'orca-ide',
  'engram',
  'codegraph'
])
const SCRIPT_RUNTIMES = new Set(['node', 'nodejs', 'bun', 'deno', 'python', 'python3', 'npx'])
const AGENT_PACKAGE_PATH =
  /node_modules\/(?:@mariozechner\/pi-coding-agent|@anthropic-ai\/claude-code|@openai\/codex|@google\/gemini-cli|@?oh-my-pi|opencode(?:-ai)?|gentle-pi|gentle-shell|engram|codegraph|@colbymchenry\/codegraph)(?:\/|$)/
const MCP_OR_LSP_ARGV =
  /@modelcontextprotocol\/|\bmcp[-_](?:server|remote|proxy)\b|\bserver[-_]mcp\b|\b(?:typescript|vscode-\w+|lua|yaml|bash)-language-server\b|\btsserver\b|\bpyright\b|\bpylsp\b|\bgopls\b|\brust-analyzer\b|\bclangd\b|--lsp\b/

function executableName(token: string): string {
  const base = token.replace(/["']/g, '').replaceAll('\\', '/').split('/').pop() ?? ''
  return base.toLowerCase().replace(/\.(?:exe|cmd|bat|js|mjs|cjs|ts)$/, '')
}

function launchedScript(tokens: string[]): string | undefined {
  const runtime = tokens[0] ? executableName(tokens[0]) : ''
  return SCRIPT_RUNTIMES.has(runtime) ? tokens.slice(1).find((token) => !token.startsWith('-')) : undefined
}

/** Listeners that belong to an agent CLI, a structured chat child or tool infrastructure, never a user server. */
export function isAgentInfrastructureListener(
  port: Pick<RawListeningPort, 'pid' | 'processName' | 'commandLine'>,
  providerPids: ReadonlySet<number>
): boolean {
  if (port.pid !== undefined && providerPids.has(port.pid)) {
    return true
  }
  if (port.processName && AGENT_PROCESS_NAMES.has(executableName(port.processName))) {
    return true
  }
  const commandLine = port.commandLine?.replaceAll('\\', '/')
  if (!commandLine) {
    return false
  }
  const tokens = commandLine.split(/\s+/).filter(Boolean)
  const entry = tokens[0]
  if (entry && AGENT_PROCESS_NAMES.has(executableName(entry))) {
    return true
  }
  const script = launchedScript(tokens)
  if (script && AGENT_PROCESS_NAMES.has(executableName(script))) {
    return true
  }
  return AGENT_PACKAGE_PATH.test(commandLine) || MCP_OR_LSP_ARGV.test(commandLine)
}
