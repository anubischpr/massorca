# Session history: main sessions only, and a This worktree scope

## Objective

Session History (desktop right sidebar and mobile agent history) shows only the sessions the user started. Agent subagents (Claude Task/Agent, Codex, OMP subagents) are reachable only from their parent. MassOrca delegated child sessions nest under their parent. The Workspace scope becomes "This worktree" and matches only the active worktree.

## Problem

- Subagent sessions appear as top-level rows. `AiVaultSession.subagent !== null` marks a subagent, but nothing downstream of the scanners checks it, and some scanner path emits subagent transcripts with `subagent: null`.
- The Workspace scope matches the active worktree path inside-or-equal (`createAiVaultWorkspaceMatcher`, `src/shared/ai-vault-session-filters.ts`), so on a main checkout it also lists every nested `.claude/worktrees/*` session. There is no way to see only the active worktree's sessions.

## Why

The user works with one parent session per feature worktree; history full of subagent transcripts and nested-worktree sessions hides the sessions they want to resume.

## Scope

- Root-cause fix in the AI vault scanners so subagent transcripts never come back as top-level sessions (local and SSH).
- Renderer and mobile: hide subagent rows from the top level in every scope and in search; "N subagents" toggle for every agent; delegated child sessions nested under the parent.
- Scope rename Workspace → "This worktree" ("This folder" for folder workspaces) with an exact match that excludes paths of other live worktrees nested inside.

## Constraints

- Strict fidelity to the approved prototype https://claude.ai/artifact/HG9wxWZMaeMhaw3uHbdsaa (approval pending as of 2026-10-29; UI tasks wait for it).
- Remote wire compatibility: older hosts omit `subagent`; no new required fields.
- SSH hosts and folder workspaces; cross-platform paths.
- Design system: `docs/STYLEGUIDE.md`.
- Code term "delegated session"; "child session" only in UI copy ("child"/"subagent" already mean provider subagents in code).

## Configuration

- TDD: off (source: no project/session TDD configuration found). Ordinary functional checks apply.
- Runner: `pnpm exec vitest run --config config/vitest.config.ts <files>`; typecheck `pnpm tc`; lint `pnpm run check:code-quality:changed` (use `ORCA_CODE_QUALITY_BASE=HEAD~1` on this long-lived branch).
- Delivery strategy: `ask-on-risk`. Forecast ~600–900 authored lines across 4 work units. No push, no PR.

## Tasks

- [ ] T1 — Find which scanner emits subagent transcripts with `subagent: null` on real data (read-only run over the user's transcripts), fix the root cause, tests. Authorized before design approval as non-UI groundwork. Route: delegated direct (preparation + writer trigger).
- [ ] T2 — "This worktree" scope: exact match excluding nested live worktrees; desktop + mobile labels ("This folder" for folder workspaces). Waits for approval.
- [ ] T3 — Subagent rows never top-level (renderer filter, mobile sections, search hits keep parentage); "N subagents" toggle for every agent on desktop and mobile. Waits for approval.
- [ ] T4 — Delegated child sessions nested under their parent with badge and status, top-level when the parent is out of scope. Depends on `claude/child-sessions-81f6d9` landing. Waits for approval.

## Progress

- 2026-10-29: exploration done; prototype published and sent to the parent session. Real-data check: 178 recent Codex subagent rollouts, none tagged `thread_source: 'user'`; no top-level Claude `agent-*.jsonl`. Leak source not yet reproduced.

- 2026-10-29 T1 repro (read-only `scanAiVaultSessions({unlimited:true})` on the user's home, temporary test deleted): 1371 rows (codex 241, claude 611, antigravity 269, gemini 248, copilot 2). None is a provider subagent: no `subagents/` or `agent-*.jsonl` paths, no Claude `isSidechain`/`agentId`, no Codex parent thread or agent role. `~/.omp` absent, so OMP and SSH unchecked. No scanner change made.
  - What does flood the list: headless review runs titled "You are a code reviewer…": Claude 473, Codex 224 (all the `codex_exec` rows: `source: 'exec'`, `thread_source: 'user'`, deliberately user per `session-scanner-codex-non-user-origin.test.ts:145`), Gemini 149. Claude/Gemini ones carry no structural marker found (Claude `isSidechain: false`, Gemini `kind: main`). Antigravity: ≥41 rows titled "You are the `sdd-apply` subagent…".
  - Search hits hard-code `subagent: null` (`ai-vault-search-session.ts:32`), belongs to T3.

## Next step

Product decision (asked of the parent session): how to treat headless automated runs (review/SDD workers), which are not provider subagents and have no reliable structural marker except Codex `source: 'exec'`. The prototype assumed provider subagents and may need a revision before T2–T4.
