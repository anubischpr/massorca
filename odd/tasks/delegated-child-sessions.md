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
  - Open decision: the example "Explore a new tool release and list features to adopt, read-only" gives tier 4, not 3, because "release" is a high-risk keyword and high risk floors the tier at 4. Without the word it gives tier 3 (tested). The keyword list stays as written until decided (drop or narrow "release", or change the example).
  - Checks: `pnpm exec vitest run --config config/vitest.config.ts src/main/delegated-session` → 4 files, 78 passed. `pnpm exec oxlint` on the new files → exit 0. `oxfmt --check` → clean. `pnpm tc:node` → exit 0. `ORCA_CODE_QUALITY_BASE=HEAD pnpm run check:code-quality:changed` → 0 findings in 9 files (the default base `origin/main` lists about 2,300 changed files on this long-lived branch and overflows the Windows argv limit).
  - Runtime harness: N/A (pure functions). Rollback: delete `src/main/delegated-session/` and `src/shared/delegated-session-types.ts`.
- [ ] T2 — Usage adapter: TuiAgent → rate-limit provider mapping, snapshot → router usage input, staleness; tests. Route: delegated direct.
- [ ] T3 — Orchestration link: `parentSessionId` on dispatch, structured-coordinator worker_done delivery as a journal notice, projection nesting by session; tests. Route: delegated direct.
- [ ] T4 — Host RPC `agentSession.delegate` + `orca session delegate` CLI; question item with `delegation` extension; answer → router → launch via orchestration with inherited access; capability; tests. Route: delegated direct.
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
- 2026-10-28: T1 committed as `feat(delegation): add deterministic delegated-session router` (SHA recorded in the T2 progress line). Authored lines: 1126 (554 production, 572 tests), above the ~400 planning heuristic; not split, because the classifier, ranking, tiers and router form one contract.

## Follow-ups

- Automatic may switch to a second account of the same agent (inactive accounts are tracked).
- Optional Jev classification on hosts where it is configured.
