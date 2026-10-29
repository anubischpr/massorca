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
- [ ] T3 — Desktop sidebar "No Git" pill + popover per artboard 2. Route: delegated direct.
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

## Next step

T3 (desktop sidebar pill + popover), then T4 (mobile).
