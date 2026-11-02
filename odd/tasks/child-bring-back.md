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
- S10: One policy input decides automatic bring back, from the parent's resolved access. `ask`: Ask for approval (user, verbatim: "Yes, always ask"), Accept edits, Plan, Read only, and any access the host cannot resolve. `auto`: Auto. `full`: Full access. Bot teams will pass `full` with no new code path.
- S11: `auto` merges by itself only when the child finished successfully with commits, the parent has no active turn and no uncommitted changes, and no conflict is predicted. Otherwise the notice asks, as in the manual slice.
- S12: `full` never asks. The merge waits for the parent's turn to end, uncommitted parent work asks the parent agent to commit first, and conflicts stay open for the parent agent to resolve. No automatic stash and nothing discarded.
- S13: The host runs automatic merges one at a time per parent worktree.
- S14: The parent agent is told what entered its tree.
- S15: On Git without `merge-tree --write-tree`, `auto` tries the merge and aborts it on conflict, leaving the notice to ask.
- S16: New copy comes from the approved `Automatic` artboard only: `Brought back automatically into {branch} · {sha}`, `Will bring back when the parent session stops.`, `Asked the parent session to commit first.`, `The parent session is resolving these.`, `Merging hit conflicts, so it was undone.`

## Tasks

- T1 [S2 S3 S4 S6] inline: host status, merge, abort and resolve, with real-git tests.
- T2 [S1 S6] inline: RPC methods, capability, mobile allowlist, child git capture at launch.
- T3 [S1 S3 S5 S7] inline: desktop notice.
- T4 [S1 S3 S5 S7] inline: phone notice.
- T5 [S9] inline: isolated render on desktop and phone.
- T6 [S10 S11 S12 S13 S14 S15] inline: host policy, queue, finish and turn-end triggers, parent message, with real-git tests. Done, ab25bfcb4c0.
- T7 [S16] inline: automatic copy on desktop and phone. Done, ab25bfcb4c0.
- T8 [S9 S16] inline: isolated render of the automatic states. Done, see L9.

## Log

- L1 (2026-10-31, orchestrator's request for the user): "Design, then build, the way a child session's git work returns to its parent in MassOrca, on desktop and mobile."
- L2 (2026-10-31, user): "Approve, build it".
- L3: Decision: child branch and base commit are an optional `childGit` field in `options_json`, so no schema bump and older hosts ignore it. State is read from git (`--ancestry-path`), so a manual merge also reads as brought back.
- L5 (2026-10-31, user, relayed verbatim by the orchestrator): "O sea yo pensaría que tiene sentido según el nivel de access que se elija, si tiene un access conservador, entonces que le pregunte hasta por la cantidad de pelos en la cabeza, pero si vas en modo full access, no tiene sentido que te pregunte, se hace en automático y ya entre la sesión padre y el hijo se arreglan entre ellos. El modo "auto" o por defecto ya es distinto, allí la opción "brick back automatically" está activa, pero siempre y cuando se cumplan las condiciones que dices, sino aparece el mensaje para que el usuario decida. Y en el Bot Teams, definitivamente nunca debería aparecer esos mensajes, serían como un full access en ese aspecto"
- L6: Second slice proposed, awaiting approval of the `Automatic` artboard and the mapping of `default` ("Ask for approval"). Not built.
- L4: Decision: clients treat a failed status call as unavailable, so an older host shows today's notice.
- L7 (2026-10-31): T1 to T4 done in f3b3327d2b1, d642e64feed, f173e0b01f2, ea3d9cc4659. T5: real host and real git in a hidden e2e Electron; phone is the real notice components on a react-native-web bundle at 390 px with RPC forwarded to that host. Passed on both: merge, conflict and abort, parent uncommitted, untracked folder count. Not verified: natural delegated flow, parent-working block, Resolve with AI, Review conflicts, Open child chat on the phone, a device, Git 2.25, WSL, SSH.
- L8 (2026-10-31, user, on whether "Ask for approval" counts as conservative): "Yes, always ask". Taken as approval of the `Automatic` artboard too, since that was the one open question on it.
- L9 (2026-10-31): T6 and T7 done in ab25bfcb4c0. T8: hidden e2e Electron and the real phone notice at 390 px, real git, finish path driven by the host's restart reconcile, access set in each parent's stored record because `agentSession.create` refuses `accessMode`. Passed on both: Auto clean merges; Ask for approval asks; Auto with dirty parent asks; Auto with predicted conflict asks and leaves the parent alone; Full clean merges; Full dirty asks the parent agent and keeps its file, then merges after it commits and the host restarts; Full conflict stays open with the parent told. Unit tests only, with real git: `Will bring back when the parent session stops.`, retry at a parent's turn end, `Merging hit conflicts, so it was undone.` Not verified: a real agent turn end, a parent agent acting on the messages, a natural delegated flow, a device, Git 2.25, WSL, SSH. Known limit: a turn ending with no outcome (crash) emits no completion, so the merge waits for the next turn or restart, and the notice shows Bring back meanwhile.
- L10 (2026-10-31): Independent verifier found one blocker, S12: under Full access a child finishing during a sibling's open merge fell to the manual notice for good. Fixed in d10d82d5c4d with a real-git test; it now waits and retries at the parent's turn end. Native review of 2585cdacf1f..d10d82d5c4d (risk, resilience, reliability lenses): approved and acknowledged. Left as advisories: a person's manual merge during an automatic attempt can read as automatic; a failed message to the parent is not re-sent; under Auto a second child finishing right after the first sees the parent working, because the first merge's message starts a turn, so it asks. The render predates this fix, which only changes the host path covered by that test.
- L11 (2026-10-31, read-only on the VPS preview): first real runs, deleg_0446ddedd5d0 and deleg_7545053b2f10, both parents Full access. Each finish saw the child still in its turn, which ended 8 to 15 seconds later, so `child-finishing` was right at that moment. Both were prototype requests whose files went outside the worktree, so the child had no commits and nothing to bring back. Defect: a settled status left the waiting mark in place, so a later commit in the child would have merged unasked on the next restart. Fixed: a settled status now moves a waiting mark to `notice`. Those rows cannot show whether the child's turn-end event arrived, because both outcomes left the same mark; after this fix, `notice` on such a row proves it did.
