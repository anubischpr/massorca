// Split out of protocol-version.ts, which spreads the list below into RUNTIME_CAPABILITIES in this
// order. Import these names from here: the mobile recording loader cannot follow `export *`.

/**
 * `agent.launch` exists: one host-side method that decides structured-vs-terminal and creates the
 * surface. Negotiated because `worktree.create` + `startupAgent` stays supported verbatim for a
 * client that cannot see it, and advertising it states the client understands EITHER outcome.
 */
// v2 makes prompt delivery an outcome union and top-level warnings the only supported shape.
export const AGENT_LAUNCH_RUNTIME_CAPABILITY = 'agent.launch.v2' as const

// Optional identity support on agent.launch; mobile replay across replacement hosts requires the new method.
export const AGENT_LAUNCH_REPLAY_RUNTIME_CAPABILITY = 'agent.launch.replay.v1' as const

// A host that sends a launch prompt its typed startup line cannot carry to a paste after
// readiness; an older host folds any prompt into that line, so clients gate prompted launches on it.
export const AGENT_LAUNCH_PROMPT_CARRY_RUNTIME_CAPABILITY = 'agent.launch.prompt-carry.v1' as const

// agent.launchReplay requires the ledger; older replacement hosts must reject the method.
export const AGENT_LAUNCH_REPLAY_REQUIRED_RUNTIME_CAPABILITY =
  'agent.launch.replay-required.v1' as const

// A client that reads `prompt.outcome: 'unconfirmed'` on a replayed launch. Without it, a launch
// whose host stopped mid-delivery replays as `agent_session_operation_unknown`, as it always has.
export const AGENT_LAUNCH_PROMPT_UNCONFIRMED_RUNTIME_CAPABILITY =
  'agent.launch.prompt-unconfirmed.v1' as const

// Host-advertised: reads `placement` and `presentation`, reports the placement in the receipt, and
// may publish the launch's tab before it admits the launch.
export const AGENT_LAUNCH_PLACEMENT_RUNTIME_CAPABILITY = 'agent.launch.placement.v1' as const

// Host-advertised: accepts `target.kind: 'create-folder-workspace'`. An older host refuses the
// unknown target kind, so a client offers the new-folder-workspace launch only on this. It is not
// enough on its own: the target also needs `folderWorkspace.create` authorization, which a
// mobile-scope device lacks, so a phone folder launch needs its own gate.
export const AGENT_LAUNCH_CREATE_FOLDER_WORKSPACE_RUNTIME_CAPABILITY =
  'agent.launch.create-folder-workspace.v1' as const

// Client-advertised only: the client reads a listed launch tab with no terminal yet as "not
// started", never as proof its agent runs. The host publishes a paired caller's tab before the
// spawn only for a client that says so.
export const AGENT_LAUNCH_UNSTARTED_TAB_CLIENT_CAPABILITY = 'agent.launch.unstarted-tab.v1' as const

// Client-advertised only: the client reads `agent_launch_tab_closed` (the user closed the launch's
// tab while it started, so it was stopped) as a definite answer. Others get
// `agent_session_operation_unknown` for it, as before the host knew.
export const AGENT_LAUNCH_TAB_CLOSED_CLIENT_CAPABILITY = 'agent.launch.tab-closed.v1' as const

// Host-advertised: reads `preferredMode: 'chat'`, a request for a chat over a terminal default.
// An older host ignores the field, so a client words its UI on this and sends the field regardless.
export const AGENT_LAUNCH_PREFERRED_MODE_RUNTIME_CAPABILITY =
  'agent.launch.preferred-mode.v1' as const

export const AGENT_LAUNCH_RUNTIME_CAPABILITIES = [
  AGENT_LAUNCH_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_REPLAY_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_REPLAY_REQUIRED_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_PROMPT_CARRY_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_PROMPT_UNCONFIRMED_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_PLACEMENT_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_CREATE_FOLDER_WORKSPACE_RUNTIME_CAPABILITY,
  AGENT_LAUNCH_PREFERRED_MODE_RUNTIME_CAPABILITY
] as const
