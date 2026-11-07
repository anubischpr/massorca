import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const CHAT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['chat', 'results'],
    summary: "List a native chat's Results: environment URLs and changed files",
    usage: 'orca chat results --session <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'session'],
    notes: [
      'Read by the chat\'s execution host from its newest journal page. Environment URLs come newest first; "previous" marks one a newer deploy of the same environment replaced.',
      'Only environment URLs count: dev-server and deploy output, localhost or host:port URLs, preview/staging/test hosts, and URLs the agent hands over to test. Docs, forge, issue and PR links do not.',
      'For a chat on a paired host, add --environment <name> so that host reads its own journal.'
    ],
    examples: [
      'orca chat results --session <id>',
      'orca chat results --session <id> --json',
      'orca chat results --session <id> --environment <name>'
    ]
  }
]
