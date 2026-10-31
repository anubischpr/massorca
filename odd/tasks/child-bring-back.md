# Bring back child session work

Objective: a parent chat brings a finished child session's git work into its own worktree, on desktop and phone. Approved prototype: https://claude.ai/artifact/GRXdMKv5WkY2juwX6GuebX.
Branch: claude/keen-einstein-06b079 (based on custom/pv27-unified). Delivery: single branch, integrated by the orchestrator. Runner: vitest (`pnpm test`).

## Specs

- S1: The finished child notice offers `Bring back` on desktop and phone, with `3 commits · 12 files · into {branch}`, in place, with no new dialog or sheet.
- S2: The host owns the operation and runs `git merge --no-ff` in the parent worktree, over local, WSL and SSH routes, on Git 2.25. Nothing is pushed.
- S3: States drawn as in the prototype: commits and clean tree; predicted conflict on Git 2.38+; child with uncommitted work; child with only uncommitted work; parent moved ahead; parent uncommitted work; parent session working; running; conflicts after merging; already brought back; child still running; worktree removed with branch kept; worktree and branch removed; parent without a branch or with an operation running.
- S4: Never lose work silently: no stash, no automatic commit of either side, and every blocked state says why.
- S5: Conflicts show `Merge conflicts: {n} unresolved`, `Resolve with AI`, `Abort merge`, and on desktop `Review conflicts`, which the phone lacks.
- S6: Folder workspaces, children in the parent's worktree and older hosts show the notice unchanged.
- S7: Copy comes from the approved prototype only.
- S8 (user, verbatim): "por favor, que no ocurra como otras veces que implementan labels o componentes que están fuera del prototipo."
- S9: Works in a real render on desktop and phone, validated in background without stealing focus.

## Tasks

- T1 [S2 S3 S4 S6] inline: host status, merge, abort and resolve, with real-git tests.
- T2 [S1 S6] inline: RPC methods, capability, mobile allowlist, child git capture at launch.
- T3 [S1 S3 S5 S7] inline: desktop notice.
- T4 [S1 S3 S5 S7] inline: phone notice.
- T5 [S9] inline: isolated render on desktop and phone.

## Log

- L1 (2026-10-31, orchestrator's request for the user): "Design, then build, the way a child session's git work returns to its parent in MassOrca, on desktop and mobile."
- L2 (2026-10-31, user): "Approve, build it".
- L3: Decision: child branch and base commit are an optional `childGit` field in `options_json`, so no schema bump and older hosts ignore it. State is read from git (`--ancestry-path`), so a manual merge also reads as brought back.
- L4: Decision: clients treat a failed status call as unavailable, so an older host shows today's notice.
