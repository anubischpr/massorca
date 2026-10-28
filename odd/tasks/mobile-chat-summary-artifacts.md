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
- [x] T11 Floating status pill above the composer for structured chats: amber dot, "Working", elapsed clock (structured lane only), running terminal and agent counts (hidden at zero), tap opens the background sheet (coordinator request)
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

### T11 evidence
- Route: inline (single writer). Coordinator request after T10.
- Commit: `d9f9af068df` feat(mobile): restyle the chat's background work strip as a floating status pill.
- Pill: glass capsule, left-aligned in the composer tray. Counts: terminals = running command and monitor tasks; agents = running agent tasks; other kinds stay in the sheet. Zero counts hidden. Time only on a lane that publishes a turn start, read on the host clock. When the roster stream is lost, the pill reads "Status unavailable" and states no count or clock; the sheet stays reachable.
- Bottom inset: the pill sits in the tray in flow, above the composer and below the transcript, so the transcript already ends above it and nothing is covered. No inset change was needed.
- Terminal sessions: unchanged (the strip mounts only on the structured lane).
- Not changed: the chat's own working indicator on the non-structured lane (`MobileAgentWorkingIndicator`).
- Checks: `pnpm typecheck` exit 0 (no TS errors); `pnpm test` on mobile-chat-status-pill (11 tests), MobileNativeChatBackgroundTasks (13 tests, four header-only cases removed and the rest moved to the pill label), composer tray (7), and 9 dependent chat and sheet suites (66 tests): all pass; oxfmt and oxlint clean.

Engram mirror `odd/mobile-chat-summary-artifacts/tasks`: saved as a condensed mirror (project resolved by session, not `massorca`); conflict candidate judged not_conflict. The verbatim doc is this file.

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

### Round 3 review (7fc898a348f..HEAD)

An independent review covered the branch from `7fc898a348f` to the T11 commits. Each finding was checked against the code first.

- Thumbnail glyph latched when the source was null at mount (`use-mobile-artifact-thumbnail.ts`): fixed in `d185d7d2f8b`. The glyph is now derived per render from the source; the load runs once the source appears. Test: `use-mobile-artifact-thumbnail.test.tsx`, "loads once a source appears after mount".
- Reconnect to desktop and the tab hold menu lost in the structured chat: fixed in `cdc4f7e5da6` (a tappable Reconnect row in the floating chrome, shown when a retry is offered, wired to `forceReconnectHost`; test `MobileChatFloatingChrome.test.tsx`) and `ad566deb733` (a hold on a Sessions sheet row opens close and rename after the sheet closes; test `MobileSessionsSheet.test.tsx`). Not restored: the haptic on hold.
- Cached previews went stale after a later turn edited the file: fixed in `d185d7d2f8b`. The cached copy paints first; a recorded file is revalidated once per mount and per source (`readRecordedFilePreview` with `revalidate`). A visual is always asked of the host already. A host that gives no answer keeps the last copy, since a transient failure cannot be told from a deleted file.
- Floating chrome covered the create-warning banner and the docked panel header, and the 128 inset was fixed: fixed in `cdc4f7e5da6`. The chrome now lives in the content column, so it no longer reaches the docked panel. It measures its own height (`onLayout`) and publishes it through `MobileChatChromeLayoutContext`; the banner and the transcript start beneath the measured height. The fixed 128 remains only as the estimate before the first measurement. Test: `mobile-chat-chrome-layout.test.ts`.
- Status pill hid workflow and unknown tasks: fixed in `7008bb1545f`. The pill shows whenever the roster has non-done work (`view.show`); the counts are unchanged. Test: `mobile-chat-status-pill.test.ts`.
- Thumbnail WebViews latched near and never unmounted: fixed in `d185d7d2f8b`. Viewport proximity is now tracked both ways, and at most six live previews hold a slot (`mobile-artifact-preview-slots.ts`); a preview past the cap shows the glyph and takes a slot when one frees. Tests: `mobile-artifact-preview-slots.test.ts`, `use-mobile-artifact-thumbnail.test.tsx`.
- Thumbnail CSP depended on a `<head>` match: fixed in `d185d7d2f8b`. The policy is always the first meta, after a leading doctype only (a doctype must stay first). Test: `mobile-artifact-thumbnail-html.test.ts`, including a head inside a comment.
- ⋯ quick commands lost the creating and not-connected guard: fixed in `5eda45bcacd`. The row is disabled under the same guard the tab button used. The Sessions sheet's New tab had lost the same guard and got it too.
- Viewer opened without a tab param: skipped. `showNativeChat` requires an active tab id (`use-mobile-native-chat-active-resolution.ts`, `activeSessionTab && activeSessionTabId`), and the chat's cards and the ⋯ items exist only while a native chat is shown, so the opener cannot run without a tab.

Checks (mobile/): `pnpm typecheck` exit 0 after each commit. Touched and dependent suites pass; oxfmt and oxlint clean on the changed files. Not verified on a device: the thumbnail limit under real Android memory pressure, the reconnect row's position beneath the chip, and the banner offset.

## Round 4 (pv36 phone QA)

Three units from the QA of build pv36 (`custom/pv27-unified` at `63d8b2ae231` includes this branch).

- [x] T12 Centre the session chip in the floating chat controls. The chip's `alignSelf: flex-start` overrode the row's centring. The chip takes a `centered` prop; the floating controls pass it, and the classic header keeps its start alignment (its only other caller). Commit `3c30457ac29`. Checks: chip and chrome suites pass (8 tests), typecheck exit 0, oxfmt and oxlint clean.
- [x] T13 Show the working status pill on every chat lane while a turn runs. The bridge (terminal-lane) chat showed "Agent is working" with Tools and Stop; the text is gone, and the pill replaces it: "Working", with no clock (the lane publishes no start), and no counts. Tools and Stop stay in the same row. The pill and the structured strip now share `MobileChatStatusPillView`. Commit `86f3b9bed45`. Not tappable on the bridge lane: that lane publishes no background roster, so there is no sheet to open. Checks: pill, strip and chat-view suites pass (68 tests), typecheck exit 0, oxlint clean. The old `MobileAgentWorkingIndicator` file is removed.
- [x] T14 Stop the old session chrome flashing on open. `resolveMobileSessionChromeMode` picks the top bar from what is known on the first render: a native chat draws the floating controls, a terminal or document tab draws the classic header, and while the kind is still loading (tabs not loaded, or an agent-session transcript resolving) a neutral Back-only bar draws instead. Commit `0840ea0d652`. Checks: decision table (6 tests) and the surface test pass (15 tests), typecheck exit 0, oxlint clean.

Pre-existing: `src/session/mobile-prompt-controller.test.ts` fails to load with `SyntaxError: Unexpected token 'typeof'`. It fails the same way at `3c30457ac29` with the pre-T13 chat view restored, so T13 did not cause it. Not bisected further back.

Checks (mobile/, this round): `pnpm typecheck` exit 0; oxlint clean on the 20 changed TypeScript files; 17 dependent suites, 137 tests, pass.

## Round 5 (advisory review of be86193b893..345b15b9c84, and T15 and T16)

### Gentle AI reliability review findings

The review approved the range and left non-blocking findings with locations only. Each was checked against the code. Fixed in `5b5a4f0a075`.

- R3-001 WARNING, `mobile-session-chrome-mode.ts`: fixed. A cached tab list with no active tab read as terminal once connected, so the classic header could flash before the chat resolved. The decision now takes `hasTabs`; a listed tab set without its active tab stays pending, with Back on the neutral bar.
- R3-002 WARNING, `mobile-session-chrome-mode.test.ts`: fixed. The table now covers an unknown active tab beside listed tabs, every non-chat tab type, an empty loaded session, and a resolving chat that does not affect a terminal tab.
- R3-003 WARNING, `MobileChatStatusPillView.tsx`: fixed by tests, behaviour unchanged. The tappable pill is a button named with its sheet label; the static pill is one grouped status with no button role. Covered by `MobileChatStatusPillView.test.tsx`.
- R3-004 WARNING, `MobileNativeChatView.waiting-rows.test.ts`: not an issue. That mock stands in for the bridge pill in a waiting-rows test. The pill's own behaviour is asserted where it matters: `MobileNativeChatView.turn-status.test.ts` counts the bridge lane's working indicator (length 1).
- R3-005 SUGGESTION, `MobileSessionSwitcherChip.test.tsx`: fixed. The test renders the chip and asserts the alignment on its own style, not only the helper.
- R3-006 SUGGESTION, `mobile-session-chrome-mode.ts`: fixed. `activeTabType` is typed with the tab union, not `string`.

### T15: GitHub login beside the repo group name (`5c43a148ab6`)

- The group header shows the repo's GitHub login, muted, from `Repo.ghAccount` in the existing `repo.list` reply. The reply already carries it: the mobile reply schema reads it through the shared `normalizeGhAccountBinding`, so the login is exact and nothing is fuzzy-matched. Folder groups and repos without an account show nothing.
- No extra request, no per-render refetch, and nothing delays the list: the label rides the catalog the groups already load, cached per host screen.
- Host change: the fallback needs none. The first source the coordinator named does not exist in this checkout: `github.readAccountGitConfig` is not defined in the host or in the mobile method allowlist, and nothing reads a `gh.account` git config. Using it needs a new host method and an allowlist entry, which is a host change; it is not added here.
- Tests: `host-repo-group-account.test.ts` (exact login, near-miss names unmatched, folder and non-repo groups blank, schema reads present, absent and malformed accounts).

### T16: Sessions out of the chat menu, Results out of the summary (`2358616d0cf`)

- The chat ⋯ menu no longer has a Sessions item. The session chip opens the Sessions sheet, which holds the New tab row, a row for every tab (terminal switching), and the resume row when agent history applies (`MobileSessionsSheet.test.tsx`).
- Agent history stays in the ⋯ menu when there is no native chat, where the chip does not exist; that is the R3-agent-history-reachability fix, tested in `mobile-session-header-menu.test.ts`.
- Summary: the Results section is gone, with its strip, thumbnail, styles, the model's `results` field and its constant, and the route's "see all" prop. Environment, Connected and the agent card are unchanged.

Checks (mobile/): `pnpm typecheck` exit 0 after each commit; oxfmt and oxlint clean on the changed files; the touched and dependent suites pass (menu, sessions sheet, chip, chat surfaces, summary model, environment, host list and reply schema).

## Round 6 (T17 and review findings on 345b15b9c84..HEAD)

### T17: the repo's gh.account first, Repo.ghAccount as the fallback (`83571c340e2`)

- Host method: `github.readAccountGitConfig`, params `{ repo }` (the mobile `id:<repoId>` selector), result `GhAccountGitConfigState | null`: `{ account, identityManaged }`, where `account` is the repo's `gh.account` login and nothing else (the host is inferred from the credential helper key, or github.com). Verified on `feat/gh-account-git-config`.
- The method is not in this branch's typed params catalog, so `mobile/src/worktree/repo-git-account-read.ts` calls it untyped through `client.sendRequest` and validates the reply with zod, as `mobile-recorded-file-read.ts` does.
- An older host, or one that refuses the method to phones (`isMobileMethodUnavailableError`), is remembered per client and never asked again; the caller falls back quietly. An ordinary failure is not remembered, so a later read asks again.
- Cache per host and repo, 5 minutes. The repo-header reads run in the background after the catalog arrives, two at a time, and overlay the fallback labels as each one lands, so the list never waits for them.
- The chat Environment reads the same login first (`withRepoGitAccount`). The host string comes from the bound account, or github.com when the repo binds none.
- The method is mobile-allowlisted on `fix/mobile-gh-account-read-allowlist`. This branch needs that host build (the VPS rebuild) before the git login appears; until then every read answers unavailable and the bound account shows, as before.

### Review findings (345b15b9c84..HEAD)

- Finding 1, closing the active tab cleared the active id while other tabs remained (`use-mobile-session-close-actions.ts`): verified, fixed in `767f0da2228`. The neighbour (the tab that took the closed tab's place, or the new last tab) becomes active in the same update. Test: `mobile-session-active-tab.test.ts`.
- Finding 2, a new terminal's raw handle matched no tab, so the bar stayed pending (`getActiveTabIdForHandle`): verified, fixed in `767f0da2228`. While the active tab is not listed, the last known kind stands in (`activeSessionTabTypeRef`) instead of null. Test: `mobile-session-active-tab.test.ts`.
- Finding 3, same-named repos merged into one group and the last repo's login won: verified, fixed in `83571c340e2`. A group shows a login only when every repo in it resolves to the same exact login with none missing. A folder workspace in the group omits the label, even when its name equals a bound repo name. Tests: duplicate names that disagree and that agree, a missing login, and a folder row beside a bound name (`host-repo-group-account.test.ts`).

Checks (mobile/): `pnpm typecheck` exit 0 after each commit; oxfmt and oxlint clean on the changed files; the touched and dependent suites pass (close and chrome decision, host-screen grouping and reply schema, repo account read, chat environment account).

## T18: the pill and background detail on the terminal-backed (bridge) lane (investigation, pv37 QA)

Status: investigated, not implemented. No code changed in this unit; the blocker is a host change, scoped below.

### What the execution host's status store carries

The hook server's store (`src/main/agent-hooks`, the single store AGENTS.md names) holds one entry per pane. Its payload carries:
- `subagents`: `{ id, agentType?, model?, description?, state, startedAt }` (`src/shared/agent-status-subagent-snapshot.ts`). Codex publishes these (`src/shared/agent-hook-listener/providers/codex-state.ts`).
- `children`: the richer `AgentChildWorkView` (`src/shared/agent-status-child-work-view.ts`) with `kind` (agent, workflow, command, ...), `name`, `description`, `state`, `lastMessage`, `firstObservedAt`, `stoppable`, `invocation`.
- `mainAgent.stateStartedAt`: the turn start clock.
- `workingMode: 'monitoring'`: ongoing work that does not need the foreground agent.

Codex does not publish shell background tasks; background tasks for Claude come from its own roster fold.

### What the phone can read today (mobile-allowlisted)

- `terminal.agentStatus`: returns the screen-scraped `waitText`, `title`, `titleStatus` (`runtime-terminal-agent-status-query.ts`). No subagents, no children, no turn start.
- `agentSession.subscribeStatus`: every structured session's projected status. Structured sessions only.
- `agentSession.subscribe` / the structured roster: children for structured chats (what the sheet already uses).
- `status.get`: server health, not agent status.
- `worktree.ps`: not inspected for per-pane agent entries (the orca-runtime-get-worktree-ps path; unverified).

The runtime does not read the hook store's entries (`src/main/runtime` has no accessor; the entries are consumed in main-process IPC). So the phone has no allowlisted source for terminal-pane subagents, background tasks, or turn start.

### Stop

- Structured lane: `agentSession.cancel` with `{ scope: 'background-tasks', taskId? }` already exists and is allowlisted.
- Terminal lane: no stop RPC for a terminal pane's children. Not invented here.

### Host change needed

Yes. Minimum additive change, in its own labelled commits so one VPS rebuild covers it:
1. `feat(runtime)`: a capability-gated, mobile-allowlisted stream (for example `terminal.subscribeAgentChildren`, keyed by terminal handle) that projects the hook store's `subagents` and `children` for that pane, plus the turn start, with mobile-safe fields and the live / unverifiable / exited verdict. Older hosts answer method-not-found and the phone degrades to today's pill.
2. `fix(rpc)` or `feat(runtime)`: a terminal-pane child stop, only for kinds whose provider has a real stop. Background shell tasks and Codex subagents must be checked against their providers before any stop is exposed.
3. Mobile, after 1: pill counts and clock from the stream (structured and terminal), tap opens the sheet with detail (command or description, elapsed, last output lines; subagent type, activity, elapsed), Stop where the host provides it, a collapsed Finished subsection, live updates. Output tails do not exist on the host today and need a further host change.

Open question for the owner: whether output tails are in scope for this round, since they need a new host feed and not only a projection.

### T18 step 1 (status: in progress, not yet shipped)

- `worktree.ps` already carries per-pane entries. Its agent rows come from the hook store's snapshots (`runtime-worktree-pty-agent-sources.ts` builds `RuntimeWorktreeAgentSource` from `hookSnapshots`), projecting `state`, `prompt`, `stateStartedAt`, `mainAgent`, and `lastAssistantMessage`. It does not project `subagents` or `children` today.
- So the additive path is: extend the `worktree.ps` agent row (`runtime-worktree-agent-source.ts`, `runtime-worktree-agent-rows.ts`) with optional `subagents` and `children`, read from the same store entry. That is a `feat(runtime)` commit with host tests. Older hosts omit the fields and the phone keeps today's pill.
- Root `node_modules` is present in this worktree, so `pnpm tc:node` can run directly.
- Not yet done: the capability advertisement, the terminal-pane child stop (step 2), the mobile detail sheet, Finished, and live updates (step 3). Live updates need either a stream or a timed `worktree.ps` poll while the sheet is open; `worktree.ps` is a whole-worktree scan, so a stream is the better choice and needs its own decision.
- Output tails: only `children.lastMessage` is available; no line-level output. Follow-up.


### T18 step 2 (shipped): pill and sheet on the terminal-backed lane

Route: one delegated writer. Decision changed from the plan above, with evidence: no new host RPC, no `worktree.ps` poll.

- A terminal tab's `agentStatus` on the paired `session.tabs` stream is already the full status row (`RuntimeMobileSessionTerminalTab.agentStatus: AgentStatusEntry`, spread from the hook store payload in `runtime-mobile-agent-status-builder.ts`). It carries `subagents`, `mainAgent`, `workingMode` and `stateStartedAt`, and the host republishes `session.tabs` on every store row mutation (`hook-status-session-tabs-republish.ts`). That is the single store and a live stream, so a `worktree.ps` projection plus a 2 to 5 s whole-worktree scan would be a second, slower copy of it. Pinned with `test(runtime)` (`da9264d9a0b`).
- The hook store holds no `children` for a CLI pane (`AgentStatusIpcPayload` has none; only structured sessions publish child views) and no per-task detail for a pane's background shell commands (Claude keeps a boolean, `claudeRunningNonAgentTaskPaneKeys`). So the terminal sheet lists subagents, not commands. A monitoring pane shows "Background work is running. This agent does not report its details."
- Stop: none for a pane. The shared row model builds CLI-pane subagent rows with `canStop: false` (`buildLegacyAgentChildRowModels`) and no host path stops them. The structured lane keeps `agentSession.cancel` with scope `background-tasks`.
- Host fix found while tracing the stream: on a desktop-attached host the renderer's sync key ignored `subagents`, so a roster-only change could reach the phone up to 30 s late (`8215af4c0bc`).
- Finished: hosts list running work only, so a row that leaves a live roster moves to a collapsed "Finished" section ("Ended", elapsed frozen where it was seen to end). A lost connection or a stale or unverifiable status never finishes anything (rows read "status unavailable"). Same fold for both lanes (`mobile-seen-background-work.ts`).
- Mobile: `MobileBridgeBackgroundWork` (pill with counts and the turn clock, tappable only when there is something to open), sheet gains Finished and an empty-note, `MobileNativeChatChromeRow` extracted from the chat view (it sat at the 400-line cap).

Checks: mobile `pnpm typecheck` exit 0; the new and touched suites pass (seen fold, terminal read, bridge pill and sheet, chrome row, sheet, structured strip, view and overlay dependents); root `pnpm tc:node` and the projection and roster suites pass; oxfmt and oxlint clean on the changed files.

Needs a device: the pill and sheet against a real Claude and Codex terminal chat (subagent start, finish, host restart), the live update on a desktop-attached host, and the chrome row layout.
