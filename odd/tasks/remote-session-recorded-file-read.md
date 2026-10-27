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

- [x] T3 — Review fixes. Host: the servable set comes from `writtenFilePathsFromJournalItems` (provider diff items plus completed calls of file-writing tools; `changes` honored only for `apply_patch`; MCP/Read/Grep/Diff tool inputs and user messages prove nothing); membership key maps to the recorded spelling and only that string is opened; UNC and device paths rejected; cross-version surface manifest entries added. Renderer: the viewer request carries the chat's `runtimeEnvironmentId` and builds its context with `buildWorkspaceFileContext`, so the global active runtime no longer decides the host; viewer state is keyed by request (no stale content on reopen); `structured_agent_session_unsupported` maps to the "update the host" toast. Commits `299919f6540` (host), `e1b6b3f6e4c` (renderer).

- [x] T4 — Open a recorded file in its own tab beside the terminal. Gesture: Mod+Alt+click (Cmd+Option on macOS, Ctrl+Alt elsewhere, via the platform check; Mod+click keeps the dialog). The tab is a transient editor-family kind `recorded-file` modeled on `check-details`: renderer-only, never persisted, never published to mobile or peers, so no `docLocation`, grant, or session-schema wire changes. Bytes come from the existing capability-gated `agentSession.readRecordedFile`; an older host shows the "update the host" message inside the tab. SSH and folder workspaces are unaffected (the recorded route only applies to paired runtime targets outside the worktree). Route: delegated direct (writer trigger: 2+ non-trivial files). Commit `3cca8f194aa`. Also fixes the viewer overflow (bounded flex column; body scrolls; text wraps, code scrolls horizontally). Evidence: `pnpm tc` exit 0; 21 test files / 263 tests; mobile-publication negative control; `check:code-quality:changed origin/custom/integration` 0 new findings; localization verifiers pass. Not checked visually in the running app. RDD: high; consent granted by the user; review `review-04cb66939b83402a` approved and acknowledged (authority burned). The reliability lens was refused once by the model provider and passed on the re-offered slot. 23 non-blocking advisory findings, logged under Follow-ups.

- [x] T5 — Results lists the chat's own visuals. An HTML artifact generated by a shell script is never journal-recorded, so `readRecordedFile` must keep refusing it. Visuals the chat displays come from `::orca-visual{file=...}` directives in assistant messages and are read through the separate `agentSession.readVisual` channel (Orca's per-chat visuals folder, containment-checked). Results gains a "visual" entry kind parsed from message items with `parseNativeChatVisualDirectiveLine`, opening through the existing visual sidebar route (`use-native-chat-visual-open.ts`, shared with the inline visual). No host or wire change; the recorded-file rule is untouched. Route: delegated direct. Commit `677b168fbdb`. Evidence: `pnpm tc` exit 0; 4 files / 121 tests (re-ran 2 files / 40 tests); `check:code-quality:changed` 0 findings; localization verifiers pass; mobile does not read Results data. RDD: high; review `review-6af57e86fe5072a8` approved and acknowledged (21 non-blocking advisory findings). Decisions for QA: visuals are listed before file changes; subagent replies are excluded; the per-reply cap is line-based.

## Follow-ups (not blocking)

- Edge case (T4): a worktree whose only open tabs are recorded-file tabs is skipped when the session is saved, so it restores with the default layout instead of its empty split. The filter must stay because the strict tab-type enum would reject the whole persisted patch. Possible fix: persist the groups and layout with empty tab lists.
- T4 advisory review findings worth a later pass: Cmd+S save-target set includes `recorded-file` (no-op today, inconsistent); tab id joins `sessionId` and path unescaped; the preview read has no timeout or in-tab retry and refetches per activation; the failure cause is discarded; a UA spy may leak between gesture tests; the editor header has an unreachable copy-toast label; the Ctrl+Alt gesture can collide with AltGr layouts on Windows.
- T5 advisory findings worth a later pass: CRLF handling differs between the fence scanner and the directive parser; reply ordering within one message is not explained; non-text message blocks and the subagent filter are not covered by tests; the visuals list re-scans the whole transcript on each change and is unbounded in the expanded Results list; opening a visual without a chat owner does nothing silently.
- Possible pre-existing issue (unverified): `mobile-session-snapshots.ts` may publish `check-details` open files through the open-file fallback, since `buildMobileFileTab` has no mode guard.
- QA: the dialog and tab were not checked visually in the running app; es/fr/ja/ko/zh strings were machine-written.

## Acceptance criteria

- Mod+Alt+click on such a link opens the same read-only content in a tab beside the terminal; the tab is not restored after restart and never reaches mobile or peers.
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

- T3 accepted/known (no code change): a parent-directory symlink inside a recorded path is followed (only the final component is checked, with lstat and `O_NOFOLLOW`); Windows has no `O_NOFOLLOW`, so there the lstat and regular-file checks are the defense; the method uses `permission: 'workspace'` with a bare `sessionId`, like its siblings; each stat or preview rescans the journal snapshot; files created by shell commands are never recorded and so never served; the Results list still shows paths the host will not serve (it reads any tool's input), and those answer with the "outside the workspace" toast; provider diff items are trusted as provider-authored. The cross-version wire suite cannot run in this environment (baseline checkout fails: `git archive` pathspec `src/relay`, unrelated to this change), so the new manifest entries are typechecked only.

## Next step

Morning QA in the preview build; then decide on pushing and the PR (user decision).
