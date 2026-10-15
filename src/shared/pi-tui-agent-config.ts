import type { TuiAgentConfig } from './tui-agent-config-types'

/** Gentle Shell keeps the Pi protocol and input contracts with its own executable/home. */
export const PI_TUI_AGENT_CONFIG = {
  detectCmd: 'pi',
  detectCmdAliases: ['gentle-shell'],
  promptInjectionMode: 'argv',
  // Why: Pi has no --prefill; its extension seeds the input without racing startup.
  draftPromptEnvVar: 'ORCA_PI_PREFILL',
  // Why: Pi decodes CSI-u after tool subprocesses reset live KKP state (#9703).
  windowsShiftEnterEncoding: 'csi-u'
} satisfies Omit<TuiAgentConfig, 'launchCmd' | 'expectedProcess'>
