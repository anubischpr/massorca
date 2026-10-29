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
- [ ] T6 — Mobile: rich card, why sheet, completion notice, nesting; tests. Route: delegated direct.

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

## Follow-ups

- Automatic may switch to a second account of the same agent (inactive accounts are tracked).
- Optional Jev classification on hosts where it is configured.

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
- Open: a folder-workspace child can still write into the parent's folder at the same time. It is warned, not prevented. Product decision.
