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
- [ ] T5 Summary screen: agent status, environment tiles, results strip, connected chips (writer B)
- [ ] T6 Artifacts screen (grouped grid + files list, filters) and read-only viewer (HTML in sandboxed WebView, source toggle), gated recorded-file read (writer B)

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

Known gaps:
- Summary and Artifacts are placeholder screens; T5 and T6 replace their bodies.
- Plan and recorded-file counts come from the transcript pages the screen holds.
- Sessions status for non-active structured tabs shows Idle: mobile carries no per-tab status for them.
- Finished background tasks are not listed: the mobile roster carries running work only.

## Next step

T5 and T6 via writer B, on `mobile/app/h/[hostId]/chat-summary/[worktreeId].tsx` and `mobile/app/h/[hostId]/chat-artifacts/[worktreeId].tsx`. The parent decides whether this document gets committed, and mirrors it to Engram.
