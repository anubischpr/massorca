import type { StructuredAgentDefinition } from '../native-chat/agent-session-wire/structured-agent-definition'

export const ANTIGRAVITY_STRUCTURED_AGENT: StructuredAgentDefinition = {
  agent: 'antigravity',
  handleTransport: 'antigravity-stream-json',
  accountLocatorKind: 'antigravity',
  capabilities: {
    rewind: false,
    compact: false,
    threadGoal: false,
    contextUsage: false,
    imagePrompts: false,
    steering: 'queue',
    approvalEnforcement: 'provider'
  },
  restingOptions: {
    acceptsKey: (key) => key === 'model' || key === 'effort',
    fallbackModels: () => null,
    effortDefaultsToModel: false
  }
}
