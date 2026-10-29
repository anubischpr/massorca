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

- Usage window: the tightest of 5h and weekly (`max(usedPercent)`); agents at ≥ 90% or limit-reached are skipped; no data or stale (> 15 min) counts as 60% and is labelled.
- Tie within 5 points: prefer the parent's agent, then a fixed order.
- Placement: `current` worktree for read-only tasks; `new-child` worktree when the task writes code.
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
  - Sample: 5-hour and weekly used percent; `limitReached` when a window reaches 100%; `fetchedAt` is the provider's `updatedAt`, so the router's 15-minute staleness applies. Top-level entries are the active account only.
  - Checks: `pnpm exec vitest run --config config/vitest.config.ts src/main/delegated-session` → 5 files, 85 passed. `pnpm exec oxlint` on the new files → exit 0. `oxfmt --check` → clean. `pnpm tc:node` → exit 0. `ORCA_CODE_QUALITY_BASE=HEAD pnpm run check:code-quality:changed` → 0 findings in 2 files.
  - Runtime harness: N/A (pure function). Rollback: delete `src/main/delegated-session/delegation-usage-input.ts` and its test.
- [ ] T3 — Structured workers on any agent: `WorkerStartParams` gains optional `preferredMode` and `accessMode`; worker-start honors `sessionOptions` (model, effort, access) and accepts every registered structured agent, not only claude/codex; capability in `src/shared/orchestration-runtime-capabilities.ts`. Agent-row projection carries the structured coordinator as parent (session-keyed via `structuredAgentSessionPaneKey`), so structured workers nest under a structured parent. Tests. Route: delegated direct. (Coordinator = structured session and mail to it already work: `run-coordinator-orca-session.ts`, `structured-mailbox-pointer-host.ts`.)
- [ ] T4 — Delegation request: `orca orchestration delegate --summary --prompt [--writes]` CLI + host RPC; creates/reuses a Run coordinated by the caller's structured session; appends a host-owned question item with a `delegation` extension (options = eligible agents + Automatic, router decision, usage) to the parent journal, durable across restart; `respondToQuestion` branch resolves it → worker-start with the choice and the parent's access mode → "started" notice; worker_done → "finished" notice item with `tasks.result` and the child session id; capability. Tests. Route: delegated direct.
- [ ] T5 — Desktop: rich card in `NativeChatQuestionCard`, why-detail, completion notice, sidebar nesting; tests. Route: delegated direct.
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

## Follow-ups

- Automatic may switch to a second account of the same agent (inactive accounts are tracked).
- Optional Jev classification on hosts where it is configured.
