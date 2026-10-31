import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'

export const structuredOptionSnapshot: SessionOptionDescriptor[] = [
  {
    id: 'model',
    label: 'Model',
    category: 'model',
    kind: {
      type: 'select',
      currentValue: 'gpt-fast',
      choices: [{ value: 'gpt-fast', label: 'GPT Fast' }]
    },
    valueSource: 'reported',
    transport: 'agent-session',
    settable: true
  }
]
