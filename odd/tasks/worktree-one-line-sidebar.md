# Worktree one-line sidebar

Locator: `odd/tasks/worktree-one-line-sidebar.md` · Engram topic: `odd/worktree-one-line-sidebar/tasks`
Approved design: https://claude.ai/artifact/XW87cyN1anQAffEk2kaacf

## Objective

Replace the multi-line worktree card, on desktop and mobile, with one line per branch, then one line per session (agent icon and title), then nested child sessions.

## Problem and why

The card repeats title, account, worktree and path that the Environment card already shows. The list should read like the clean sidebar in the Bot teams prototype, without hiding a session that needs the user.

## Scope

- Desktop worktree sidebar rows, context menus and hover card.
- Mobile worktree list rows and long-press sheets.
- Manual display name for a branch row.
- Mobile needs-human and failed status presentation.

Out of scope: Environment card content, push, PR, the `custom/pv27-unified` branch.

## Approved decisions

- Branch row: `GitBranch` icon and branch without the user's own prefix. Folder workspace: `Folder` and folder name. Detached HEAD: commit icon and short SHA.
- Host shows only on a same-branch collision in the project, including collapsed rows, or when disconnected. Two projects with one branch while ungrouped show what differs.
- Session row: agent icon, title, trailing status. Model and time leave the row.
- Status: needs-human is the orange `MessageCircleQuestion` on desktop and mobile; red is only for failures. Blocked and waiting share the needs-human icon. Done and seen shows nothing.
- Collapsed branch or project shows the worst hidden status.
- Five sessions visible, then "Show N more". Needs-human, failed, working and unread sessions are never hidden.
- PR and CI: one tinted icon on the branch row, desktop; existing `#N` badge on mobile.
- A child in another worktree shows once, under its parent, with a branch icon whose tooltip names the branch. Its own branch row stays, nested under the parent branch.
- Worktree, host, account and path move to a section in the branch hover card and stay in Environment. Issue, notes, automation, CLI and ports stay in the hover card only.
- Desktop branch menu is unchanged. New session menu: Rename, Mark Read, Copy Title, Copy Path, Close.
- Mobile sheets: branch adds Copy Path; Pin and Agent Session History get real icons instead of the pencil fallback; folders get the sheet without Source Control; new session sheet: Rename, Copy Path, Close.
- "Update" stays and can set a manual display name for the row. It never renames the git branch and must not reuse an auto-generated worktree name.
- Loss of contact is never shown as exit: a disconnected host dims rows and uses the unconfirmed state.

## Constraints

SSH, folder workspaces, GitLab and mixed client and host versions must keep working: new wire fields are optional and an old host means the branch name shows.

## Test mode

TDD off (no project or session configuration found). Runner: `pnpm test`, plus `pnpm tc` and `pnpm run check:code-quality:changed`.

## Delivery

Strategy `ask-on-risk`. Forecast is above 400 authored lines, so the chain choice is asked before any PR. Commits stay local on `claude/jolly-faraday-764c3f`.

## Tasks

- [x] T1 Desktop one-line rows, status and collapse (delegated: 2+ non-trivial files) - commit 97a0bf59270
- [~] T2 Desktop session menu, hover card Environment section, cross-worktree child (delegated) - commit a2144e7b2f9; menu and Environment section done, cross-worktree child NOT done
- [x] T3 Manual display name for the branch row, desktop and mobile data (delegated) - commit c56e8ba5edc
- [ ] T4 Mobile rows, sheets, status colors and failed state (delegated)
- [ ] T5 Verification in the real app, desktop and mobile

## Progress

- T1 (delegated writer, trigger: 2+ non-trivial files, 4+ files to read) done in 97a0bf59270. New `worktreeCardLayout` setting ('one-line' | 'detailed' | 'compact'), unset resolves to one line; `compactWorktreeCards: true` without it stays Compact; the experimental card style still wins; settings not loaded yet keeps Detailed.
- T2 (delegated writer) done except the cross-worktree child, in a2144e7b2f9. Session menu: Rename (tab custom title), Mark Read (acknowledgeAgents), Copy Title, Copy Path, Close (tab close command). Rename and Close are left out for subagent children, retained rows and children sharing a parent tab; Mark Read is left out for subagent children.
- Not done in T2: a child session in another worktree shown once under its parent with a branch icon. It needs a cross-worktree agent row index (rows are built per worktree), which is a separate data change.
- Known gaps: branch prefix is hidden only when the git-username or custom prefix setting yields a prefix; `compactWorktreeCards: false` cannot be told apart from a deliberate Detailed choice, so such profiles move to one line.
- Verification: see the delegation report (tc, targeted tests, code-quality gate with ORCA_CODE_QUALITY_BASE=HEAD).
- T3 (delegated writer, route: delegated, trigger: 2+ non-trivial files) done in c56e8ba5edc. Optional `manualDisplayName` (string or null, where null clears) on worktree meta, folder workspaces, the merged Worktree, `worktree.ps` rows (present only when set) and the `worktree.set` RPC. Remote writes are gated on `worktree.manual-display-name.v1`. In the one-line layout Update and Rename edit the row name inline; Detailed and Compact keep the Update dialog and `displayName`. The row shows the row name, otherwise the existing label. Collisions still compare real branches, and the hover card keeps the real branch. Mobile list rows show the row name first when set.
- T3 verification: `pnpm tc` exit 0; targeted vitest (src/shared/worktree and the touched files) 32 files and 370 tests pass; `ORCA_CODE_QUALITY_BASE=b3b04b1f49f pnpm run check:code-quality:changed` exit 0. Not run: mobile vitest and mobile typecheck, because mobile's tsconfig cannot resolve `expo/tsconfig.base.json` in this worktree. `WorktreeCard.quick-actions.test.tsx` times out in its `beforeAll` import (20 s), alone and in the batch; not yet compared with the base commit.
- Review of 97a0bf59270 fixed in 49b9eaec0da..d6f1a5f312f (independent read-only review):
  - Settings: `settings.update` accepts `worktreeCardLayout`. The strict schema had no key, so the dispatcher rejected the whole update and web and paired clients could not change the layout. A bare `compactWorktreeCards` update now also stores `compact` or `detailed`.
  - Folded status: a folded branch and a folded project show the worst glyph across the worktree's session rows, so a retained failure beats live work and an unseen session stays unread after activation. The worktree status is used only when there are no session rows.
  - Identity: folder workspaces and detached HEADs collide by the name they show; two folders of one project and host are told apart by their parent folder. Labels de-duplicate over the whole list in flat lists and per project when grouped by repo.
  - Surfaces: only sidebar rows take the one-line layout. The folder panel and the kanban card keep Compact and Detailed as before, and the experimental card style still wins.
  - T3: Update opens the full dialog in every layout. On one-line it also edits the row name (`manualDisplayName`; blank clears it; title and git branch untouched). The `workspace.rename` shortcut keeps the inline row editor. This replaces the T3 note above that Update edits the row name inline.
- Native review of T1 unavailable (lens_context_budget_exceeded); independent read-only review done, findings fixed. Native review of T3 unavailable (operation_timeout, twice).
- Review-fix verification: `pnpm tc` exit 0 before the last two edits (a row-name field class cleanup and a test cast); `pnpm run typecheck:node` and `typecheck:web` exit 0 after them; `node config/scripts/generate-rpc-params-catalog.mjs --check` exit 0; 40 touched and dependent test files pass (496 tests) on the final tree; `ORCA_CODE_QUALITY_BASE=3742bd6f0e3 pnpm run check:code-quality:changed` exit 0.
- Not caused by this work (same at 3742bd6f0e3): the `WorktreeList` group, folder and lineage tests fail with `Missing getServerSnapshot` from `RepoHeaderTitle` (`use-repo-gh-account-display.ts`, unchanged on this branch); `WorktreeCard.host-badge-toggle`, `compact-hover` and `WorktreeCardAgents.send-target` time out in first-test imports. `pnpm run verify:localization-*` fails on native-chat delegation keys and `PrototypeEditPanel.tsx`, which this branch does not touch; the new strings are not flagged.
- Known gap: a bare `worktreeCardLayout` write does not update `compactWorktreeCards`, so pre-T1 paired clients read the old flag.

## Next step

T4 (mobile rows, sheets, status colors and failed state), then the T2 cross-worktree child.
