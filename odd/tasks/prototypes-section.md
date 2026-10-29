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
- [ ] T2b (also fixes T2 review warnings, lineage review-b100172295cbea25, approved after one correction `ea99509c985`): R1-gentle-design-slug-rebinding src/main/native-chat/prototype-request-disk.ts:38-57; R1-list-cross-session-disclosure src/main/runtime/rpc/methods/prototypes.ts:60-70; R2-client-validation-divergence src/renderer/src/runtime/runtime-prototype-client.ts:47-53; R2-error-vocabularies src/main/runtime/rpc/methods/prototypes.ts:71-76; R2-gentle-shadows-recorded src/main/native-chat/prototype-requests.ts:248-259; R2-journal-filter-untested src/shared/native-chat-journal-changed-paths.ts:34; R2-mobile-reader-duplication mobile/src/session/mobile-prototype-host-rpc.ts:59-65; R2-scan-caps src/main/native-chat/prototype-requests.ts:207-226; R2-unsupported-meaning src/shared/rpc-contract/prototype-params.ts:49-50; R2-unsupported-wording mobile/src/session/mobile-prototype-host-rpc.ts:16-17; R2-visuals-constants-copy src/shared/prototype-artifact-paths.ts:5-7; R3-create-exclusive-write-throws src/main/native-chat/prototype-requests.ts:94-99; R3-design-dir-segments-unchecked src/main/native-chat/prototype-requests.ts:181-188; R3-files-hidden-with-no-listing-view mobile/src/session/mobile-native-chat-recorded-files.ts:58; R3-gentle-replaces-request-files src/main/native-chat/prototype-requests.ts:253-259; R3-journal-exclusion-unproved src/shared/native-chat-journal-changed-paths.ts:35; R4-create-no-rollback-not-idempotent src/main/native-chat/prototype-requests.ts:94-99; R4-list-single-shot-no-partial src/main/native-chat/prototype-requests.ts:103-118; R4-mobile-list-parse-all-or-nothing mobile/src/session/mobile-prototype-host-rpc.ts:87-88; R4-silent-disk-error-swallowing src/main/native-chat/prototype-request-disk.ts:95-101. Persist the Gentle Shell slug binding in request.json on first resolution (decision: persist; avoids rebinding when newer design folders appear) and exclude bound `design/<slug>/` paths from Artifacts on desktop and mobile using the `prototypes.list` result (decision: client-side, both clients already fetch it). Route: delegated writer.
- [ ] T4b Fix T4 review warnings (approved after one correction `86dca94dd8d`, lineage review-62e147735160349b): R1-scanner-trusts-foreign-marker src/main/ai-vault/session-transcript-message-content.ts:18-21; R2-001 src/renderer/src/components/native-chat/native-chat-prototype-request-outgoing.ts:21; R2-002 src/renderer/src/components/native-chat/NativeChatPrototypeCountCard.tsx:6; R2-003 src/shared/prototype-request.ts:68; R2-004 src/shared/structured-agent-session-projection.ts:81; R2-005 src/main/ai-vault/session-scanner-text-normalization.ts:59-63; R2-006 src/shared/global-settings-types.ts:271-272; R2-007 src/shared/prototype-request.ts:137-138; R2-008 src/renderer/src/components/native-chat/use-native-chat-prototype-count-card.tsx:18; R3-card-answer-bypasses-queue-hold src/renderer/src/components/native-chat/use-native-chat-prototype-count-card.tsx:18-23; R3-concurrent-send-silently-dropped src/renderer/src/components/native-chat/native-chat-prototype-request-outgoing.ts:71-73; R3-first-match-marker-leaks-instruction src/shared/prototype-hidden-instruction.ts:62-65; R3-malformed-host-success-aborts-send src/renderer/src/components/native-chat/native-chat-prototype-request-send.ts:46-52; R3-overlong-prompt-degrades-silently-untested src/renderer/src/components/native-chat/native-chat-prototype-request-send.ts:27-29; R4-ask-taken-before-failure src/renderer/src/components/native-chat/native-chat-prototype-request-outgoing.ts:54-55; R4-host-field-throws src/shared/prototype-request.ts:124-125; R4-inflight-latch-no-release src/renderer/src/components/native-chat/native-chat-prototype-request-outgoing.ts:88-90; R4-silent-fallback-command src/renderer/src/components/native-chat/native-chat-prototype-request-send.ts:43-45. Route: delegated writer.
- [ ] T5b Fix T5 state-slice review warnings (approved, lineage review-f7e9bdef49c7bd00): R3-age-nan-fold src/renderer/src/components/prototypes/prototype-list-model.ts:88-95; R3-next-version-unproved src/renderer/src/components/prototypes/prototype-set-view.ts:110-116; R3-screenshot-failure-arms src/renderer/src/components/prototypes/prototype-send.ts:62-73; R3-sibling-screenshot-arm src/shared/prototype-draft.ts:236-239; R3-state-transition-guards src/renderer/src/components/prototypes/prototype-set-state.ts:146-162; R3-status-ignores-count src/renderer/src/components/prototypes/prototype-list-model.ts:67-71; R3-store-invariants-unproved src/renderer/src/components/prototypes/prototype-view-store.ts:26-39. Also: bold letters in the peek banner (board).
- [ ] T6b Fix mobile review warnings (slices approved and acknowledged): R3-blank-screen-for-missing-params mobile/app/h/[hostId]/prototypes/viewer.tsx:14-15; R3-edit-tab-selected-while-peeking mobile/src/prototypes/MobilePrototypePinSheet.tsx:104-111; R3-file-hook-unproved mobile/src/prototypes/use-mobile-prototype-file.ts:22-45; R3-file-read-no-rejection-path mobile/src/prototypes/use-mobile-prototype-file.ts:32-41; R3-missing-version-contradiction mobile/src/prototypes/mobile-prototype-viewer-model.ts:19; R3-number-input-unbounded mobile/src/prototypes/mobile-prototype-viewer-model.ts:83-89; R3-pulse-never-activated mobile/src/prototypes/MobilePrototypeViewerScreen.tsx:218-219; R3-sticky-unreadable-frame mobile/src/prototypes/MobilePrototypeFrame.tsx:33-36; R3-typed-buffers-leak-across-pins mobile/src/prototypes/MobilePrototypeViewerScreen.tsx:203-205; R3-001 mobile/src/prototypes/mobile-prototype-host-chat-send.ts:21; R3-002 mobile/src/prototypes/mobile-prototype-chat-send-registry.ts:32-36; R3-003 mobile/src/prototypes/MobilePrototypeDraftSheet.tsx:106-110; R3-004 mobile/src/prototypes/MobilePrototypeViewerScreen.tsx:141-144; R3-005 mobile/src/prototypes/MobilePrototypeDraftSheet.tsx:91-110; R3-006 mobile/src/session/use-mobile-session-chat-surfaces.ts:120-126; R3-007 tests/e2e/prototypes-remote-runtime.spec.ts:59; R3-009 src/shared/prototype-send.ts:48-53; R3-001 mobile/src/prototypes/mobile-prototype-capture.ts:52-57; R3-002 mobile/src/prototypes/MobilePrototypeFrame.tsx:44-62; R3-003 mobile/src/prototypes/mobile-prototype-iteration-send.ts:52-55. Route: delegated writer.
- [ ] T3b Fix T3 review advisories (approved + acknowledged, lineage review-464467637923eb67): mobile relay forwards picked element unchecked (mobile-native-chat-visual-host-document.ts:98-105); touch path neither blocked nor tested (annotate-script.ts:43); mobile frame wiring and host forwarder only substring-tested; shell reader widened for every document (native-chat-visual-shell.ts:272); label fallback uncapped; layout on every mousemove; identity-keyed resend on mobile. Route: delegated writer.
- [x] T2 Host aggregation — `708b82d8844`, `85a7fffd2a1`, `4bc6725ec77`: list prototypes across chats (chat visuals + recorded HTML + Gentle Shell `design/*/design.json`) and read one; additive RPC usable by desktop and mobile; SSH-safe. Tests. Route: delegated writer.
- [x] T3 Frame annotate bridge — `eb3a4f3b203`: new optional message kinds for element pick (selector, label, rect), pins, style overrides and text override; desktop and mobile hosts validate them. Tests. Route: delegated writer.
- [x] T4 Desktop settings + prompt line + "How many?" card — `3e8212fe2b3`, `7a56286491e`, `70ea29ade1f`, `110f3abda15`. Tests. Route: delegated writer.
- [x] T5 Desktop Prototypes view — `bb4c1c3d908`, `19d4ece7aa6`, `e23c6e1bc7c`, `ae4b684e50a`, `11e82c123a6` (+ lookup fix `1f826e4abbc`): sidebar row, list + filters, set grid, viewer, strip, annotate panel (Edit, picker, Note), draft, Anything else, Send. Tests. Route: delegated writer(s).
- [x] T6 Mobile Prototypes — `302e260b5d2`, `dadf5c8c94d`, `ff35b03aa98`, `9497d8b8ded`: ⋯ menu item, list, swipe set, viewer, Edit/Note sheet, draft sheet, Send. Tests. Route: delegated writer(s).
- [x] T7 Mobile settings + "How many?" card — `d05e2482aa3`. Tests. Route: delegated writer.
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

- T2 review: four lenses; one CRITICAL (scan truncation starved other chats) corrected in `ea99509c985` (per-chat newest-first cap; test with 600 folders in a busy chat); targeted validation approved; acknowledged. Parent fixed broken `node_modules` links (left by a failed install in a temporary base worktree) with `pnpm install --frozen-lockfile --ignore-scripts`.

- T4 (delegated writer; trigger: 58 files across shared, main settings, renderer and i18n): own tests passed; 146 direct-importer test files run in batches, one real regression (composer-draft-lifecycle, 17 tests) fixed; remaining failures are Windows `EBUSY` sqlite temp-file locks in claude/codex/agent-session-wire/runtime-rpc suites and a persistence suite not touched by T4 (not diffed against HEAD); `ai-vault-search` suites need node:sqlite (unavailable here). `typecheck:node`/`typecheck:web` 0; oxlint/oxfmt clean; code-quality gate 0 new findings; localization verify scripts pass.
- T4 fidelity: every string maps to DesktopAsk or the approved "Not a prototype"; Settings box uses the approved single line; settings nav row has a `Layers` icon (every nav row requires one). Placement deviation: the card renders directly above the composer (held-send hook owns it) instead of inside the transcript flow; the held message is not shown as a bubble until a choice is made. Typed text (incl. `/prototype`) is echoed in a `<!-- orca-prototype-typed -->` block so the bubble shows exactly what was typed while the agent never receives a leading `/prototype`.
- T4 leftovers: T1d items in prototype-sets.ts / lexicon (manifest folder trust, Gentle design set all-or-nothing, letter range, lexicon scan cost) move to T2b.

- T4 review: first lineage review-a8524641d671f664 went stale (a doc commit landed mid-review → recovery_authorization_required) and was abandoned per the user rule "Si es traba, abandona, siempre."; a fresh lineage review-62e147735160349b found 3 CRITICAL (hidden marker spoofable from pasted text; Gentle Shell keyword requests lost folder paths; silent in-flight drop) → corrected in `86dca94dd8d` (marker neutralization on every composer send; explicit gentle-design flag; explicit in-flight result + log); targeted validation approved; acknowledged. Rule learned: no commits (doc included) while a review is open.
- Card placement: user approved option A (docked above the composer; held message not shown as a bubble until a count is picked; 'Not a prototype' sends as typed). Approved deviation from DesktopAsk board; mobile uses the same placement. (2026-10-29)

- T5 (delegated writer; trigger: 61 files, host + capture IPC + renderer view): prototype tests 147 + host/client 188 passed; typecheck web/node 0; `tsc -p config/tsconfig.cli.json` 0 (after `1f826e4abbc`, which the parent found missing while packaging); oxlint/oxfmt clean; localization catalogs/extraction pass; code-quality gate 0 new findings. Not verified: a real Electron run (screenshot crop, frame behavior).
- T5 review: whole range exceeded the lens context budget, so it was reviewed in slices from detached worktrees at slice boundaries. Slice A (host + capture, base `a9d8eea7b5b`..`19d4ece7aa6`): resilience lens repeatedly refused by the model provider safeguards → abandoned (review-f1131c3a67d12142) per "Si es traba, abandona, siempre". Slice B (state, ..`e23c6e1bc7c`): approved and acknowledged, 7 warnings → T5b. Slice C (view, ..`1f826e4abbc`): status timed out twice → abandoned (review-8e2614dddf4921e4).
- T5 decisions: no thumbnails in list rows (v8 board has none; set grid and side strip use live renders); direction names/tradeoffs from `directions.json` written by the agent; note screenshots captured on Send and uploaded to the host (`prototypes.writeAttachment`), paths in the message; draft state in memory; list refresh on mount, focus and every 10 s.

- T6/T7 (delegated writer; trigger: mobile screens, sheets, send path, shared refactor): mobile prototype tests 173 passed; mobile/web/node/cli typechecks clean; oxlint/oxfmt clean; code-quality gate 0 findings in its files. Not rendered on a device yet. 10 pre-existing mobile src/session failures (TurboModuleRegistry mock, terminal-agent warnings, a load-sensitive snapshot timeout).
- Mobile decisions (user, 2026-10-29): list chips = desktop chips (All / Claude / Codex / Stitch / Gentle Shell); ⋯ pill shows just the count; cross-chat send goes through the host to the set's own chat (in progress); mobile Settings › Prototypes reachable from the card link only in v1; `/prototype` + `/prototipo` in the mobile slash menu and the in-chat link card added.
- (Superseded: now in scope for pv51) mobile note screenshots with a native capture library (react-native-view-shot or an Expo-compatible equivalent); the APK is built locally, so a native dependency is fine.
- Pending user approval (design only, not implemented): design-system step — https://claude.ai/artifact/71TQ1ookqegnD4xHQyK2ux.

- pv49 QA fix (delegated writer; user QA on a remote VPS runtime): `a1016524f62` lexicon sentence window (≤10 words, flow words block), `6a72cbdf639` `/prototype` in the desktop slash menu (`/prototipo` hidden alias), `31b4e6690be` list/read/write on the runtime that owns the chat + `[prototypes]` fallback logs on desktop and host, `adb9993785e` in-chat link card "<title> · set of N" / "Open in Prototypes ›", `2f856e0e830` paired-runtime e2e test + card width. Root cause: the Prototypes view always read the local host. Verified end to end against a headless paired runtime (background Electron + CDP; screenshots in the session scratchpad `qa/`): card on the NexusCare sentence, request.json on the runtime disk, hidden instruction in host history, link card, set rendered from the remote host. No real agent ran (no Claude login in the isolated profile). Tests 1054 passed; typecheck web/node/cli 0; code-quality gate passed.
- Mobile screenshots moved into scope for pv51 (user, 2026-10-29): native capture library with a web no-op (mobile-web asset budget 169/169).

- Mobile screenshots `c3c7321643d` (delegated writer): react-native-view-shot 4.0.3 (Expo SDK 55) + expo-image-manipulator crop; upload via `prototypes.writeAttachment`; web no-op split (build:mobile-web 193 assets, no capture libs in the web bundle); hand-minimal lockfile. Mobile tests 106 + 18 passed; typechecks clean. Not run on a device (Android WebView capture may come back blank → omitted).
- Merge `4a15f9b9b55` (custom/pv27-unified, conflicts in the mobile ⋯ menu and chat surfaces resolved keeping both sides) and sidebar placement fix `74f8d4c7b32` (Prototypes below Search, Automations row style) — user request via the parent.
- Reviews of mobile + pv49 work, by slices in detached worktrees: screenshots `74f8d4c..c3c7321` approved; `dadf5c8..ff35b03` (viewer) approved; `adb9993..4fca2e3` (draft/send, cross-chat) approved; `ff35b03..adb9993` (pv49 desktop fixes) ended `escalated` (inconclusive, informational, terminal); `a8b2ad8..d05e248` and `d05e248..dadf5c8` got no lenses and were abandoned per "Si es traba, abandona, siempre". Branch-wide candidates (810–1031 files vs custom/integration) declined like whole-fork ones.

## Next step

T2 (host aggregation) and T3 (frame bridge). Pending user answers: card dismissal control; Claude `/design` translation vs local-only sources.
