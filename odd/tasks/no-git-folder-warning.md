# No-git folder warning

## Objective

Warn clearly when a folder without Git is added as a project, mark such projects in the desktop sidebar and the mobile host list, and let any client ask the execution host to initialize Git in that folder.

## Problem

A folder project has no worktrees, so delegated child sessions cannot be isolated and would edit the same files as the parent chat. The current "Open as Folder" dialog only says Git features won't be available, and nothing marks the project afterwards.

## Why

The user wants the limitation stated up front, with the recommendation that working without Git is only for exploring folders and non-development work, and a one-click path to a normal Git project from desktop and mobile, local or remote.

## Approved design

Prototype: https://claude.ai/artifact/MXai3HzR88MwEWf7FK2Tfy (4 artboards). Strict fidelity: nothing on screen outside these boards.

1. Desktop add dialog (replaces `NonGitFolderDialog` content): title "This folder isn't a Git repository"; lost-features list; "recommended only for exploring folders and non-development work"; path box + checked-host line; note "Initialize Git runs `git init` here and creates an empty first commit. Your files are not committed."; buttons Cancel / Continue without Git / Initialize Git here (primary).
2. Desktop sidebar: "No Git" pill after the project name; click opens a Popover with the limitations and "Initialize Git".
3. Mobile host list: "No Git" pill in the repo section header.
4. Mobile: tapping the pill opens a bottom sheet with the limitations, the init note, "Initialize Git" and "Close".

## Scope

- Host-side operation: `git init` + empty first commit (identity fallback when none is configured) in the folder project's own path, then the project becomes `kind: 'git'`. Runs on the execution host: local, SSH, and paired runtime host.
- Exposed over RPC to every client (desktop remote and mobile), capability-negotiated: old hosts hide "Initialize Git" instead of failing.
- Desktop dialog, desktop sidebar pill + popover, mobile pill + sheet. i18n in every renderer locale.

## Constraints

- Remote Wire Compatibility: new optional RPC method behind a capability.
- Git Binary Compatibility: Git 2.25 baseline; global `-c` options before the subcommand as the repo does; commit identity fallback.
- SSH use case and folder-workspace use case; cross-platform paths; process spawning through `@orca/process-host`.
- After init the marker disappears on desktop and mobile (the project is a normal Git project).

## Configuration

- TDD: off (source: no project/session TDD configuration found). Ordinary functional checks apply.
- Runner: `pnpm exec vitest run --config config/vitest.config.ts <files>`; mobile tests per `mobile/` config.
- Delivery strategy: `ask-on-risk`. Forecast ~700–900 authored lines across four work units.

## Tasks

- [x] T1 — Host-side Initialize Git operation (local, SSH, runtime RPC method + capability), kind upgrade to git, tests. Route: delegated direct (writer trigger: 2+ non-trivial files). Commit `2cbd68d0f12`.
- [x] T2 — Desktop add dialog per artboard 1, wired to T1. Route: delegated direct. Commit `342451bc0081`.
- [x] T3 — Desktop sidebar "No Git" pill + popover per artboard 2. Route: delegated direct. Commit `b926a138fb7`.
- [ ] T4 — Mobile pill + sheet per artboards 3–4, gated on the capability. Route: delegated direct.

## Acceptance criteria

- Adding a non-git folder shows the new dialog; "Continue without Git" adds a folder project; "Initialize Git here" adds it as a Git project with one empty commit; Cancel adds nothing.
- Folder projects show "No Git" on desktop and mobile; after Initialize Git the marker is gone on both.
- Against an older host without the capability, "Initialize Git" is not shown.

## Progress

- Base: `custom/pv27-unified` @ `70da7fa23f3`.
- T1 done (`2cbd68d0f12`, ~1000 changed lines, mostly tests). Host op `repo.initGit` (params `{ repo }`, result `{ ok: true, repo } | { ok: false, error, message? }`), capability `repo.init-git.v1`. Local and SSH folders both run through the runtime (`initializeGitInFolderRepo`); no separate IPC. Renderer API: `runtimeRepoSupportsGitInit(settings, hostId?)` and `initializeRuntimeRepoGit(settings, repoId, hostId?)` in `src/renderer/src/runtime/runtime-repo-git-init-client.ts`. Relay exec validator now allows the exact fallback-author `-c` commit.
  - Evidence: new tests (init service local+SSH, controller, RPC method, renderer client, relay validator) 159 passed; `pnpm tc` ok; changed-code quality gate (base `HEAD`) 0 findings; `verify:rpc-params-catalog` ok. `folder-repo-git-upgrade*.test.ts` cannot run on this Windows box (symlink EPERM, unrelated to the change).
  - Parent spot check: `runtime-folder-git-initialization.test.ts` + `runtime-repo-git-init-client.test.ts` 18 passed.
  - RDD: assessed high (`process_boundary`), consent granted per standing rule; the bound STATUS hit `operation_timeout`, so lineage `review-cce108eb4951f8d5` was abandoned (stuck-review rule). Unreviewed. Boundary stays `70da7fa23f3`.
- T2 done (`342451bc0081`, 712 authored lines: 613 added, 99 deleted). Desktop dialog per artboard 1: Cancel (outline), Continue without Git (secondary), and Initialize Git here (default). Initialize Git here appears only when `runtimeRepoSupportsGitInit` says yes, and its note goes with it. It adds the folder through the same path as Continue, then calls `initializeRuntimeRepoGit`, upserts the returned Git repo, and refreshes worktrees. On failure the folder project stays and the error goes to a toast; all footer buttons are disabled while it runs.
  - Evidence: `pnpm exec vitest run --config config/vitest.config.ts` on `NonGitFolderDialog.test.tsx` and `NonGitFolderDialog.git-init.test.tsx`: 14 passed, no React warnings. `pnpm tc`: exit 0. `pnpm exec oxlint` on the changed files: exit 0. `oxfmt --check` on the changed TSX and test files: clean. `node config/scripts/check-changed-code-quality.mjs HEAD~1`: 0 new findings. `audit-localization-coverage.mjs --check`: passed. `verify-localization-catalog.mjs`: exit 1 only on native-chat keys this change does not touch (already failing on this base); no `NonGitFolderDialog` key flagged.
  - Runtime harness: N/A. The dialog was not run in the live Electron app; coverage is happy-dom component tests.
  - Off-design gap: `repo.initGit` failures without git's own text show the raw error code in the toast description. No per-code copy was added because it is not on the artboard.
  - Delivery: running authored total is about 1,778 lines (T1 1,066 + T2 712), above the ~400 planning line. Under `ask-on-risk`, the chain strategy (`stacked-to-main` or `feature-branch-chain`) must be asked once before the next commit.
  - Parent spot check: `NonGitFolderDialog.git-init.test.tsx` 8 passed.
  - RDD: assessed high (`process_scan_limit`) against base `67d124b7185` (T1 unreviewed), consent granted per standing rule; bound STATUS hit `operation_timeout`, lineage `review-62fd09ccd7a0b2b0` abandoned. Unreviewed.
  - Delivery: no push or PR in this session (parent instruction); chain strategy asked of the parent session, slice boundaries so far: T1 `2cbd68d0f12`, T2 `342451bc0081`.
- T3 done (`b926a138fb7`, 571 authored lines: 534 added, 37 deleted, including ~60 locale and ~260 test lines). `FolderProjectGitMarker.tsx` renders the "No Git" pill after the project name in `RepoHeaderTitle` for `isFolderRepo` only. The pill is a `quietOutline` Badge variant (new in `components/ui/badge.tsx`) wrapped in a `PopoverTrigger`; its clicks and the popover's events stop at the row (existing header guards). The popover is 320px and shows the artboard copy; "Initialize Git" appears only after `runtimeRepoSupportsGitInit` says yes for the repo's host. The check runs on the first open, cached per host, and never runs for git repos. Init goes through `initializeRuntimeRepoGit`, then `adoptInitializedGitRepo` (new `folder-project-git-init.ts`, also used by T2's dialog, behavior unchanged), then the popover closes. Failures use the T2 toast (`toastGitInitFailure`). Bullet texts reuse T2's `NonGitFolderDialog` keys; new keys are under `auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker` in all six locales.
  - Evidence: `pnpm exec vitest run --config config/vitest.config.ts` on `RepoHeaderTitle.folder-git.test.tsx` (new, 8 tests) plus T2's `NonGitFolderDialog.git-init.test.tsx` and `NonGitFolderDialog.test.tsx`: 22 passed, no React warnings. `pnpm tc`: exit 0. `pnpm exec oxlint` on changed files: exit 0. `oxfmt --check` on changed files: clean. `node config/scripts/check-changed-code-quality.mjs HEAD~1`: gate passed (0 findings) after moving the look into a Badge variant and a plain wrapper div (the first run flagged 8 `no-restyle` findings on Badge and PopoverContent classNames). `audit-localization-coverage.mjs --check`: passed. `verify-localization-extraction.mjs` and `verify-localization-catalog.mjs`: exit 1, listing native-chat and other pre-existing keys; none of the new keys appear in the output (baseline not re-run on HEAD).
  - Runtime harness: N/A. The pill and popover were not checked in the live Electron app; coverage is happy-dom component tests.
  - Off-design: the pill's border and hover use the new `quietOutline` variant, the one primitive change, because no existing Badge variant matches the approved transparent pill. Nothing else was added beyond the artboard copy.
  - Delivery: no push or PR; slice boundaries so far: T1 `2cbd68d0f12`, T2 `342451bc0081`, T3 `b926a138fb7`.
  - Progress: T3 review lineage `review-28306a53133fb8b4` ran four lenses and opened a correction; the follow-up STATUS stopped with `corrupted_or_unverifiable_authority` and was abandoned; the findings were fixed in `9d9a8464852`.

## Delivery

- Strategy: `feature-branch-chain`, integration base `custom/integration` (parent session, 2026-10-29). Nothing is pushed or opened until the user asks.

## Review STATUS timeout (for triage)

- gentle-ai 3.7.0, Windows 11, agent claude-code. Same failure on T1 and T2, right after a granted `review start` returned `created`.
- Command shape (run as returned, no outer timeout wrapper): `gentle-ai review status --contract=gentle-ai.review-integration/v2 --next-transition=true --lineage=<id> --repository-context=<rctx2_...> --agent=claude-code --base-ref=<sha> --committed-only=true`.
- Result: `gentle-ai.review-integration.failure/v2`, phase `pre_native`, code `operation_timeout` ("exceeded its aggregate time budget"), cause `context deadline exceeded`, `retry_safe: false`, `next_action: stop`. The envelope does not state the budget.
- Lineages: T1 `review-cce108eb4951f8d5` (20 paths, 1,130 lines), T2 `review-62fd09ccd7a0b2b0` (10 paths, 719 lines). Both abandoned with `operator_disposition`.

## Next step

T4 (mobile pill + sheet per artboards 3–4, gated on the capability).
