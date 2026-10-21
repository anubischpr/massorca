import type { AgentType } from './agent-status-types'
import { piRuntimeForSessionFilePath, type PiRuntimeSelection } from './pi-runtime-selection'

// Shared so the desktop renderer and the mobile app show the same agent name
// (e.g. native chat's empty state on both surfaces) from one source of truth.
const WELL_KNOWN_LABELS: Record<string, string> = {
  claude: 'Claude',
  codebuddy: 'CodeBuddy',
  openclaude: 'OpenClaude',
  codex: 'Codex',
  qoder: 'Qoder CLI',
  qodercli: 'Qoder CLI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  amp: 'Amp',
  copilot: 'GitHub Copilot',
  opencode: 'OpenCode',
  opencode2: 'OpenCode 2',
  'mimo-code': 'MiMo Code',
  cursor: 'Cursor',
  aider: 'Aider',
  pi: 'Pi',
  omp: 'OMP',
  'prime-agent': 'Prime Agent',
  droid: 'Droid',
  'command-code': 'Command Code',
  grok: 'Grok',
  hermes: 'Hermes',
  devin: 'Devin',
  ante: 'Ante',
  trae: 'Trae',
  kimi: 'Kimi',
  muse: 'Muse',
  zcode: 'ZCode',
  dsh: 'DeepSeek Harness',
  dsb: 'DeepSeek Build',
  jcode: 'Jcode'
}

export const GENTLE_SHELL_LABEL = 'Gentle Shell'
const PI_OR_GENTLE_SHELL_LABEL = 'Pi / Gentle Shell'

export function formatAgentTypeLabel(agentType: AgentType | null | undefined): string {
  if (!agentType || agentType === 'unknown') {
    return 'Agent'
  }
  // Capitalize well-known names nicely; pass through custom names as-is
  return WELL_KNOWN_LABELS[agentType] ?? agentType
}

/** The Pi runtime a row's label names: a stock or Gentle Shell answer, or unknown while none is known. */
export type PiRowRuntime = PiRuntimeSelection | 'unknown'

/**
 * A Pi-protocol row names the runtime its session lives in, or else the runtime the caller resolved for its
 * workspace. Gentle Shell keeps its own identity; an unknown runtime reads as the neutral combined name.
 */
export function formatAgentRowTypeLabel(
  row: {
    agentType: AgentType | null | undefined
    entry?: { providerSession?: { transcriptPath?: string } }
  },
  piRuntime?: PiRowRuntime
): string {
  if (row.agentType !== 'pi') {
    return formatAgentTypeLabel(row.agentType)
  }
  const transcriptPath = row.entry?.providerSession?.transcriptPath
  const runtime = transcriptPath ? piRuntimeForSessionFilePath(transcriptPath) : piRuntime
  if (runtime === 'gentle-shell') {
    return GENTLE_SHELL_LABEL
  }
  if (runtime === 'unknown') {
    return PI_OR_GENTLE_SHELL_LABEL
  }
  return formatAgentTypeLabel(row.agentType)
}
