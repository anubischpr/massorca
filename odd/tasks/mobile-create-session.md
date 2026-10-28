# Mobile: create a session from the host screen

Branch: `feat/mobile-create-session` (based on `feat/mobile-composer-toolbar` @ 916c0aa8197).
Mirror: Engram topic `odd/mobile-create-session/tasks` (project `massorca`).

## Objective

Replace the host screen's "+" (FAB, header +, Home "New Workspace") with a full-screen
"What do you want to build?" flow, matching the approved prototype: first message first,
chips for Project / Workspace / Agent, a composer row (model, effort, access, send),
a "Run on" host sheet and a ⋯ sheet. Sending creates the workspace (new worktree or the
current checkout), starts the agent with the message as its first turn and lands in the chat.

## Scope

- Mobile only (`mobile/`). No desktop or host changes.
- Reuse existing RPCs only (`agent.launch`, `agent.launchReplay`, `worktree.ps`, `repo.list`,
  `preflight.detectAgents`, `settings.get`, `agentSession.modelCatalog`).
- The Create worktree form (`NewWorktreeFormSheet`) stays reachable from ⋯.
- "Work without a project" stays disabled: `projectlessChats.createWorkspace` is desktop IPC only.

## Constraints

- Remote Wire Compatibility: only existing RPCs or optional fields; older hosts degrade, never fail.
- SSH execution hosts and folder workspaces must work.
- AGENTS.md style: WHY-only comments, no `as` casts, no `max-lines` disables, no vague file names.
- TDD: off (tests ship with the code). Runner: `pnpm test` in `mobile/`.
- Commits: Conventional Commits, one per work unit, no AI attribution.

## Mechanism

The desktop create-chat path is `agentLaunchRoute: 'structured-native-chat'` + `quickPrompt` +
seed picks. The phone-callable equivalent is `agent.launch` (replay variant when the host
advertises it): `target: create-worktree | existing`, `prompt: { delivery: 'submit' }` and
`sessionOptions` (model, effort, fastMode, accessMode). The host settles the surface.

## Tasks

- [x] T1 Pure create-session model (selection defaults, host/project/workspace/agent rules, launch plan) with tests - 6ed87388ad6
- [x] T2 Draft option state (model catalog, effort, fast, access) and the create screen with its chips and sheets - b55ccb0f115 (launch plumbing), b209d614379 (picks and submit state), 61890a1888a (screen)
- [x] T3 Submit, progress view and landing in the chat; error states keep the text - b55ccb0f115, b209d614379
- [x] T4 Entry points rewired (FAB, header +, Home) and the old form reachable from ⋯ - 2a04f4f486d

## Acceptance

- Send is disabled until there is text; a failed create shows the error and keeps the text.
- Current checkout skips the worktree steps; folders show "No Git" and run in place.
- An option the host cannot apply never fails the create.
- `pnpm typecheck` has no errors in touched files; touched tests, oxfmt and oxlint pass.

## Checks

`pnpm typecheck`, `pnpm test <files>`, `oxfmt --check <files>`, `oxlint <files>` (all in `mobile/`).

## Evidence

- `pnpm typecheck` (mobile): same 7 errors as the base commit (router-seam-census, webview-document-census, web-entry), none in touched files.
- `pnpm test` on create-session, tasks/agent-launch*, worktree-create*, session/mobile-existing-agent-launch, NewWorktreeModal, home, host-screen, host-route*, navigation/host-stack-navigation: 268 tests pass.
- `src/tasks/agent-launch-mobile-replay.test.ts` cannot load here: it imports desktop main code that needs `smol-toml` from the root `node_modules`, which this worktree does not install. Environmental, unrelated to the change.
- `oxfmt --check src app` and `oxlint` on touched paths: clean.
- Engram mirror: pending (the memory server refused project `massorca` for this session).

## Review round 1 (independent review of 916c0aa8197..HEAD)

Every item was checked against the code first.

1. Access presets hard-coded for Claude - fixed. Codex declares only auto/read-only, so Plan or
   Accept edits would throw after the worktree exists. `agentSession.agents` is not on the mobile
   allowlist and `agentSession.options` needs a session, so the phone cannot ask the host before
   the session exists. Each agent now gets only the modes it declares (Claude, Codex; any other
   agent offers no access choice), and a test reads the two provider definitions to catch drift.
   The chat negotiates the rest once it is open. Codex tests added.
2. Setup script ran from a tap with no trust step - fixed. The setup is resolved like the old form:
   it runs only when its current content hash was approved and the project runs it by default;
   otherwise it is skipped and the screen says so before sending and again on landing. A project
   that asks every time is skipped (the phone cannot ask here). Send stays off until the project
   hooks are read. The misleading comment is gone.
3. Leaving mid-create dropped the result - fixed. Hardware back and the swipe gesture are blocked
   while creating, and a create that finishes after the screen is gone still opens the session.
   The submit hook test was updated.
4. Older hosts dead-ended - fixed. When the host lacks `agent.launch` (or replay, for the current
   checkout) Send is disabled and the screen points to More options, then the full form.
5. Current checkout landed without a pane key - fixed. The launch outcome now yields the pane key
   (terminal) or the chat tab id (structured), carried to the session route.
6. `rows[0]` fallback for the primary workspace - fixed. The derived main id wins, then the row
   flagged main, then the derived id again; a sibling row is never used.
7. Picks and catalog survived a host or project change - fixed. The draft is keyed on agent, host
   and project, and the catalog is read again per key.
8. Ambiguous delivery on the new-worktree path - fixed. A request that may have reached the host
   now says to check the workspace, as the current-checkout path does; there is no automatic retry.
9. Fallback to plain `worktree.create` lost the prompt - fixed by refusing it: the create ends with
   the update message and creates nothing, so the text is kept.
10. `launchSource` - fixed: `mobile` is an allowed value. (The wire field is an open string, but the
    host telemetry would have recorded `unknown`.)

## Chat-mode follow-up (QA on the phone build)

Root cause: `agent.launch` never names a mode, so a host whose default for new agent tabs is a
terminal built a terminal agent (generic Model pill, no effort/access/Fast, and no first-work rename
on a headless runtime, which only the structured path drives).

- U1 (host + shared, additive) - done. `agent.launch` takes an optional `preferredMode: 'chat'`
  (open like `presentation`: an unknown word reads as absent, and an older host strips it). It
  overrides only a terminal default in `decideAgentLaunchMode`; every feasibility downgrade still
  wins (remote host, reused terminal, agent with no chat, custom start directory, a caller that
  cannot show a chat, and the host create-support answer), and the receipt carries the new reason
  `caller_requested_chat` or the downgrade reason worded as a request. Advertised as
  `agent.launch.preferred-mode.v1`. Tests: decision (terminal default + preference becomes a chat;
  each downgrade still wins), params parsing. **The VPS runtime needs a build with this commit.**
- U2 (mobile) - done. The create screen sends the preference on both launch paths, reads the receipt
  and, when the host still built a terminal, says so on landing with the host own sentence. A host
  that does not advertise the capability gets a one-line note before sending.
- U3 (`pendingFirstAgentMessageRename`, `createChatNaming` on `worktree.create`) - not needed, skipped.
  The structured first-work rename (`worktree.ps` status feed -> `first-work-structured-session-rename`
  -> `maybeAutoRenameBranchOnFirstWork`) renames the branch AND sets the display name in one pass.
  Neither field gates it: `pendingFirstAgentMessageRename` only drives the desktop pending card, and
  `createChatNaming` (merged branch only) just picks the model, falling back to the global Source
  Control AI params. Host-side test: `first-work-phone-created-chat-rename.test.ts`.
  Gates a phone-created chat must pass: the `autoRenameBranchFromWork` setting is on; the worktree is
  runtime-stamped (`orcaCreationSource: 'runtime'`, true for `worktree.create`); the branch leaf is a
  creature name (the phone's generated one is); no upstream; a branch-name generation agent is
  configured in Source Control AI settings; a non-empty first message. The display name is replaced
  only while it is still a generated creature name. A terminal launch skips this path (the PTY path
  waits on a window agent-status event a headless runtime may never drive), which is why the chat
  preference (U1) is what makes the rename happen. The folder keeps its creature name by design.

## Base branch (U4)

A Base branch chip on the create screen, shown only for a new worktree (hidden for the current
checkout and No Git). The default is what the host uses (`repo.baseRefDefault`); a pick is sent as
`baseBranch` on the create target, and nothing is sent when none was picked. The sheet lists local
and remote branches with search through the allowlisted `repo.searchRefs` (the same read the old
form's Create From uses), so no new RPC. The pick resets when the host or project changes. If the
first listing fails (an older host or a failed read) the chip stays on the default and is read-only.

