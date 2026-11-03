# Checklist card

Shared checklist in native chats that both the agent and the person tick; the agent reads the person's ticks, notes and screenshots on its next turn.
Branch: claude/checklist-card (from custom/pv27-unified 8cb0a940dcd). Delivery: single PR slice per unit commit, merged by the parent session. Runner: vitest (`pnpm test <path>`).
Boards (approved 2026-11-02): https://claude.ai/artifact/RSW5BkKUDK94wGd8jfYzME

## Specs

- S1. "Una tarjeta de checklist, se parece bastante al plan, pero en vez que el sólo el agente lo marque como listo, también el usuario podría marcarlo como listo y el agente puede ver qué ha ido avanzando el usuario, sirve bastante para temas de QA y comprobaciones." Name: "Checklist".
- S2. The agent creates and updates the list with a fenced ```orca-checklist block in its reply (`- [ ]` / `- [x]` items, optional `title:` line). Works for every agent MassOrca runs, Gentle Shell included; the block format rides with the agent instructions every structured agent receives (L7).
- S3. The person checks/unchecks items, adds a note and screenshots per item, from desktop and phone. State lives on the host, so paired and SSH hosts work; an older host without the methods leaves the card read-only.
- S4. Each item shows who checked it and when ("Checked by you · 14:02", "Checked by <agent> · 13:52"); the latest of agent and person wins.
- S5. Changes the agent has not seen go with the person's next message as one text block (screenshots as host paths in that text, see L5); "Send now" sends them alone. The transcript shows that block as a chip, not raw text.
- S6. Desktop placement (boards Desktop 1-3): card in Chat summary directly under Plan; inline "Checklist" row in the transcript where the block was; click opens the summary with the card expanded; hover an item → note / screenshot buttons → inline editor (Attach screenshot, paste, drop) → Save.
- S7. Phone placement (boards Phone 1-4): inline Checklist row in the chat and ⋯ → "Checklist" under Plan (only when a checklist exists, hint "3 of 7") open a Checklist sheet (the ⋯ item shows from session start, hint "No items" when empty, see L7); tapping an item opens the item sheet (Checked, Note, Screenshot, Cancel/Save); Summary lists it under Plan.
- Assumptions (open questions answered with the recommended defaults, user approved boards): one checklist per chat (the latest block's title wins), check + note only (no "Failed" state), the person can also add and remove their own items (L7).

## Tasks

- [x] T1 [S2 S4] shared parser, merge and update-block text — inline — f40b4cda0e6
- [x] T2 [S3 S5] host store, agentSessionChecklist RPC, mobile allowlist, capability, send prefix — inline — f40b4cda0e6
- [x] T3 [S2] agent skill + Pi/Antigravity instructions — inline — f40b4cda0e6
- [x] T4 [S5 S6] desktop UI — delegated writer (parallel with T5, disjoint surface src/renderer) — 6e7df231a21
- [x] T5 [S5 S7] mobile UI — delegated writer (parallel with T4, disjoint surface mobile/) — 16bed1de605

## Log

- L1 (2026-11-02, user): "hay que agregar algo a workspaces, porque es algo que te falta a ti y a todo el mundo. Una tarjeta de checklist, se parece bastante al plan, pero en vez que el sólo el agente lo marque como listo, también el usuario podría marcarlo como listo y el agente puede ver qué ha ido avanzando el usuario, sirve bastante para temas de QA y comprobaciones. La tarjeta podría llamarse Checklist, QA o lo que sea."
- L2 (parent session): placement is a new card in Chat summary directly below Plan, with a short inline reference.
- L3 (user): "En desktop y mobile no se entiende bien el workflow, en mobile cómo se llega al click list, en desktop, cómo se agregan comantarios y screen shots." → boards v2 with entry points.
- L4 (user): "Approve boards".
- L5 (2026-11-02): screenshots reach the agent as host paths inside the update text, not image blocks, because ACP refuses image blocks for agents without image prompts. Send injection claims the update per clientOperationId so a retried send stays byte-identical; a refused send releases it.
- L6 verification: 51 root tests (shared, store, send, desktop card/row/replies, summary) pass; mobile src/session 7 new/changed test files pass; `pnpm tc` clean; changed-code quality gate clean. Known environmental failures: src/main/pi (node:sqlite unavailable in the bun runner) and 4 mobile session test files that also fail at the base commit. Not done: locale catalog entries (catalog check already fails at base), live app check on desktop and phone, Engram mirror pending.
- L7 (2026-11-02, QA pv76 via parent): "No aparece la tarjeta de checklist al inicio de la sesión." and Antigravity on the paired VPS made no checklist. Cause: the format rode only with the inline-visuals skill (off with the visuals setting or a missing visuals folder). Fix: CHECKLIST_INSTRUCTION_LINES join the agent instructions (Claude, Codex, ACP, Antigravity via --add-dir AGENTS.md, Gentle Shell); card always shown with empty state; setItem add/remove. Real agy 1.4.12 run with those instructions wrote an orca-checklist block and read an update block. Boards Desktop 4 and Phone 5 added. Commits a8544b40952, 04ebbd4e1a7, d60fe8ddf42.
