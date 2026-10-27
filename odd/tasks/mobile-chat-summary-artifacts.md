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
