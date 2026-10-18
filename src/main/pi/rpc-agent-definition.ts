import type { DirectoryAccountAgentDefinition } from '../native-chat/agent-session-wire/structured-agent-definition'

export const PI_RPC_AGENT: DirectoryAccountAgentDefinition = {
  agent: 'pi',
  handleTransport: 'jsonl-rpc',
  accountHomeVariable: 'PI_CODING_AGENT_DIR',
  capabilities: {
    rewind: false,
    compact: true,
    threadGoal: false,
    contextUsage: true,
    imagePrompts: true,
    steering: 'inject',
    approvalEnforcement: 'provider',
    supportedAccessModes: ['full-access'],
    // Gentle Shell keeps its own permission modes (`/gentle:mode`, `/gentle:yolo`); stock Pi has none.
    runtimeAccess: { 'gentle-shell': { modes: ['default', 'full-access'], presets: ['auto'] } }
  },
  restingOptions: {
    acceptsKey: (key) => key === 'model' || key === 'effort',
    fallbackModels: () => null,
    effortDefaultsToModel: false
  }
}
