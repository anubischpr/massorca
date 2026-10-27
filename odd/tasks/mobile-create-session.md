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
