# Delegated child sessions (any agent, Automatic router)

## Objective

From a parent structured chat, start a child session run by any agent connected on that host (Claude, Codex, Antigravity, Gentle Shell, ACP agents) or by "Automatic". Automatic is a host-side deterministic router that picks the agent with the lowest usage, then the model and effort from a task classification. The child is linked under the parent on desktop and mobile, and when it finishes it notifies the parent, which can reach the child's result.

## Problem

Orca orchestration (Run / Task / Dispatch / worker_done) already coordinates workers, but only for terminal panes. A structured chat has no session-to-session link, no way to receive worker_done, and no Orca-originated card in the chat. Usage per agent is measured (`RateLimitService`) but nothing ranks agents by it, and there is no task classifier.

## Why

MassOrca's advantage over Claude Desktop is that a child can run on any connected agent. The user works with one parent session per feature worktree and several child sessions for specific tasks, and wants the cheapest agent with headroom to be picked automatically.

## Scope

- Pure router: agent ranking by usage, task tier classification on the four Jev dimensions (risk, complexity, verifiability, ambiguity), per-agent tier → model/effort table, worktree placement, reasons.
- Usage adapter from `RateLimitService` snapshots to router input per agent.
- Parent link: child is an orchestration Task/Dispatch whose coordinator is the parent structured session; optional `parentSessionId`; projection nests agent rows by session.
- Completion delivery: worker_done for a structured coordinator becomes a journal notice in the parent chat.
- Host RPC + `orca` CLI command for the parent agent to request delegation; the request appears as a question item with an optional `delegation` extension (old clients see a plain question).
- Desktop and mobile rendering of the rich card, the "why Automatic" detail, the completion notice and nesting.

Out of scope (v1): switching to a second account of the same agent (follow-up); SSH hosts (they cannot run structured chats today); Jev remote classification (optional add-on, follow-up).

## Constraints

- Build on orchestration; no parallel coordination mechanism.
- Remote wire compatibility: only optional fields and capability-negotiated methods.
- Code term `delegated session`; "child session" only in UI copy ("child" already means provider subagents in code).
- Access mode is copied from the parent and never escalated.
- Design system: `docs/STYLEGUIDE.md` tokens and shadcn primitives.
- Cross-platform; folder workspaces always run the child in the current workspace.

## Decisions (approved prototype https://claude.ai/artifact/8x18gaF2y6cZKXPzzfAWaJ, 2026-10-28)

- Usage window: the tightest of 5h and weekly (`max(usedPercent)`); agents at ≥ 90% or limit-reached are excluded from the winner but still listed in the ranking. No data counts as 60% and is labelled. No data means: no sample, no fetch time, no window percent, a sample older than 15 min, a sample more than 1 min ahead of the clock (clock-skew tolerance), or a meter whose status is `error` or `unavailable`.
- Tie within 5 points of the lowest usage: the parent's agent wins when it is in that band and does not already rank first. Otherwise an exact tie goes to the fixed order (claude, codex, antigravity, pi, then alphabetical). A duplicate agent id keeps the entry that ranks first, so input order never decides.
- Placement: `current` worktree for read-only tasks; `new-child` worktree when the task writes code in a git workspace. A folder workspace always runs in the current folder, with the `folder-workspace-writes` warning.
- Model and effort: effort is named only with a model (worker-start refuses an effort alone). An agent that runs its own default model gets neither; a tier model the catalog does not list falls back to the default with no effort (`model-unavailable`).
- Automatic does not switch accounts in v1.
- Folder-workspace child (2026-10-29): keep the `folder-workspace-writes` card warning. A child that writes in place in a folder gets a task paragraph naming that folder and saying it owns only the files its task names; the parent keeps the rest. No locking in v1. A folder the host cannot find refuses the start. Git-worktree and read-only placements are unchanged (`f334ccce095`).

## Configuration

- TDD: off (source: no project/session TDD configuration found). Ordinary functional checks apply.
- Runner: `pnpm exec vitest run --config config/vitest.config.ts <files>`; typecheck `pnpm tc`; lint `pnpm run check:code-quality:changed`.
- Delivery strategy: `ask-on-risk`. Forecast ~2000–2800 authored lines across 6 work units; slicing strategy to be asked before exceeding ~400 lines per review slice (no PR in this task).

## Tasks

- [x] T1 — Pure router module (`src/main/delegated-session/`) and shared wire types; tests. Route: delegated direct (writer trigger).
  - Files: `src/shared/delegated-session-types.ts`; `src/main/delegated-session/` (classifier, agent ranking, model tiers, router), one `*.test.ts` each.
  - Model ids are the ones the codebase uses: Claude `haiku`/`sonnet`/`opus` (`src/shared/agent-session-option-catalog-claude-codex.ts`); Codex `gpt-6-luna`/`gpt-6.1-sol`/`gpt-6-astra` (`mobile/src/session/mobile-native-chat-featured-models.ts`).
  - Precedence: the first matching keyword rule wins; complexity checks medium before low, so "implement the lint rule" stays medium.
  - Decided (parent): "release" is risky only in shipping phrases ("cut a release", "release to", "publish/ship a release"), and "auth" no longer matches "author". The prototype example gives tier 3 (tested). Commit `3601205763e`; 5 files, 87 passed.
  - Checks: `pnpm exec vitest run --config config/vitest.config.ts src/main/delegated-session` → 4 files, 78 passed. `pnpm exec oxlint` on the new files → exit 0. `oxfmt --check` → clean. `pnpm tc:node` → exit 0. `ORCA_CODE_QUALITY_BASE=HEAD pnpm run check:code-quality:changed` → 0 findings in 9 files (the default base `origin/main` lists about 2,300 changed files on this long-lived branch and overflows the Windows argv limit).
  - Runtime harness: N/A (pure functions). Rollback: delete `src/main/delegated-session/` and `src/shared/delegated-session-types.ts`.
- [x] T2 — Usage adapter: TuiAgent → rate-limit provider mapping, snapshot → router usage input, staleness; tests. Route: delegated direct.
  - File: `src/main/delegated-session/delegation-usage-input.ts` (pure). Input is the `RateLimitState` that `RateLimitService.getState()` (public, `src/main/rate-limits/service/service-configuration.ts`) returns, so T4 wires the live read in one call.
  - Mapping: claude → `claude`, codex → `codex`, antigravity → `antigravity`, pi on Gentle Shell → `nan`. Stock Pi has no meter in `RateLimitState`, so it stays no-data (60%). `grok`, `omp` and `opencode` are not mapped, per the brief (ACP agents); `grok` does exist in `RateLimitState` if the brief changes.
  - Sample: 5-hour and weekly used percent; `limitReached` when a window reaches 100%; `fetchedAt` is the provider's `updatedAt`, so the router's 15-minute staleness applies. A meter with status `error` or `unavailable` gives no usage at all, even when old numbers remain. Top-level entries are the active account only.
  - Checks: `pnpm exec vitest run --config config/vitest.config.ts src/main/delegated-session` → 5 files, 85 passed. `pnpm exec oxlint` on the new files → exit 0. `oxfmt --check` → clean. `pnpm tc:node` → exit 0. `ORCA_CODE_QUALITY_BASE=HEAD pnpm run check:code-quality:changed` → 0 findings in 2 files.
  - Runtime harness: N/A (pure function). Rollback: delete `src/main/delegated-session/delegation-usage-input.ts` and its test.
- [x] T3 — Structured workers on any agent: `WorkerStartParams` gains optional `preferredMode` and `accessMode`; worker-start honors `sessionOptions` (model, effort, access) and accepts every registered structured agent, not only claude/codex; capability in `src/shared/orchestration-runtime-capabilities.ts`. Agent-row projection carries the structured coordinator as parent (session-keyed via `structuredAgentSessionPaneKey`), so structured workers nest under a structured parent. Tests. Route: delegated direct. (Coordinator = structured session and mail to it already work: `run-coordinator-orca-session.ts`, `structured-mailbox-pointer-host.ts`.)
  - Files: `src/shared/rpc-contract/orchestration-worker-start-params.ts` (+ test); `src/shared/orchestration-runtime-capabilities.ts`, `src/shared/protocol-version.ts`, `src/shared/cli-argument-boundary.ts`; `src/main/runtime/rpc/methods/orchestration-worker-start-mode.ts`; `src/main/agent-launch/agent-launch-mode.ts` (optional host access); `src/main/runtime/rpc/methods/orchestration/worker/` (`worker-start-access-mode.ts` + tests, `worker-topology.ts`, `local-worker-start.ts`, `worker-start-agent-placement.ts`, `workers.ts`, `worker-opencode-model-preflight.ts`); `src/main/runtime/rpc/methods/orchestration-structured-worker-session.ts`; `src/main/runtime/rpc/methods/structured-agent-session-create.ts`; `src/main/runtime/structured-worker-identity.ts`; `src/main/runtime/structured-worker-authority.ts`; `src/main/runtime/runtime-agent-orchestration-projection.ts` (+ `runtime-agent-orchestration-projection-structured.test.ts`); `src/main/runtime/orca-runtime-stop-requested-pty-ids.ts`; `src/cli/specs/orchestration-worker-specs.ts`; `src/cli/handlers/orchestration/worker-launch-handler.ts` (+ `src/cli/handlers/orchestration-worker-start-structured-options.test.ts`).
  - Commits: `f7142b326462f7211975b79ce3bf85f27c45ff0c` (worker-start on any agent with model, effort, access, and the capability); nesting in the next commit, `feat(orchestration): nest structured workers under their structured coordinator`.
  - Nesting key: a structured worker's row is `structuredAgentSessionPaneKey(structuredAgentSessionTabId(sessionId), sessionId)`, the key the renderer and worktree list already use for a chat. Its parent is the coordinator's row key, derived from the run's current `coordinator_orca_session_id` (or the stored pane key of a terminal coordinator). No wire change, no new field.
  - Decisions: `--chat` was added to the CLI as the brief asked, which supersedes the old note that there is no mode flag. An explicit `accessMode` is never downgraded to a terminal: a start that would be a terminal is refused. Pi reads the stock declaration, so `default` is refused on Pi until Gentle Shell's modes are read. ACP agents (Grok, OpenCode, OMP) declare no access, so an explicit mode is refused for them. T4 should pass `preferredMode: 'chat'` and an explicit `accessMode` the chosen agent declares.
  - Checks: `tc:node`, `tc:cli`, `tc:web` exit 0 (foreground). `ORCA_CODE_QUALITY_BASE=afd0a99f89d pnpm run check:code-quality:changed`: 0 findings. Vitest passes for the new and changed suites (params, mode, registered agent, preferred mode, access mode, topology, CLI structured options, projection) and for the 23 files that touch `parentPaneKey` or `agentOrchestrationByPaneKey` (328 tests).
  - Known failures, not caused by this work: `agent-launch-*`, `structured-worker-at-rest` and `structured-worker-cleared-session` fail on Windows with `EBUSY` while unlinking SQLite journals in temp dirs. `agent-launch-instant-tab` mocks lack methods the runtime calls (`selectCreatedMobileSessionTabForClient`, `resolveStructuredAgentSessionCreateIntent`). `orchestration-worker-cli` recovery-command tests assert POSIX quoting on win32. The `orca-runtime-tests/*.spec.ts` lineage suites sit outside every configured Node include and were not run.
- [x] T4 — Delegation request: `orca orchestration delegate --summary --prompt [--title] [--writes]` CLI + host RPC `orchestration.delegateRequest`; a durable `delegation_requests` row; a host-owned question card in the parent journal with an optional `delegation` extension; the prompt-response and Cancel paths branch before the provider adapter; the answer launches a chat worker on the chosen agent with the parent's access mode; started, failed and finished notices in the parent journal; capability `orchestration.delegation.v1`. Route: delegated direct.
  - Commits: `c3cb86c638c` (store + card), `73071e39c75` (answer, launch, completion, RPC, capability), `0fe4795e217` (summary bound on the host, no type assertions), `09dfea477c5` (CLI + guides). Authored lines 4,601 (2,205 production, 2,363 tests, 33 guide text; additions plus deletions, generated files excluded), far above the ~400 planning heuristic; not split, because the request record, the card, the answer branch and the launcher are one contract and each commit ships its tests.
  - Wire (all additions are optional fields; no new item kind or opcode): `AgentJournalQuestionItem.delegation?: DelegationCardPayload` on the card (item key `orca:delegation%3A<requestId>`, identity `{provider:'orca', clientMessageId:'delegation:<requestId>'}`); `AgentJournalStatusItem.delegation?: DelegationNoticePayload` on the `started`, `failed` and `finished` notices (status rows with `tone` `notice` or `error`; identity `delegation-notice:<requestId>:<status>`). Types and tolerant readers (`readDelegationCardPayload`, `readDelegationNoticePayload`) are in `src/shared/delegated-session-journal.ts`.
  - Card options: `automatic` (only when some agent has headroom), then `agent:<agentId>` in usage order. An answer is `optionId`; Automatic is decided again at the answer, a manual pick takes its own tier model and effort.
  - Host-owned discriminator: the `delegation:` item key (and the `delegation` field on the body). `terminalAgentJournalBody`/`requiresTerminalSettlement`, the message-queue gate, the idle sweep and command admission skip such a question, so a child's end, a new child, or a restart never cancels it and it never holds the chat back.
  - Launch: parent's Run reused (`getCurrentRunForCoordinator`) or created; Task holds the prompt; worker-start with `preferredMode:'chat'`, model (and effort only with a model, since worker-start refuses an effort alone), `accessMode` copied from the parent and omitted for ACP agents, for `default` on Pi and when the parent follows the global setting; `new-child` worktree (named from the title) for writes in a git workspace, otherwise `current`. Model and effort are clamped to what the agent's launch catalog accepts (Haiku lists no effort).
  - Completion: any path that settles a dispatch calls `notifyDispatchSettled` from `transitionLifecycleWithDb`; the service finishes the request, stores `tasks.result` (or the dispatch failure) and posts the finished notice. A restart re-derives: an answered request that never started fails; a started one whose dispatch ended finishes.
  - Checks (foreground): `pnpm exec vitest run --config config/vitest.config.ts` over the new and touched suites (delegated-session 10 files / 144 tests, store, host-owned card and prompt, delegate-request, CLI, session-caller, shared journal) → all pass; `pnpm run tc:node`, `tc:cli`, `tc:web` and `mobile` `tsc --noEmit` → no errors; `oxlint` and `oxfmt --check` on the changed files → clean; `pnpm run verify:rpc-params-catalog`, `verify:bundled-skill-guides`, `verify:skill-bundle-manifest` → pass; `ORCA_CODE_QUALITY_BASE=a98852c2a16 pnpm run check:code-quality:changed` → 0 findings in 70 files.
  - Known failures, not caused by this work: `EBUSY` unlinking SQLite journals in temp dirs on Windows in the rig-based suites (every non-EBUSY failure checked); `orchestration-worker-cli` recovery-command tests; `orchestration-gate-cli` and `orchestration.test` recovery-command rendering (same Windows quoting family, CLI files untouched by their assertions).
  - Gaps: no model catalogs beyond the static launch catalog (live per-host catalogs are not read); a started child with no linkable chat session (terminal fallback) fails the request; `outcome_unknown` worker-start receipts are treated as started.
- [x] T5 — Desktop: rich card in `NativeChatQuestionCard`, why-detail, completion notice, sidebar nesting; tests. Route: delegated direct.
  - Files: `src/renderer/src/components/native-chat/NativeChatDelegationCard.tsx` with `native-chat-delegation-card-model.ts` (rows, copy, facts) and tests; `NativeChatDelegationNotice.tsx` with its test; `NativeChatStructuredQuestionCard.tsx` (`delegation` prop, validated by `readDelegationCardPayload`); `NativeChatStructuredSession.tsx` (one prop); `NativeChatNoticeRow.tsx` (+ test); `src/renderer/src/components/ui/radio-group.tsx` (new shadcn wrapper over `radix-ui/radio-group`, since none existed); `src/renderer/src/lib/structured-agent-session-tab-activation.ts` (`findStructuredAgentSessionWorktreeId`); `src/shared/native-chat-types.ts` and `src/shared/structured-agent-session-status-block.ts` (the notice payload passes through the block, validated; + test).
  - Commits: `4a99f8aee9f` (agent choice card and why detail; 1,011 authored lines, above the ~800 aim: the card, model and wiring are one contract and each part ships its tests); `13695567c81` (started, failed and finished notices, Open child chat; 388 lines). Sidebar nesting needed no commit (see decisions).
  - Decisions (board details):
    - Not drawn, because the wire has no data for them: "Run in a new child worktree instead" (the answer carries only the option id; placement is the host's); "View full result" (the child chat holds the full result, so one "Open child chat" action); "Files read / Files changed / Ran in" on the finished row; "12 min ago" on the started row (the block has no timestamp); "Accept edits, from parent" (the payload has no parent access mode); "5h 18%" (the payload carries only the binding percent and window); the "Jev not set up" tag (rules are the only decision source in v1); the agent name on the finished row (its payload has none, so the meta reads "12 min · succeeded").
    - Automatic's row says "Picks Codex" where the board says "Recommended", because nothing in the payload says the pick is recommended. Its detail says "Chooses by usage", not "Lowest usage first", because a parent-agent tie can pick an agent above the lowest usage.
    - Agent marks use `AgentIcon` (Sparkles for Automatic). The board's letters were hand-picked; deriving them from labels would collide (Claude and Codex both start with C).
    - The amber bar at 70% or more is not reproduced: `main.css` defines no warning token. Bars use `bg-primary`, as the Codex usage card does; reached and near limits show in destructive text.
    - Cancel is a ghost button (the style guide keeps back-out actions quiet); Start child session is the default button. No agent is preselected when there is no decision, so the person must pick.
    - The failed status reads "did not start", because T4 writes it only when a request never started.
    - Open child chat searches every worktree, since a new-child placement lives in another worktree; it is hidden when no tab lists the child.
    - Sidebar nesting (item 3): no code. The sidebar already draws children under their parent (`WorktreeCardAgents` with `buildAgentRowLineageTree`, children expanded by default), and the T3 projection test asserts the structured parent link (`parentPaneKey` is the coordinator row).
  - Gaps: the board's pending "Child · choosing agent" row needs a row source for a pending delegation request (a new status producer), so it is a follow-up. The "N child sessions" header count is outside item 3's sidebar scope and is not built. No visual check: no Electron harness with a seeded delegation question was feasible in this pass, and the `$electron` skill is not in this session.
  - Checks: `pnpm exec vitest run --config config/vitest.config.ts` over the card, model, notice, notice-row, structured question card and status-block tests → 4 files, 45 passed (the card tests alone passed 22 before the notices). The wider run (renderer `native-chat` folder, `lib/structured-agent-session`, shared `structured-agent-session`, `native-chat`, `delegated-session`, and the host-owned card test) → 541 files, 5,749 tests, all passed. `pnpm tc:web`, `pnpm tc:node` and mobile `pnpm run typecheck` → exit 0. `oxlint`, `oxfmt --check` and the design-system config on the changed files → clean on the changed lines (the design-system config also reports existing `Card` restyles on untouched lines of `NativeChatNoticeRow.tsx`). `ORCA_CODE_QUALITY_BASE=88deeaefbc1 pnpm run check:code-quality:changed` → 0 new findings across 16 changed files. Known failures from the Windows list did not occur in these suites. Not run: `pnpm lint` (slow; the changed-lines gate is the enforced part) and any rendered-UI check.
- [x] T6 — Mobile: rich card, why sheet, completion notice, nesting; tests. Route: delegated direct.
  - Files: `mobile/src/session/mobile-delegation-card-model.ts` (copy and rows, pure), `MobileNativeChatDelegationCard.tsx`, `MobileNativeChatDelegationWhySheet.tsx`, `mobile-structured-agent-prompts.ts` (`projectDelegationQuestion`), `mobile-structured-prompt-token.ts` (the answer-token codec, moved out of the prompts file to stay under max-lines), `MobileNativeChatPromptCard.tsx`, `mobile-delegation-notice-words.ts`, `MobileNativeChatDelegationNotice.tsx`, `mobile-delegated-child-access.ts` (context), `MobileNativeChatMessage.tsx`, `MobileSessionActiveContent.tsx`, `mobile/src/test-support/rendered-texts.ts`, each with its test; the nesting test is in `mobile/src/components/WorktreeAgentList.test.tsx`.
  - Commits: `ca4d7c44399` (choice card, why sheet, answer projection; 1,643 authored lines, 568 tests, of which about 190 are the moved codec); `cd4de5aca76` (start, failed and finish notices, Open child chat; 565 lines); `ceda954fc9a` (nesting test; no production change); the docs commit below.
  - Wire: no new field or RPC. The card is the question item's `delegation`. Each option answers through the existing structured path (`structuredQuestionResponseTarget`) with its option token, so the host gets the same `optionIds` desktop sends. Notices read the status block's `delegation`; a missing or invalid payload draws the plain line.
  - Nesting: `WorktreeAgentList` already nests rows by `parentPaneKey`, and the T3 projection sets it to the coordinator's row key. The new test feeds it the runtime's structured pane keys and checks the child draws one level in. Nothing to fill.
  - Decisions (board details, aligned with T5):
    - Automatic reads "Picks Codex" with "Chooses by usage, then model and effort by task" (T5 wording), not the board's "Recommended" or "Lowest usage first".
    - Not drawn, because the wire has no data for them: "Accept edits, from parent"; "Decided by: Host rules" (rules are the only source in v1); "5h 18%" (the payload has the binding percent and window only, so a ranking row reads "5h window" or "weekly window"); "View result" (one "Open child chat" action); "Files read / changed" and "N files changed"; "12 min ago" on the started line; the agent name on the finished meta, which reads "12 min · succeeded".
    - Not drawn, as on desktop: the "N children" header count and the "Connected on this computer" label.
    - Option rows carry no agent marks. The board draws none, and the agent-icon module would otherwise join the prompt card's import graph.
    - Bars use the accent token; the amber threshold at 70% is not reproduced, as T5.
    - The why sheet keeps the desktop reason lines (lowest usage, tie, risk floor, model, placement) under its sections, and states the 90% skip rule the router applies (`USAGE_LIMIT_PERCENT`).
    - The sheet loads on its first open (`React.lazy`), so the prompt card's import graph does not pull in the bottom drawer.
    - A manual pick shows no footer, as the board does, so the placement reason appears only for Automatic.
    - Notices use the desktop wording. "Open child chat" appears only while this worktree's tab list holds the child's chat tab, and it switches to that tab through the existing tab switch.
  - Gaps (both closed in the follow-up below, except what it lists):
    - New-child placement: the child lives in another worktree, and the session screen holds no worktree list, so no Open control is drawn there. Closed: see the follow-up.
    - Sessions sheet nesting (MobileSessions board): not built as first written. Closed for tabs in this worktree, see the follow-up. `MobileSessionsSheet` lists tabs, and tabs carry no parent link; the link lives on worktree agent rows that the session screen does not hold. The board's Sessions and Terminals sections and its "1 child finished" line are a redesign of that sheet, a follow-up.
    - The "Child · choosing agent" pending row: not built (needs a pending-delegation row source, as T5).
    - Visual check: not done. No Expo simulator or device harness ran in this pass.
  - Checks (foreground unless noted):
    - `pnpm exec vitest run` over the 22 suites the rendering touches (card, model, notices, access, projection, prompt card, chat view, message, frame layout, parity hooks, sessions sheet, worktree list and row): 22 files, 168 tests passed.
    - `pnpm run typecheck` (mobile): exit 0. `oxfmt --check` and `oxlint` on the 20 changed files: clean.
    - `pnpm run typecheck:tests`: my new test files are clean. The ratchet (`check:tests-typecheck`) fails on six untouched test files (MobileArtifactHtmlPage, MobileArtifactPagePreview, MobileChatFloatingChrome, MobileChatStatusPillView, MobileSessionSwitcherChip, mobile-native-chat-option-listing). The same errors appear with HEAD's tracked sources, so they predate T6.
    - Full mobile suite, final run after the last fix: 18 files failed (1,012 passed); 179 tests failed, 10,737 passed. The same run before the fixes had 24 failing files, including this pass's regressions, now gone.
      - Reproduced with HEAD's versions of the tracked files I changed: six files (mock-server-key-pair, bridge-terminal-output-backlog, use-mobile-commit-failure-recovery, mobile-native-chat-merged-snapshot-parity, use-mobile-diff-review-send-actions, use-mobile-pr-ai-triage; 18 failed tests in that run) and nine files (rpc-recording x5, tasks agent-launch x2, native-document-bundle x2; 162 failed tests; family-recordings shows 56 failure lines here and 60 at HEAD).
      - `mobile-prompt-controller.test.ts` fails at module load on a reanimated TurboModule mock with HEAD's versions too.
      - `write-queue.test.ts` and `push-original-delivery-retirement.test.ts` pass when run alone; their failure was a timeout under full-suite load.
    - `pnpm tc:web`: not run; no shared code changed.
  - Runtime harness: N/A for the pure model; the component tests render through react-test-renderer, not a device.
  - Follow-up (gaps 1 and 2):
    - Commits: `b593ec9be9f` (open a child in another worktree: host rows, locator, access, notice refresh; 10 files) and `34e2d30d71b` (sessions sheet nesting; 6 files), then the docs commit that records this follow-up.
    - Open child in another worktree: `locateStructuredChild` finds the host's `worktree.ps` agent pane whose tab part is `structured-agent-session-<childSessionId>`, the tab id the structured host mints into the pane key. The control opens through `useOpenMobileSession`, which builds `mobileSessionRouteTarget({ hostId, worktreeId, paneKey })`, the route a notification tap takes. It shows only when a tab here or a pane the host lists resolves. An old host with no `agents` field gives no target, so no control.
    - Rows: read when the session mounts, when the sessions sheet opens, and once per finished notice whose child this chat does not hold. A read in flight is not repeated, and nothing polls. No new wire field.
    - Nesting: a child tab sits one level under its parent. A tab joins its agent panes by the tab part of the pane key: a chat by its structured tab id, a terminal by its parent tab id, matched whole on the leaf so a split terminal's sibling leaf is not taken. A child whose parent is itself a child stays flat, and so does a child whose parent is not in the list. No lineage data gives the flat list.
    - Board values not reproduced: the child indent is `spacing.xl + spacing.xs` (28 px, the board says 30) and the child rule is `colors.borderSubtle` (the board's `#404040` is not a token).
    - Decision, not built: the board's "Prototype design tokens · child worktree · working" row. The sheet lists this worktree's tabs only, so a child in another worktree has no row here. Listing it needs a cross-worktree row source, which is a redesign of the sheet, so it is a follow-up with the pending-delegation row.
    - Decision, not built: the Sessions and Terminals split, the Terminals section and the "1 child finished" subtitle. The brief limits this pass to nesting, so they are the sheet redesign, a follow-up.
    - Risk: the child join assumes the structured pane key keeps `structured-agent-session-<sessionId>` as its tab part (`mintStructuredWorkerPaneKey`). A change there hides the control and flattens the sheet with no error. The locator test pins the prefix.
    - Left open: no direct test of `useWorktreeAgentRows` (its read is the existing `worktreeCatalogRead`, tested by the environment read suites, and its pure parts are tested here); no rendered check on a device.
    - Checks: `pnpm exec vitest run src/session src/components src/worktree src/home` → 431 files, 426 passed, 5 failed (11 tests). The five are on the known-failure list: `mobile-native-chat-merged-snapshot-parity`, `use-mobile-diff-review-send-actions`, `use-mobile-pr-ai-triage`, `native-document-bundle`, and `mobile-prompt-controller` (module load). The targeted suites (lineage, sheet, access, notice, rows) → 5 files, 31 passed. `pnpm run typecheck` → exit 0. `oxlint` → exit 0 and `oxfmt --check` clean on the 16 changed files.

- [ ] T7 — Child sessions in the parent chat and the background popover, desktop and mobile (approved Design board "Desktop running child", 2026-10-29). Route: delegated direct (writer trigger). Desktop done; mobile done (see below).
  - Approved design: a started child is a live row in the parent chat ("Child session working: <title>", agent · model · effort (Automatic) · started N ago, Open child chat). The background popover lists children in a "Child sessions" section with live status and an Open button per row.
  - Adjustments (binding, 2026-10-29): A. Finished children stay in the background popover under its Finished section, with the same history rule as tasks and subagents, each with Open. B. Desktop: children appear in the existing background-tasks popover; each child row has Open where a task row has Stop.
  - Desktop, checked:
    - [x] Live started row with Open child chat, shown while the journal shows the child working: `ddde26552ba`. Shared derivation: `c86d066ef57`.
    - [x] Child sessions in the background popover (`NativeChatCodexBackgroundPanel`): running rows, a Finished group, Open per row: `83776081a07`. About 775 authored lines across the three commits (724 additions, 51 deletions, tests included).
  - Mobile, done (writer, 2026-10-29):
    - [x] Live started row with Open child chat (44pt), shown while the chat's journal shows the child working: `dc6ff8c4fc6`. The derivation (`delegatedChildrenFromJournal` over `nativeChatTurnJournal.items`) is provided by `MobileNativeChatOverlay` through `MobileDelegatedChildrenContext` (`mobile-delegated-child-rows.ts`).
    - [x] Child sessions in the background work sheet: running rows under "Child sessions", settled rows under Finished, each row opening its child: `1f094b93848`.
  - Mobile decisions:
    - Open goes through the existing `MobileDelegatedChildAccess` (a tab here, or the host's pane elsewhere through `useOpenMobileSession`), so the T6 cross-worktree path is reused. A row or Open button draws only where `hasChild` resolves.
    - The child row (`MobileBackgroundChildRow.tsx`) shares the sheet's section label and Finished toggle. The whole row is the Open control with a chevron, as the board shows. No Stop.
    - Elapsed reads the host clock (`now - hostClockOffsetMs`) in both the live row, refreshed each minute, and the sheet row. The sheet row reads agent · status · clock; the live row reads agent · model · effort · clock.
    - Settled children sort newest started first, bounded by `MAX_FINISHED_BACKGROUND_ROWS` (30), in the Finished group with children before tasks. A child that never started reads "did not start", with no Open, as on desktop.
    - The pill counts running children as agents and stays up while one runs. A lost stream counts none, as it does for tasks.
    - Opening a child closes the sheet first.
    - "Child sessions" sits above Tasks, as the board places it. The existing Tasks and Agents headings are kept.
    - Test-only: `MobileAgentIcon` is mocked in the four suites that load the sheet or tray without it, because `react-native-svg` fails to parse under vitest here (`SyntaxError: Unexpected token 'typeof'`).
  - Mobile gaps:
    - Children are read from the journal, not the live stream. After a lost stream the sheet still shows each child's last journal status. An `unverifiable` verdict for children is a follow-up.
    - Not drawn: the board's "N child sessions" count, the pending "choosing agent" row (needs the pending-request source from T5), and usage figures on rows.
  - Mobile checks (2026-10-29, foreground):
    - `pnpm exec vitest run src/session` in mobile: 310 files, 305 passed, 5 failed. The 5 are the known-failing list (merged-snapshot-parity and its hooks, mobile-prompt-controller, use-mobile-diff-review-send-actions, use-mobile-pr-ai-triage); 2867 tests passed, 9 failed, all inside those five.
    - Touched suites (child rows, notice, sheet, tray, tray children, bridge sheet, composer tray, notice words, access): 9 files, 74 passed.
    - `pnpm run typecheck` in mobile: exit 0. `oxlint` on the changed files: exit 0. `oxfmt --check`: clean.
    - `pnpm run build:mobile-web` from the repo root: exit 0, 169 assets, 8320792 bytes, reproducible buildId `a8d685794661df3ac2dea5472613d316178711bd98500363c3aaff715d74a1ab`.
    - Shortstat: `dc6ff8c4fc6` 6 files, 396 insertions and 89 deletions (most of it the overlay re-indent); `1f094b93848` 9 files, 447 insertions and 10 deletions.
  - Shared helper API (`src/shared/delegated-children.ts`, no wire change):
    - `delegatedChildrenFromJournal(items: readonly DelegatedChildJournalItem[]): DelegatedChild[]`, where `DelegatedChildJournalItem = { body: AgentJournalItemBody; observedAt: number }`; a journal render item satisfies it.
    - `DelegatedChild`: `requestId`, `title`, `status` (`working` | `succeeded` | `failed` | `not-started`), `agent`, `model`, `effort`, `automatic`, `childSessionId`, `startedAt` (the start row's `observedAt`), `resultSummary`, `durationMs`, `reason`. One row per request, in first-appearance order. Rows without a delegation payload are ignored.
  - Decisions:
    - Live state comes from the parent journal, not the status store: `working` is a start notice with no finish or failed notice after it. The child's own status row is not read (the brief's fallback).
    - The popover is `NativeChatCodexBackgroundPanel`, the "Background activity" aside under the session summary, which already has Finished groups and Stop buttons. The strip above the composer (`NativeChatBackgroundTasksStatus`) is unchanged.
    - The live row reads the derivation through a React context (`DelegatedChildrenProvider`), mounted by `NativeChatMessageListWithDelegatedChildren`. Mounting it in `NativeChatStructuredSession.tsx` pushed that file past the 400-line `max-lines` limit, so the wrapper is its own file.
    - "started N ago" uses the start row's `observedAt`, refreshed each minute. No timestamp was added to the wire.
    - Children stay out of the subagent (Agents) list; they belong to the background section.
    - A popover row shows agent · status · elapsed, without the model (the started row keeps it). The board's model in the popover row is not drawn.
    - The section heading "Child sessions" and the "N finished" group use the popover's existing heading and group styles; the board's uppercase label is not reproduced.
    - A child that never started reads "did not start", with no Open. A finished child keeps the plain started line in the chat (its finished row carries Open).
    - Open uses `activateStructuredAgentSessionById` and shows only when a tab lists the child, in any worktree.
  - Not drawn: the "N child sessions" header count; the pending "Child · choosing agent" row (needs a pending-request row source, as T5); usage figures on rows ("5h 18%", no data on the row); the "Subagents and tasks" heading (the popover keeps its own headings).
  - Gaps:
    - The collapsed summary line (`backgroundCompact`) counts only running tasks, so it can read "No running background tasks" while a child works. Follow-up.
    - The popover draws only when the host publishes child views or a roster; otherwise the existing "unknown" line shows and children are hidden with it.
    - No visual check: no Electron or CDP run in this pass.
  - Checks (foreground, 2026-10-29):
    - `pnpm exec vitest run --config config/vitest.config.ts src/shared/delegated-children.test.ts src/renderer/src/components/native-chat/NativeChatDelegationNotice.test.tsx src/renderer/src/components/native-chat/NativeChatStructuredSession.test.tsx` → 3 files, 46 passed.
    - Same runner, `NativeChatCodexBackgroundPanel.test.tsx` and the notice test → 2 files, 39 passed (3 new popover tests).
    - Same runner, mounting suites `NativeChatSessionSummary`, `NativeChatBackgroundTasksStatus`, `NativeChatFinishedBackgroundGroup`, `NativeChatStructuredSession` → 4 files, 74 passed.
    - Same runner, targeted native-chat set (`NativeChatBackground`, `NativeChatDelegat`, `NativeChatStructuredSession`, `NativeChatSessionSummary`, `NativeChatMessageList`, `NativeChatNotice`, `NativeChatFinished`, `NativeChatCodexBackground`) plus `src/shared/delegated-children` → 50 files, 453 passed. A run of the whole native-chat folder did not finish within the tool time limit and is not claimed.
    - `pnpm run tc:web` → exit 0.
    - `pnpm run tc:node` → exit 1. The only error is `src/main/runtime/structured-session-lineage.ts(50,9)`: TS2304 `Cannot find name 'DelegatedChildLinkRow'`. That file is not in this work. The worktree holds about 16 uncommitted modified files under `src/main/` from another writer, and the error comes from their in-progress state. No error is in a file this task touched.
    - `pnpm exec oxlint` on the changed files → exit 0. `pnpm exec oxfmt --check` → clean.
    - `ORCA_CODE_QUALITY_BASE=0e0bce31b92 pnpm run check:code-quality:changed` → 0 new findings across 30 changed files.
    - `pnpm run build:mobile-web`: not run. Mobile does not import the new shared module yet.
  - Rollback: revert `ddde26552ba`, `83776081a07` and `c86d066ef57`. Nothing on the wire or in mobile changes.

## Acceptance criteria

- The parent agent can request a child; a card lists connected agents plus Automatic with usage %.
- Automatic shows the chosen agent, tier, model, effort, placement and reasons; the choice is deterministic for the same inputs.
- The child appears nested under the parent on desktop and mobile.
- When the child finishes, the parent chat shows a notice with the result and a link to the child.
- Old clients see a plain question with the same options and can still answer.

## Progress

- 2026-10-28: feature doc created after prototype approval.
- 2026-10-28: T1 committed as `0b9424cbc5c` (`feat(delegation): add deterministic delegated-session router`). Authored lines: 1126 (554 production, 572 tests), above the ~400 planning heuristic; not split, because the classifier, ranking, tiers and router form one contract.
- 2026-10-28: T2 implemented on top of `0b9424cbc5c`. Authored lines: 172 (52 production, 120 tests). Running total: 1298 of the forecast 2000–2800. Open decision from T1 (the "release" example) still stands.
- 2026-10-28: "release"/"auth" keywords narrowed (`3601205763e`). RDD on T1–T2 range (base `9f1f4e85f00`): medium, `slice_budget_reached`; consent granted per the user's standing rule; review `review-9ef373fa09df660c` (one reliability lens) unavailable: the Claude reviewer subprocess failed twice with "OAuth session expired and could not be refreshed". Not abandoned (requires maintainer authorization); left open. Retry after `claude` re-login.

- 2026-10-28: T3 worker-start on any agent committed as `f7142b326462f7211975b79ce3bf85f27c45ff0c`. Authored lines 706 (317 production, 389 tests), above the ~400 planning heuristic; not split, because the params, mode, access, topology and CLI form one contract.
- 2026-10-28: T3 nesting committed in the next commit, which records `f7142b32646`. Authored lines 170 (46 production, 124 tests). Running total T1–T3: 2174 of the forecast 2000–2800.

- 2026-10-28: R3 review fixes for the router committed as `aa7c2e8735c`: parent tie-break reason, effort dropped without a model, duplicate agent ids, future samples and errored meters as no data, empty-list and blank-summary tests. Checks: `pnpm exec vitest run --config config/vitest.config.ts src/main/delegated-session src/main/runtime/rpc/methods/orchestration/delegation` → 11 files, 166 passed; `pnpm tc:node` → exit 0; `oxlint` on the changed files → exit 0; `oxfmt --check` → clean.
- 2026-10-28: T4 delegation request committed as `c3cb86c638c`, `73071e39c75`, `0fe4795e217` and `09dfea477c5`. Authored lines 4,601 (2,205 production, 2,363 tests, 33 guide text). Running total T1–T4 about 6,775 against the original forecast of 2000–2800 for all six tasks; T5 and T6 (renderer and mobile) are still to come, so the slicing strategy for the PR must be settled before more is committed.
- 2026-10-28: T5 desktop card committed as `4a99f8aee9f` (1,011 authored lines) and the started, failed and finished notices as `13695567c81` (388 lines). Sidebar nesting needed no code. Running total T1–T5 about 8,170 (6,775 through T4 plus 1,399) against the forecast of 2000–2800 for all six tasks; T6 (mobile) is still to come.
- 2026-10-28: T6 mobile committed as `ca4d7c44399` (choice card, why sheet, answer projection; 1,643 authored lines), `cd4de5aca76` (notices and Open child chat; 565) and `ceda954fc9a` (nesting test; 29). Running total T1–T6 about 10,400 against the forecast of 2000–2800 for all six tasks. Above the ~400 heuristic, not split, because each unit is one contract with its tests. No PR opened; the slicing strategy is still the user's to settle.
- 2026-10-29: T6 review follow-ups, ids from the approved reviews of `684c96bc6af..a26600db393` and `a26600db393..de46ad2aac6`. Fixed in `8e286000ca3` (rows): `R3-dropped-refresh`, `R3-rejected-reply-clears-rows`, `R3-untested-glue`. Fixed in `2f8bb60199e` (lineage, card, notice, text helper, tests): `R3-chain-hides-row`, `R3-2`, `R3-notice-marks-before-check`, `R3-5`, `R3-catalog-parse-edges`, `R3-child-row-press`, `R3-tabownspane-branches`. Skipped: `R3-1` (a refused answer leaves the question pending and the card re-enabled, so there is no failure to show), `R3-3` (the status union is exhaustive and React 19 renders nothing for an unknown status, with no crash), `R3-4` (the cancel wrapper forwards the same prompt identity the question card gets), `R3-6` (deterministic test of the open state; no branch is missing).
- 2026-10-29: the web bundle went over its Phase C asset budget after T6 (174 assets against 169). Fixed in `0a84746cf47`: the why sheet is a static import again, which drops its lazy entry and the shared card-model chunk, and the chat view and prompt card suites stub the drawer. The bundle is back to 169 assets, the same as the pre-T6 build measured at `ca4d7c44399^` (118 scripts, 50 other outputs, one document). The budget was not raised.
- 2026-10-29: review status per range. Approved and acknowledged: `c3cb86c638c`; `73071e39c75` after its one correction (`d23f75744d8`); T5 `88deeaefbc1..23ff82ddb17`; T6 `684c96bc6af..a26600db393`; `a26600db393..de46ad2aac6`; `de46ad2aac6..2d7f41d3993`. Not reviewed: `73071e39c75..88deeaefbc1` (`lens_context_budget_exceeded`), and `c48277da118` (one blank line). Abandoned under the user's rule for reviews stuck on a tool problem: `review-27d94397ee220672` (T1–T3, waiting on recovery authorization) and `review-e91f37620f0628d5` (`d23f75744d8..684c96bc6af`, `corrupted_or_unverifiable_authority`).
- 2026-10-29: folder-workspace child brief committed as `f334ccce095` (3 files, 87 insertions, 2 deletions; the folder path comes from the runtime's existing local-path accessor). Mobile triage committed as `cd41eab8616` (4 files; 3 of the 5 findings fixed, 2 kept as follow-ups). The mobile web bundle is at 169 assets, the budget.

- 2026-10-29: T7 desktop committed as `c86d066ef57` (shared child derivation), `ddde26552ba` (live started row) and `83776081a07` (background popover: Child sessions and the Finished group, each row with Open). Mobile is open for the next writer. `tc:node` fails on `src/main/runtime/structured-session-lineage.ts` from another writer's uncommitted work in this worktree, not from T7.
- 2026-10-29: T7 mobile committed as `dc6ff8c4fc6` (live started row) and `1f094b93848` (background sheet child rows). The mobile web bundle is at 169 assets, the budget. Review of these ranges is not yet run.

## Follow-ups

- Automatic may switch to a second account of the same agent (inactive accounts are tracked).
- Optional Jev classification on hosts where it is configured.
- Non-blocking findings from the approved review of `19230c04303..0e8bb2a92f5`, not yet triaged: `R3-folder-glue-untested`, `R3-placement-derived-twice`, `R3-pick-silently-swaps-to-default` (warnings); `R3-missing-folder-reuses-parent-code`, `R3-swap-race-one-order-only` (suggestions).

## Review follow-ups

Non-blocking findings from the approved reviews of `c3cb86c638c` (rc1), `73071e39c75` (rc2) and the T5 renderer range `88deeaefbc1..23ff82ddb17` (rB). The review files carry ids, lenses, locations and severities only, so each finding was re-checked against HEAD.

- Fixed:
  - `R3-claim-before-journal-commit`, `R4-resolver-commits-before-journal-append`: `0beaed24ccf`. An answer or Cancel the journal does not record hands its claim back, so the card can be answered again.
  - `R1-settlement-observer-never-released`, `R3-settlement-observer-never-removed`, `R4-settlement-observer-never-unsubscribed`: `171c7d97da8`. The listener holds its runtime weakly and unsubscribes once the runtime is gone.
  - `R3-access-mode-silent-fallback`: `171c7d97da8`. A parent mode this build does not know refuses the child start instead of sending no mode.
  - `R3-001`, `R3-agent-probe-errors-swallowed`, `R2-worktree-name-constant-misnamed`, `R3-mutation-replay-not-exercised`: `171c7d97da8`. The question is recorded before the card posts, the probe failure is logged, the constant is renamed to `WORKTREE_SLUG_MAX_CHARS`, and the replay test is renamed to what it asserts (the replay itself is not exercised).
  - `R3-duration-wording-branches`: `dd7b04e1f39`. A whole number of hours reads "2 h", not "2 h 0 min".
- Already fixed before this pass:
  - `R3-reconcile-unguarded-rejection`: `d23f75744d8` added the `.catch`.
  - `R3-005`: `0fe4795e217` removed the type assertion on the read-back in `createDelegationRequest`.
- Skipped:
  - `R1-folder-child-shares-worktree`: by design. Folder writes run in the current folder and the card warns (`folder-workspace-writes`).
  - `R1-delegate-caller-named-by-from`: the declared-address contract every `from` method shares. A child starts only after a person picks an option.
  - `R2-launch-failure-reason-misleading`: accurate on every reachable path. A null target means every agent is at a usage limit.
  - `R2-pi-default-hardcoded-exception`: deliberate, documented and tested.
  - `R2-answer-settled-check-asymmetry`: intentional. Cancel accepts only cancelled or failed; an answer repeats its own choice.
  - `R2-cancel-plan-built-twice`: the plan is unused in the host-owned branch; no behavior effect.
  - `R2-global-settlement-observer-registry`, `R2-host-owned-answer-refusal-conflated`, `R2-hostownedanswer-alias`, `R2-two-host-owned-predicates`: readability only. Wire reason codes stay as they are.
  - `R3-002`: the journal append commits or throws, so a failed post leaves no card.
  - `R3-003`: host-owned cards are left out of the pending-prompt gate by design.
  - `R3-004`: a reset deletes requests by design; an orphaned card is refused as `promptGone`.
  - `R3-006`, `R3-009`: no defect in the current code.
  - `R3-007`: no provider writes a `delegation` field, so body-shape classification is safe.
  - `R3-008`: taste; the expectation mirrors the card's own join.
  - `R3-notice-row-precedence`, `R3-question-card-guard-branches`, `R3-selection-not-rederived`, `R3-session-wiring-unasserted`, `R3-worktree-lookup-contenttype`: notices never carry `presentation`; the fallback submits the same option ids; the card is keyed by item revision; one prop; the same `agent-session` tab kind as its siblings.
- Folder-workspace child writing into the parent's folder at the same time: decided 2026-10-29, warned and briefed, not locked (see Decisions).

Mobile review `de46ad2aac6..2d7f41d3993` (triaged 2026-10-29):

- Fixed in `cd41eab8616`:
  - `R3-card-default-pinned-at-mount`: the default follows the card until the person picks, and a pick never sits on a row the card no longer draws (test: a re-render that drops the Automatic row leaves Start disabled).
  - `R3-notice-refresh-at-most-once-unproved`: test that a re-render with the same missing child asks the host once.
  - `R3-reread-client-swap-untested`: test that the new client's read is used and the old client's in-flight reply is dropped.
- Kept as follow-ups:
  - `R3-one-level-nesting-deeper-chains`: one level is the design (`keeps a grandchild flat` pins it). A grandchild under its root needs a second indent, which is a sheet design call.
  - `R3-drawer-stub-narrows-coverage`: the stub keeps the drawer's native imports out of the prompt-card suite. The delegation card renders outside the drawer and has its own suite, but the why sheet has no suite; adding one is the follow-up.

T7 review follow-ups (2026-10-29, approved reviews of desktop `a473f6929f9..797eb3bddde` and mobile `797eb3bddde..451d28ff4f7`):

- Fixed in `8e3e161de4f` (desktop, 8 files, +344 / -72):
  - `R3-not-started-counted-as-finished`: a request that never started is not listed in the popover.
  - `R3-child-timer-ignores-visibility`: the panel owns the child clock and ticks it only while the popover is visible.
  - `R3-duplicate-finished-group-name`: finished children share the one Finished group with finished commands.
  - `R3-copy-branches-uncovered`: test of every status wording in `delegated-child-copy.ts`.
  - `R3-live-clock-minute-boundary`: the live-row test runs on a fixed clock.
  - `R3-provider-wiring-unproved`: test that the message list receives the children its journal shows.
  - Bug: the collapsed "Background tasks" line in the chat summary counts running child sessions, in the same "N running" form.
- Fixed in `595e0b49852` (mobile, 5 files, +104 / -13):
  - `R3-pill-sheet-liveness-divergence`: the sheet lists no running child once the stream is lost, as the pill already counts none.
  - `R3-finished-bound-doubled`: Finished holds 30 rows in all; children take their share first and task rows fill the rest.
  - `R3-host-clock-offset-unproved`: test that the live row reads elapsed time on the host clock.
  - `R3-lost-stream-assertion-weak`: test that a lost stream with a turn running lists no child in the open sheet.
  - `R3-mixed-finished-group-unproved`: test that a settled child and a settled task share one Finished group.
  - Bug: mobile's pill already counts live children as agents, so it needed no change.
- Skipped:
  - `R3-agents-empty-line-suppressed`: unreachable. The summary renders the agents panel only when it holds agent rows, so that section's empty line never shows.
- Decision: children take their share of the Finished bound first, so 30 finished children hide finished tasks in the sheet. Revisit if that trade is wrong.
- Open, not fixed: the mobile sheet's child clock does not tick while only a child runs. `useNow` in `MobileNativeChatBackgroundTasks.tsx` is enabled only by a working turn or live task rows, so the elapsed time freezes while the sheet is open.
- Checks: desktop `src/renderer/src/components/native-chat` 412 files, 4179 tests passed; mobile touched suites 5 files, 39 tests passed; `pnpm tc:web` exit 0; mobile `pnpm run typecheck` exit 0; `oxlint` exit 0 and `oxfmt --check` clean on the changed files; `pnpm run build:mobile-web` exit 0 at 169 assets.
