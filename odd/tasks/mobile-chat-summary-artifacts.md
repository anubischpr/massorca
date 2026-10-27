# Mobile chat summary, sessions and artifacts

Branch: `feat/mobile-chat-summary-artifacts` (from `origin/custom/integration` 1acadb9ff60). No push, no PR.

## Objective

Bring the desktop "chat summary" to the mobile native chat in the approved prototype's style
(design canvas https://claude.ai/artifact/4xVDKF2P7ckWM6L8Gm5r4T): an overflow menu with
Sessions · Plan · Summary · Artifacts and Branch/Checks, a session switcher, a background-work
sheet, a Summary screen, and an Artifacts list with a read-only viewer.

## Constraints

- Mobile tokens from `mobile/src/theme/mobile-theme.ts`; English UI copy (mobile has no i18n).
- Remote Wire Compatibility: only existing RPC methods or optional fields; a method an older
  host lacks degrades to an "unavailable" state, never an error loop.
- Composer toolbar is NOT re-implemented here (lives in `feat/mobile-composer-toolbar`, PR #89).
- PR Checks stay reachable from the menu.
- Folder workspaces and SSH hosts must work (no git-only assumptions).
- TDD: off (no project/session config enables it); runner `pnpm test` in `mobile/`.
  Checks per task: `pnpm typecheck` and targeted `pnpm test <files>` in `mobile/`.

## Data sources

| Area | Source | Status |
|---|---|---|
| Sessions | `session.tabs.subscribe` (already on screen) | have |
| Background tasks / subagents | `agentSession.subscribe` (`nativeChatBackgroundTasks`) | have |
| Plan, Results, Connectors | derived from chat transcript (journal) | derive |
| Recorded-file read | `agentSession.readRecordedFile` (host side on `feat/remote-session-file-read`) | gated: unavailable on hosts without it |
| GitHub account | `repo.list` optional `ghAccount` | read if present, row hidden otherwise |
| Servers, Context | no host RPC | omitted |

## Tasks

- [x] T1 Overflow menu: Sessions, Plan, Summary, Artifacts; Environment: Branch, Checks (route: delegated writer A)
- [x] T2 Session switcher chip + Sessions sheet; "Resume an earlier session" replaces Agent History (writer A)
- [x] T3 Background sheet opened from the working/status indicator: running + finished tasks, background agents (writer A)
- [x] T4 Plan sheet derived from the transcript (writer A)
- [x] T5 Summary screen: agent status, environment tiles, results strip, connected chips (writer B). Commit `7bd476b208b`.
- [x] T6 Artifacts screen (grouped grid + files list, filters) and read-only viewer (HTML in sandboxed WebView, source toggle), gated recorded-file read (writer B). Commit `bb0c2152f10`.
- [x] T7 Plan always in the ⋯ menu whenever the native chat is shown; Plan sheet shows a quiet "No plan yet" empty state (feedback from build pv32, writer C)
- [x] T8 Real previews in the Artifacts list: lazily rendered, cached per path, scaled non-interactive WebView thumbnails for HTML files; glyph fallback for any non-ready state; chat `::orca-visual` lines listed as Pages (writer C)
- [x] T9 Viewer correctness: HTML isolated and read-only (no in-page navigation, external links only, no file access); tests per viewer kind; commit only if a fix is needed (writer C)
- [x] T10 Chat screen chrome per the approved prototype: floating top controls (back, chat/folder/branch segmented control, ⋯), session switcher chip replaces the tab strip for structured chats, "+ new session" and terminal/panel switching kept reachable, status pill opens the background sheet, inline artifact card after a turn that wrote HTML or a visual; composer toolbar untouched (writer C)

## Round 2 (device feedback on build pv32)

Source of truth for the design: the approved prototype `Main.dc.html` in the session scratchpad (390x844 canvas). Each task is one Conventional Commit with its tests; no AI attribution lines. Checks per task in `mobile/`: `pnpm typecheck` exit 0, targeted `pnpm test <files>`, `pnpm exec oxfmt` and `pnpm exec oxlint` on changed files.

### T7 evidence
- Route: inline, 5 source files (menu resolver, chat-surfaces hook, Plan sheet, tests).
- Commit: `63c59d9b0c2` feat(mobile): always offer the plan in the chat menu with a no-plan state (doc plan `92f9f48c807`).
- Checks: `pnpm typecheck` exit 0; `pnpm test` on the header-menu, Plan sheet and menu sheet suites: 3 files, 20 tests pass; oxfmt and oxlint clean.

### T8 evidence
- Route: inline (single writer), about 20 new and changed files.
- Commit: `a7471f5ef60` feat(mobile): preview artifact pages as scaled thumbnails and list chat visuals.
- Thumbnails: JS off, CSP blocks network, tile takes the tap, page laid out at 390px and scaled. Loads only near the viewport (measured), two at a time, cached per host, session and path; the viewer reads the same cache. Visuals from `::orca-visual` are listed as Pages and open in the visual frame.
- Checks: `pnpm typecheck` exit 0; `pnpm test` on 14 suites (new pure modules, the thumbnail component, dependent chat-artifact and visual-read suites): 78 tests pass plus the component test; oxfmt and oxlint clean.

### T9 evidence
- Route: inline; a fix was needed. The viewer's HTML and SVG pages rendered in a plain WebView with scripts on and no CSP, and its navigation guard covered only the top frame, so an iframe could load anything. Pages now render in the sandboxed chat frame (opaque origin, CSP, http and https links only, navigation refused) with a Preview and Source toggle.
- Commit: `7f01b4e1d98` fix(mobile): render artifact pages in the sandboxed chat frame, not a page with scripts and network.
- Checks: `pnpm typecheck` exit 0; `pnpm test` on 7 suites (viewer model, page component, frame, recorded and visual reads): 43 tests pass; oxfmt and oxlint clean.
- Not changed: the workspace file preview (`MobileSessionFileReader`) still uses `MobileHtmlPreview` with scripts on; it is outside the chat viewer.

### T10 evidence
- Route: inline (single writer), about 30 files.
- Commit: `877ffc63ebc` feat(mobile): float the chat controls over the transcript and show turn artifact cards.
- Chrome: a structured chat shows the floating bar (back, Chat / Files / Source control segments, ⋯) and the session chip in place of the header and tab strip. Terminal sessions keep the classic header. The transcript and its load-earlier row start below the chrome (`MOBILE_CHAT_CHROME_CONTENT_TOP`). Quick commands moved into the ⋯ menu (same guard as the old tab button, `resolveMobileSessionQuickCommandsAction`); new session and terminal switching are in the Sessions sheet.
- Inline card: after a turn that wrote an HTML page or showed a visual, a card with the thumbnail, name and kind opens the viewer.
- Not done: the working strip keeps its current style and position above the composer; it was not restyled into the prototype's floating pill.
- Checks: `pnpm typecheck` exit 0; `pnpm test` on 19 suites (chat view, overlay, surface, menu, chrome segments, turn cards, quick commands, page component): 136 tests pass; oxfmt and oxlint clean. Lint note: `MobileNativeChatView.tsx` is at the 400-line limit, so three pieces moved to their own files (load earlier, empty copy, jump to latest) instead of a disable.

Engram mirror `odd/mobile-chat-summary-artifacts/tasks`: pending (mem_save not loaded in this worker run).

## Acceptance

Each item reachable from the chat's ⋯ menu; mobile `pnpm typecheck` and the touched tests pass;
older hosts show "unavailable" instead of failing.

## Progress / evidence

Commits on `feat/mobile-chat-summary-artifacts` (local, not pushed):
- `ea1d949f754` feat(mobile): add session switcher chip and sessions sheet (T2). Switcher rows tests pass. 594 authored lines, over the ~400 planning heuristic; kept as one cohesive unit.
- `c81e5832952` feat(mobile): open background work as a sheet from the working strip (T3). Strip, tray and sections tests pass (31). 396 added, 273 removed.
- `09306794ccc` feat(mobile): show the agent's plan as a sheet from the chat menu (T4). Plan derivation and plan sheet tests pass. 544 added.
- `d80bc58aad2` feat(mobile): group the chat menu into chat and environment sections (T1). Menu, recorded-file and menu sheet tests pass. Summary and Artifacts placeholder routes added.
- `7d252a469d8`, `11adc8f321e` test-only fixes: drawer stub typing, and the sheet stubbed in chat view suites.

Checks:
- `pnpm typecheck`: exit 0 after the last code commit.
- `pnpm typecheck:tests`: no errors in the touched test files; the baseline failures are unchanged.
- `pnpm test src/session`: 247 of 248 files pass. `mobile-native-chat-merged-snapshot-parity.test.ts` times out at 5 s only under full-directory load; it passes alone (9 of 9) and imports none of the changed modules.

- `7bd476b208b` feat(mobile): build the chat summary screen (T5). New pure tests: summary model (14), environment (10), environment read (3), surface snapshot (3); recorded-file list extended (6). Route body: `MobileChatSummaryView`.
- `bb0c2152f10` feat(mobile): list chat artifacts and open them in a read-only viewer (T6). New tests: artifacts model (grouping, filters, viewer kind), recorded-file read (reply parsing, method-not-found, transport failure). Routes: `chat-artifacts` list and new `chat-artifact-view/[worktreeId]` viewer.

T5 and T6 checks (mobile/):
- `pnpm typecheck` (`tsc --noEmit`): exit 0 after the T6 commit.
- `pnpm typecheck:tests`: no errors in any new or touched test file.
- `vitest run` on the new and touched tests plus `mobile-web-shell-session-route.test.tsx` and `MobilePlanSheet.test.tsx`: 9 files, 65 tests pass.
- oxfmt and oxlint on every changed file: clean. The `max-lines` error on the Summary view was fixed by moving styles to `mobile-chat-summary-styles.ts`, not by a disable.

Deviations and gaps:
- Summary and Artifacts read the chat from a per-tab snapshot the session screen publishes (`mobile-chat-surface-snapshot.ts`), not a second transcript subscription. Chat identity resolution lives in the session controller; a second route would fork it. Consequence: opening a Summary or Artifacts URL with no chat on screen shows "Open this chat".
- `agentSession.readRecordedFile` is not in the generated typed params catalog on this branch (it is added with `feat/remote-session-file-read`). The call goes through `client.sendRequest` with the reply validated by zod. Switch to a typed `defineRpcOperation` after that branch is merged and the catalog regenerated.
- Recorded files are read only for structured chats; a terminal-agent chat shows "does not share its files with the phone".
- Session title is the chat's first prompt (mobile carries no tab title in the chat state). The working clock comes from the host's turn start and is absent on the terminal lane, where the status reads "Working" alone.
- Host label: "This computer", or the SSH target's name. Desktop's "Local Mac" wording is not reproduced.
- Connectors come from `mcp__<server>__<tool>` names in the transcript. Running subagents come from the transcript roster, so a subagent that finished before the transcript loaded does not appear.
- `+/−` counts show only for edits that reported a diff; a write without one shows no counts.
- HTML viewer reuses `MobileHtmlPreview` unchanged: JavaScript on, links opened externally, no added network lockdown.
- The thumbnails and grid tiles are glyph placeholders; no live WebView is rendered in lists.
- The `chat-summary` and `chat-artifacts` routes are file-based under `app/h/`; they are not listed in `_layout.tsx`, which corrects the T1 note.
- Not run: `pnpm test` over all of `src/session` (the full-directory run is what made the parity test flaky before).

Known gaps:
- Plan and recorded-file counts come from the transcript pages the screen holds.
- Sessions status for non-active structured tabs shows Idle: mobile carries no per-tab status for them.
- Finished background tasks are not listed: the mobile roster carries running work only.

## Next step

Parent: review the T5 and T6 commits, then decide whether to merge `feat/remote-session-file-read` and regenerate the params catalog so the recorded-file read becomes typed. Not yet checked on a device or simulator: the WebView preview, and the 2x2 tile and results-strip layout at phone width.

## Review findings

An automated reliability review covered this branch up to `7b44bb54ea4`. Each finding was checked against the current code before it was fixed or skipped.

- R3-agent-history-reachability (CRITICAL): fixed in `42158345222`. The ⋯ menu offers Agent history without a native chat; beside one, Sessions keeps the resume row. That commit overwrote the sheet's existing test file by mistake; `353cc5fac9d` restores its five tests and adds the agent history cases.
- R3-recorded-files-error-results (WARNING): fixed in `d187337fcbb`. The count reads the result's own `isError`. A call still running with no result stays uncounted, now tested.
- R3-plan-ledger-synthetic-result (WARNING): fixed in `fea5cdac106`. No made-up success reaches the ledger, and an errored call is skipped. An errored TodoWrite or update_plan no longer replaces the plan either.
- R3-chat-surfaces-hook-unproved (WARNING): fixed in `43dba555f96`. Tests cover the hook, the switcher chip label, and the sessions sheet's close and resume paths.
- R3-chat-session-unguarded-read (WARNING): skipped, does not hold. The session lane returns a session object on both branches, so `messages` is always an array. A test mounts the hook on a route with no chat (`43dba555f96`).
- R3-background-sheet-reopens (WARNING): skipped, intended. `c81e5832952` keeps the sheet open across a roster that empties between children, as desktop keeps its expanded list. Behavior is unchanged and pinned by a test (`43dba555f96`). Open decision for the owner: the modal re-presents without a tap after a long gap.
- R3-sheet-close-unproved (WARNING): fixed in `43dba555f96`. The drawer stub passes `onClose`, and a test closes the sheet and checks it stays closed.
- R3-empty-groups-blank-sheet (SUGGESTION): fixed in `3d8723488b6`. The unavailable note shows whenever no row is drawn, with a sheet test.

Desktop's `nativeChatSessionPlan` (`src/renderer/src/components/native-chat/native-chat-session-summary.ts`) still feeds the same synthetic success. Not changed here, since this branch is mobile-only.

Checks (mobile/): `pnpm typecheck` exit 0. `pnpm check:tests-typecheck` ratchet OK; no touched file has a test type error. oxfmt and oxlint clean on every changed file. Vitest: 16 suites, 134 tests pass (the 9 touched suites and 7 dependent chat suites).
