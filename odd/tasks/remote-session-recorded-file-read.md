# Remote session recorded-file read

## Objective

Let a native-chat file link open, read-only, a file that the agent itself wrote during the session, even when that file lives outside the session worktree on a paired remote runtime. Replace the raw "Remote file is outside the owning runtime worktree" toast with a clear message.

## Problem

With a remote runtime (paired Orca server), the renderer can only stat/read host files through worktree-relative RPCs. When an agent writes a file outside the worktree (e.g. an artifact HTML under `~/projects/informes/`), the "Results" list links to it, but Ctrl+Click fails with `Couldn't check <path>: Remote file is outside the owning runtime worktree`.

## Why

The worktree boundary is a deliberate security barrier and must stay. But a file the agent reported writing in this very session is a legitimate, narrow exception, analogous to `agentSessionAttachment.read`.

## Scope

- New host RPC that stats / reads a preview of an absolute path only when the host's own record of that session shows the agent wrote or edited it. The client path is never trusted.
- Capability-negotiated (new method; older servers answer `method_not_found`).
- Renderer: thread the session id into the native-chat file-link context; route outside-worktree stat/preview through the new RPC; open the file read-only (preview), never in the editor.
- Clear toasts: outside the workspace on a remote host, and server too old.
- i18n keys in every locale.

## Constraints

- Remote wire compatibility (AGENTS.md): new optional method behind a capability; old servers degrade to the clear message.
- Read-only; byte budget from `remoteFileContentBudget`; regular files only; no symlink escape.
- Cross-platform paths (`path` utilities, Windows-style paths in tests).
- SSH and folder-workspace cases must not regress (only environment runtime targets are affected).

## Configuration

- TDD: off (source: no project/session TDD configuration found). Ordinary functional checks apply.
- Runner: `pnpm exec vitest run --config config/vitest.config.ts <files>`.
- Delivery strategy: `ask-on-risk`. Forecast ~500–700 authored lines across two work units.

## Tasks

- [x] T1 — Host RPC `agentSession.readRecordedFile` (stat + preview modes) validating against the session's host-side journal write set; param schema, error union, capability, registration, generated catalog, tests. Route: delegated direct (writer trigger: 2+ non-trivial files). Commit `6297e6cc60c`.
- [x] T2 — Renderer: session id in `NativeChatFileLinkContext`; stat/preview routing for recorded outside-worktree paths; read-only open path; `method_not_found` fallback; clear toasts + i18n in all locales; tests. Route: delegated direct (writer trigger). Commit `3211bd861df`.

## Acceptance criteria

- Ctrl+Click on a Results link for an agent-written file outside the worktree on a remote runtime opens a read-only preview.
- A path not recorded for that session is refused by the server.
- Older server: clear "update the server" message, no raw error.
- Paths outside the worktree that are not openable show a clear message instead of the raw error.
- `pnpm tc`, targeted tests, `pnpm run check:code-quality:changed`, RPC catalog and localization verifiers pass.

## Progress

- Branch `feat/remote-session-file-read` from `origin/custom/integration` (1acadb9ff60).
- Mapping done (explorer): pattern to copy is `agentSession.readPlanDocument`.

- T1 (delegated writer): host derives the servable set from `host.journalSnapshot()` through `changedFilePathsFromJournalItems` (moved to `src/shared`, the same function the Results list uses). Only absolute, `..`-free recorded paths are servable; the client path is a membership check. Reads use lstat (links refused), `O_NOFOLLOW` open, `remoteFileContentBudget`, and refuse oversize instead of truncating. Evidence: `pnpm tc`, `structured-agent-session-recorded-file.test.ts`, `verify:rpc-params-catalog`, `check:code-quality:changed origin/custom/integration`.
- T2 (delegated writer): session id threaded into `NativeChatFileLinkContext`; `statRuntimePath` / `readRuntimeFilePreview` route outside-worktree paths to the new RPC when the context carries a chat; typed errors (`RemoteFileOutsideWorktreeError`, `RecordedFileHostOutdatedError`, `RecordedFileRefusedError`); clear toasts; read-only dialog viewer (`NativeChatRecordedFileViewer`).
- Design deviation: the doc-preview tab was not extended to recorded files. Its grants and `docLocation` are minted and persisted in the main process and synced browser state; a session-scoped owner would change that wire. The chat opens a read-only dialog instead (html in the isolated visual frame, markdown, images, text). PDF and other binaries show a clear "can't be previewed" message. `file-preview.ts` is unchanged.

## Next step

Review; then decide on pushing and the PR (user decision).
