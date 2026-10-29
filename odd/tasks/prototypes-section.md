# Prototypes section (v1)

## Objective

One place, on desktop and mobile, to see HTML prototypes produced by any agent chat (Claude, Codex, Antigravity, Pi / Gentle Shell), compare the directions of one request, and iterate on one direction by annotating elements, applying quick edits and sending a single batched message back to the originating chat.

## Problem / why

Prototypes from different agents end up as chat visuals, recorded files or `design/` folders, with no common viewer and no structured way to give element-level feedback. The user wants to review a prototype before implementation and iterate on it from MassOrca, agent-agnostically.

## Approved design (source of truth)

- Design v8, approved by the user on 2026-10-28: https://claude.ai/artifact/MbcyMHTvDduLhAFJnn6Q25
- Local copy of the boards (exact strings and controls): scratchpad `proto/project/*.dc.html` of the design session (`DesktopAsk`, `Main`, `MobileAsk`, `MobileSettings`, `MobileMenu`, `MobileList`, `MobileSet`, `MobileViewer`).
- Fidelity rule (user): implement exactly what v8 shows. No extra labels, hints, helper text, status messages, buttons, banners or components. Anything the build needs that is not on the boards is asked first (see Open decisions). Each slice ends with a fidelity pass.

## Scope

- Settings › Prototypes: "Always make N" (default 2, max 4) or "Ask each time"; shows the line added to the prompt.
- Prompt line: when a user prompt asks for a prototype, append `Produce N distinct design directions, each a self-contained HTML file, with a one-line tradeoff.`
- In-chat "How many prototypes?" 1 / 2 / 3 card when the mode is "Ask each time".
- Aggregated list across chats with agent filters; a set of N directions per request; opening a direction makes it the one being iterated; the side strip / chips peek at siblings.
- Viewer: Desktop / Phone viewport, Browse / Annotate, pins on elements.
- Per-pin Edit (text, text color, fill, width, height with px / % / auto, font size; 2 palette swatches + custom picker + hex) and Note (free form, example chips).
- Auto-draft grouped by pin; reverting a value removes its item; clicking a draft item jumps to its control with a pulse.
- "Anything else" prompt + one Send to the originating chat: `Iterate on B.` + notes + edits + `from C` items + text.
- Desktop entry: Prototypes row at the top of the worktree sidebar. Mobile entry: Prototypes item in the chat ⋯ menu.

## Out of scope (follow-ups)

Padding / margin editor, drag-to-resize, region comments, side-by-side version compare on mobile, editing the file directly, auto-merging parts of two siblings, starring parts across directions (v2), remote sources (claude.ai Artifact URLs, Stitch download URLs) unless the user decides otherwise.

## Constraints

- STYLEGUIDE tokens and shadcn primitives on desktop; `mobile/src/theme/mobile-theme.ts` on mobile.
- SSH and folder workspaces: the execution host owns reads; loss of contact is not an error state we invent.
- Remote wire compatibility: new RPCs and new frame message kinds are additive and optional.
- Desktop strings go through i18n (`translate(key, fallback)`); mobile strings are hardcoded English like the rest of the app.
- TDD: off (source: no project/session TDD configuration). Runner: `pnpm test` (root vitest) and `pnpm test` in `mobile/`. Ordinary functional checks plus typecheck and `pnpm run check:code-quality:changed`.

## Key code (from mapping)

- Visuals: `src/shared/native-chat-visual-directive.ts`, `native-chat-session-summary.ts` (`nativeChatSessionVisuals`), `src/main/native-chat/native-chat-visuals-delivery.ts`, RPCs `agentSession.readVisual` / `agentSession.readRecordedFile`.
- Frame: `src/shared/native-chat-visual-shell.ts`, `NativeChatVisualFrame.tsx`, `mobile/src/session/MobileNativeChatVisualFrame.tsx`, `mobile-native-chat-visual-bridge.ts`. No pick/style channel yet.
- Navigation: `TopLevelView` (`src/shared/ui-chrome-types.ts`), `setActiveView` (`ui-slice-contract-core.ts`), `SidebarNav.tsx`.
- Settings: `GlobalSettings` (`src/shared/global-settings-types.ts`), defaults `src/shared/constants.ts`, sanitizers `ui-slice-hydration-sanitizers.ts`.
- Send: `sendMessageToAgent` (`src/renderer/src/lib/agent-message-send.ts`), `use-native-chat-structured-composer-send.ts`, mobile `mobile-native-chat-send.ts`.
- Cards: `NativeChatApprovalCard.tsx` pattern.
- Mobile: `MobileSessionHeaderMoreActionsSheet.tsx`, Artifacts screens as template, `ActionSheetModal.tsx`.

## Decisions (user, 2026-10-28)

1. Empty list: title + filters, empty area, no text.
2. Loading: blank frame, no spinner or text.
3. Unreadable prototype: one line in the frame, EN "Couldn't open this prototype" (ES "No se pudo abrir el prototipo").
4. Send failure: keep the draft; one line under Send, EN "Couldn't send: the chat is no longer active. Your draft is kept." (ES "No se pudo enviar: el chat ya no está activo. El borrador se mantiene.").
5. Sources: local files only (remote URLs are follow-ups).
6. Prototype request triggers:
   - a. Keywords in the user's own words: prototype, prototipo, mockup, maqueta, wireframe, design and its variants (design, diseño, diseñar, diseña, rediseño…). A keyword-only match always shows the "How many prototypes?" card, even under "Always N".
   - b. MassOrca command `/prototype` (alias `/prototipo`). On an agent with a native design command it is translated to that command plus the N-directions line; otherwise the plain instruction.
   - c. Native agent design commands (names being verified) count as `/prototype` for that agent.
   - Explicit commands (b, c) apply the setting directly; under "Always N" they skip the card.
   - Card dismissal for keyword matches: a 4th button "Not a prototype" (ES "No es un prototipo") that sends the message as typed (user decision A).
   - Keyword detection is a deterministic master lexicon (ES + EN, whole words, case/accent-insensitive): positive terms/phrases (prototype, mockup, maqueta, wireframe; design/diseño/diseña/rediseña only next to a UI noun) and negative context terms that suppress (database, schema, architecture, API, design doc, system design, diseño técnico, data model…). No model calls; table-driven tests.
   - Claude `/prototype` sends the plain instruction (no `/design` translation in v1); Gentle Shell `/prototype` → `/gentle:design`.
7. Capture is deterministic for every agent: MassOrca creates `<chat visuals dir>/prototypes/<requestId>/` with `request.json` (original prompt, agent, chat, count, time); the hidden instruction makes the agent write `A.html`, `B.html`… (self-contained, CSS inline); iterations write `B-v2.html`… Only files under `prototypes/` (plus Gentle Shell's native `design/<slug>/design.json`) are prototypes, and they are excluded from Artifacts / visuals. The injected instruction is never shown in the chat bubble or history.
   - Gentle Shell `/gentle:design` keeps its native `design/<slug>/`: `request.json` records the existing `design/*` slugs at send time, and the slug that appears afterwards in that session's cwd is bound to the request (set difference, keyed by requestId + session). Those files go to Prototypes only.
   - Antigravity: the plain instruction says to write local HTML files in the request folder and not to use Stitch MCP for this request.
   - Codex / Claude / others: plain instruction, local HTML in the request folder.
8. Home-screen / chat-summary entries: none in v1; drop the "Also on the home screen…" line from the menu board.
9. List thumbnails: scaled live render of the prototype HTML.
10. Single-direction request: open the viewer directly; no "All 1", no strip.

## Delivery

Work-unit Conventional Commits on `claude/prototypes-section-f8edf5`, tests with each behavior, no AI attribution. No push, no PR (user's decision). Forecast well over 400 authored lines: PR slicing is deferred to the user; slice boundaries are recorded per task below. SHAs are reported to the parent session per slice.

## Tasks

- [x] T1 Shared model (pure) — `ea10b2e226e`: prototype/set/version types, request grouping, prototype-request detection, prompt line, count setting type + sanitizer, draft model (edit diffs → items grouped by pin, revert removes, note items, sibling items), message composition. Tests. Route: delegated writer (2+ non-trivial files).
- [x] T1c Model rework — `cc593365dee` for decision 10 + lexicon: replace transcript grouping in prototype-sets with a request-folder model (requestId, `request.json`, `A.html` / `B-v2.html` naming, path predicate `isPrototypePath`), hidden instruction builders (initial + iteration), lexicon with positive/negative tables. Supersedes the prototype-sets advisories in T1b.
- [x] T1b Fix T1 review advisories — `76f36b6ede3` (non-blocking, review approved and acknowledged, lineage review-5b2cbb4ae471291e): active-direction note without a pin dropped (prototype-draft.ts:140); "Iterate on" iteration may attach to the wrong set, drop extra visuals, setId not namespaced, header contract unproved (prototype-sets.ts); singular count line and -Infinity count (prototype-count-setting.ts); sibling letter ordering. Route: delegated writer after T3.
- [ ] T1d Fix T1c review advisories (approved + acknowledged, lineage review-8320a2fd37c813cb): Settings line diverges from the sent instruction (prototype-request.ts:141-148; fix in T4 by starting the instruction with the board line); manifest folder trust (prototype-sets.ts:58-64); blank folder guard (prototype-request.ts:158-160); Gentle design set all-or-nothing (prototype-sets.ts:77-83); Gentle Shell model split (prototype-request.ts:93-108); letter range; lexicon scan cost. Route: delegated writer with T4.
- [ ] T2b Persist the Gentle Shell slug binding in request.json on first resolution (decision: persist; avoids rebinding when newer design folders appear) and exclude bound `design/<slug>/` paths from Artifacts on desktop and mobile using the `prototypes.list` result (decision: client-side, both clients already fetch it). Route: delegated writer.
- [ ] T3b Fix T3 review advisories (approved + acknowledged, lineage review-464467637923eb67): mobile relay forwards picked element unchecked (mobile-native-chat-visual-host-document.ts:98-105); touch path neither blocked nor tested (annotate-script.ts:43); mobile frame wiring and host forwarder only substring-tested; shell reader widened for every document (native-chat-visual-shell.ts:272); label fallback uncapped; layout on every mousemove; identity-keyed resend on mobile. Route: delegated writer.
- [x] T2 Host aggregation — `708b82d8844`, `85a7fffd2a1`, `4bc6725ec77`: list prototypes across chats (chat visuals + recorded HTML + Gentle Shell `design/*/design.json`) and read one; additive RPC usable by desktop and mobile; SSH-safe. Tests. Route: delegated writer.
- [x] T3 Frame annotate bridge — `eb3a4f3b203`: new optional message kinds for element pick (selector, label, rect), pins, style overrides and text override; desktop and mobile hosts validate them. Tests. Route: delegated writer.
- [ ] T4 Desktop settings + prompt line + "How many?" card. Tests. Route: delegated writer.
- [ ] T5 Desktop Prototypes view: sidebar row, list + filters, set grid, viewer, strip, annotate panel (Edit, picker, Note), draft, Anything else, Send. Tests. Route: delegated writer(s).
- [ ] T6 Mobile Prototypes: ⋯ menu item, list, swipe set, viewer, Edit/Note sheet, draft sheet, Send. Tests. Route: delegated writer(s).
- [ ] T7 Mobile settings + "How many?" card. Tests. Route: delegated writer.
- [ ] T8 Fidelity pass against v8 for each surface; report SHAs.

## Progress

- 2026-10-28: design v8 approved; mapping done; open decisions sent to the parent session.

## Verification evidence

- T1 (`ea10b2e226e`, delegated writer; trigger: 8 new non-trivial files): `pnpm test` on the 4 test files → 82 passed; `npx oxlint` → 0; `npx oxfmt --check` → pass; `pnpm run typecheck:node` / `typecheck:web` → 0 errors; `ORCA_CODE_QUALITY_BASE=HEAD pnpm run check:code-quality:changed` → passed, 0 new findings (the default `main` fallback fails with ENAMETOOLONG on this branch). Parent spot check: `pnpm test` prototype-draft + prototype-request → 60 passed.
- T1 decisions: native commands verified — Gentle Shell `/gentle:design`, Claude `/design`; Codex and Antigravity have none (plain instruction). `/gentle:design sync|open|stop|implement` are not requests. Orphan visuals form one single-direction set each. Count line reads "1 distinct design directions" for n=1 (singular wording to fix in T4).

- T3 (`eb3a4f3b203`, delegated writer; trigger: 15 files across desktop, shared and mobile): root `pnpm test` annotate/shell/frame → 81 passed (native-chat dirs 5059 passed); mobile annotate/visual tests → 39 + 95 passed; `typecheck:web`, `typecheck:node`, mobile `typecheck` → 0; mobile `typecheck:tests` → only pre-existing baseline errors; `npx oxlint` → 0; `ORCA_CODE_QUALITY_BASE=HEAD pnpm run check:code-quality:changed` → 0 findings. Non-annotate document is byte-identical (SHA-256 pinned in a test).
- T3 notes for T5/T6: keep the original ElementState from the first pick (a re-pick reports overridden values); verify badge placement against v8; screenshots: desktop via `webContents.capturePage(rect)` (unverified), mobile via a native view capture (unverified).

- T1c/T1b (`cc593365dee`, `76f36b6ede3`, delegated writer): prototype test files → 316 passed; annotate tests → 33 passed; oxlint 0; oxfmt clean; typecheck node/web 0; code-quality gate 0 new findings. Parent spot check: lexicon + folder tests passed.
- T1c decisions: set fileName is root-relative to its source (`prototypes/<id>/A.html` vs visuals dir; `design/<slug>/<file>` vs session cwd); zod validation; `isPrototypePath` rejects `.`/`..`; extra direction files beyond the count are kept (cap is a follow-up). T4: the hidden instruction must start with the exact Settings line from the board so Settings shows the truth.

- T2 (`708b82d8844`, `85a7fffd2a1`, `4bc6725ec77`, delegated writer; trigger: host RPCs + clients across 15+ files): host/RPC tests 21 + 5 passed; desktop client 6, mobile 9 + 20 passed; wider root run 429 passed / 2 skipped; typecheck node/web/mobile clean; oxlint/oxfmt clean; code-quality gate passed. A broad `src/main/runtime/rpc/methods` run shows unrelated failures; parent verified `agent-launch-caller-selection.test.ts` fails identically on base `55154cbce39` (1 failed / 12 passed), so it pre-exists.
- T2 decisions (autonomous, sensible defaults): `createRequest` returns `unsupported` for chats without a record or with a non-local (WSL/SSH-relay) location; then the message goes as typed with no prototype capture. Older hosts are detected via `method_not_found`. `readFile` errors map to the one-line "Couldn't open this prototype".

## Next step

T2 (host aggregation) and T3 (frame bridge). Pending user answers: card dismissal control; Claude `/design` translation vs local-only sources.
