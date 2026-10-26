# Project GitHub account display

## Objective
Show the project's bound GitHub account (`Repo.ghAccount`, the per-project gh wrapper binding — not the globally active gh account) in the sidebar project header and in the ChatUI "Chat summary" Environment card.

## Scope
- Sidebar project header (`SectionHeader.tsx`): bound account login beside the project name.
- Environment card (`NativeChatSessionEnvironment.tsx`): new "GitHub account" field; collapsed preview shows account, owner/repo, branch (folder for folder workspaces), worktree.
- Base branch: `custom/integration` (the ChatUI summary cards do not exist on `main`).

## Constraints
- Design system per `docs/STYLEGUIDE.md`; chat type scale rules in `components/native-chat/`.
- Folder workspaces and remote (SSH) hosts: account comes from the repo record, no new IPC.
- No account bound → explicit "No account bound" text, never the globally active account.

## Tasks
- [x] T1 Shared `ghAccountBindingLabel` helper (+ test) — route: delegated writer (backstop)
- [x] T2 Sidebar header shows bound account — route: delegated writer
- [x] T3 Environment card field + collapsed preview (en/es strings) — route: delegated writer
- [x] T4 Checks: `pnpm tc:web`, focused tests, `pnpm run check:code-quality:changed`

## TDD
Mode: off (no project/session configuration enabling it). Ordinary functional checks apply. Runner: vitest via `pnpm test`.

## Progress
- Exploration done; branch reset onto `origin/custom/integration` (no prior commits).

## Next step
Visual check in the app; PR targets `custom/integration`.

## Verification evidence
- `pnpm tc:web`: pass.
- vitest (account-binding, NativeChatSessionSummary, runtime-required-catalog, native-chat-locales): 73 passed; orchestrator spot check 23/23.
- `check:code-quality:changed` with base `origin/custom/integration`: 0 new findings (default `origin/main` base fails with ENAMETOOLONG, ~1700 changed files).
- `oxlint`, `oxfmt --check`: pass.
- `pnpm test` wrapper: blocked locally by node-gyp MSVC C1083 in `ensure-native-runtime` (unrelated).
- Not verified: visual check in the running app.
