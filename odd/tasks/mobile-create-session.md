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

