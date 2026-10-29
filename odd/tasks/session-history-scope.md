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

- Strict fidelity to the approved prototype v2 https://claude.ai/artifact/HG9wxWZMaeMhaw3uHbdsaa (approved by the user 2026-10-29: "Aprobadísimo"). No labels or components outside the prototype.
- Remote wire compatibility: older hosts omit `subagent`; no new required fields.
- SSH hosts and folder workspaces; cross-platform paths.
- Design system: `docs/STYLEGUIDE.md`.
- Code term "delegated session"; "child session" only in UI copy ("child"/"subagent" already mean provider subagents in code).

## Configuration

- TDD: off (source: no project/session TDD configuration found). Ordinary functional checks apply.
- Runner: `pnpm exec vitest run --config config/vitest.config.ts <files>`; typecheck `pnpm tc`; lint `pnpm run check:code-quality:changed` (use `ORCA_CODE_QUALITY_BASE=HEAD~1` on this long-lived branch).
- Delivery strategy: `ask-on-risk`. Forecast ~600–900 authored lines across 4 work units. No push, no PR.

## Tasks

- [x] T1 — Scanner leak repro (read-only scan of the user's transcripts). Result: no provider subagent leaks; the flood is headless automated runs. No scanner change. Route: delegated direct.
- [x] T2 — "This worktree" scope ("This folder" for folder workspaces): exact match excluding nested live worktrees; desktop + mobile labels. Route: delegated direct (writer trigger).
- [x] T3 — Automated runs hidden by default: shared detection (Codex `source: 'exec'`, prompt starts "You are a code reviewer" → Review, "You are the sdd-… subagent" → SDD); "Automated runs" switch with the in-scope count on desktop and mobile; Review/SDD badge on shown rows. Route: delegated direct.
- [ ] T4 — Delegated child sessions nested under their parent with a "Child session" badge and status (working/finished/failed); top-level row when the parent is out of scope. Route: delegated direct.
- Dropped by the approved design: a subagent toggle for every agent (no subagent leak found; "N subagents" stays as today).

## Progress

- 2026-10-29: exploration done; prototype published and sent to the parent session. Real-data check: 178 recent Codex subagent rollouts, none tagged `thread_source: 'user'`; no top-level Claude `agent-*.jsonl`. Leak source not yet reproduced.

- 2026-10-29 T1 repro (read-only `scanAiVaultSessions({unlimited:true})` on the user's home, temporary test deleted): 1371 rows (codex 241, claude 611, antigravity 269, gemini 248, copilot 2). None is a provider subagent: no `subagents/` or `agent-*.jsonl` paths, no Claude `isSidechain`/`agentId`, no Codex parent thread or agent role. `~/.omp` absent, so OMP and SSH unchecked. No scanner change made.
  - What does flood the list: headless review runs titled "You are a code reviewer…": Claude 473, Codex 224 (all the `codex_exec` rows: `source: 'exec'`, `thread_source: 'user'`, deliberately user per `session-scanner-codex-non-user-origin.test.ts:145`), Gemini 149. Claude/Gemini ones carry no structural marker found (Claude `isSidechain: false`, Gemini `kind: main`). Antigravity: ≥41 rows titled "You are the `sdd-apply` subagent…".
  - Search hits hard-code `subagent: null` (`ai-vault-search-session.ts:32`), belongs to T3.
- 2026-10-29 T2 done: "This worktree" / "This folder" labels on desktop and mobile; `en.json` is the English source. Exact match via `excludedWorktreePaths` in the shared filter core, derived on desktop and mobile from live, non-archived worktrees nested under the active one (Project keeps them). Checks: desktop vitest 10 files / 140 tests; mobile agent-history 14 files / 117 tests; `typecheck:web`, `typecheck:node`, `typecheck:cli`, mobile `typecheck` pass; oxlint and `check:code-quality:changed` (base HEAD) 0 new findings. Not caused by T2: mobile `typecheck:tests` ratchet flags 10 untouched files and fails identically at HEAD. Non-English catalogs still show the old "Workspace" translation (translator follow-up). Work unit: `feat(session-history): scope This worktree to the active worktree only`.
- 2026-10-29 T3 done: shared `ai-vault-automated-run.ts` (prefix detection on title, then opening prompt; Codex `exec` flag as optional `headlessRun`); "Automated runs" switch with in-scope count below the scope toggle on desktop and mobile, persisted on desktop, in-screen state on mobile; Review/SDD badge leads the metadata line. Parse-cache schema bumped 4 → 5 so cached Codex rows carry the flag: the first launch after update re-scans transcripts once. Search hits carry no `headlessRun`, so prompt-less `codex exec` rows still show in search. Checks: vitest on 314 renderer/shared/main files and 12 mobile agent-history files pass; `typecheck:node`, `typecheck:web`, `typecheck:cli`, mobile `typecheck` pass; `check:code-quality:changed` (base HEAD) 0 new findings; oxlint clean. Not caused by T3: ai-vault main suite has 32 Windows-only failures (path quoting, EBUSY, SQLite width); mobile `typecheck:tests` ratchet flags the same 10 files as T2. Work unit: `feat(session-history): hide automated runs behind an Automated runs switch`.

## Next step

T4, one work-unit commit.
