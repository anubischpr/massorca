/** The structured agent-session methods a phone may call; spread into the mobile allowlist. */
export const MOBILE_AGENT_SESSION_RPC_METHODS = [
  'agentSession.createSupport',
  'agentSession.create',
  'agentSession.ensure',
  'agentSession.reveal',
  'agentSession.send',
  'agentSession.cancel',
  'agentSession.queuedMessageSend',
  'agentSession.queuedMessageDelete',
  'agentSession.queuedMessagesResume',
  'agentSession.close',
  'agentSession.respondToApproval',
  'agentSession.respondToQuestion',
  'agentSession.setOption',
  'agentSession.handoffStatus',
  'agentSession.options',
  'agentSession.modelCatalog',
  'agentSession.conversationCommand',
  'agentSession.commands',
  'agentSession.history',
  'agentSession.subscribe',
  'agentSession.unsubscribe',
  // Every session's status on one stream: the phone's chat reads the host's "Stopping…" from it.
  'agentSession.subscribeStatus',
  // One visual from the chat's own visuals folder, for the transcript's `::orca-visual` lines.
  'agentSession.readVisual',
  // A file the chat's agent wrote, for the phone's Artifacts viewer; only journal-recorded paths.
  'agentSession.readRecordedFile',
  // The Prototypes list: each chat's prototype requests, their sets and the set's files, on the host.
  'prototypes.createRequest',
  'prototypes.list',
  'prototypes.readFile',
  'prototypes.readDesignSystem',
  // No-ops on a current host; kept until MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION passes the
  // mobile builds that still call them.
  'agentSession.hold',
  'agentSession.release'
] as const
