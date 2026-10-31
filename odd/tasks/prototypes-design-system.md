# Prototypes — design system

## Objective

Give every project in Prototypes a design system (tokens + components) that every direction is built on. Show it above the project's sets, let the user edit tokens and components into one draft sent to the agent, and ask before a prototype request whether to use it (or propose one first).

## Approved design (source of truth)

- Approved by the user on 2026-10-29 ("Aprobadísimo"): https://claude.ai/artifact/71TQ1ookqegnD4xHQyK2ux
- Local boards (exact strings, controls, draft logic in each board's script): `C:\Users\palom\AppData\Local\Temp\claude\D--projects-massorca--claude-worktrees-prototypes-section-f8edf5\6be1c7d5-f1dd-46ce-84c6-d4ac85509d23\scratchpad\ds\project\` — `Main.dc.html` (desktop view), `Flow.dc.html` (request card, palette review, directions), `MobileList.dc.html`, `MobileSystem.dc.html`, `canvas.json` (notes n1–n3: storage, decisions, hidden instruction).
- Fidelity rule (user, verbatim): "por favor, que no ocurra como otras veces que implementan labels o componentes que están fuera del prototipo." Every string and control comes from the boards. Board sample data (nexuscare, Liquidaciones, Codex, 14 components, 2 sets…) is replaced by real data. Anything else needed is listed under Decisions; nothing beyond that list.

## Scope

- Storage in the project: `design/system/tokens.json`, `components.html`, `system.md` (note n1). Project root = nearest folder at or above the chat's launch directory that holds `.git` (file or folder); otherwise the launch directory (folder workspaces).
- Host: read the system of a chat's project; summarize systems per project in `prototypes.list`; record the system version a request was built on.
- Request flow (desktop): system card before sending a prototype request; hidden instruction n3 appended; chat link card for proposals.
- Desktop: project groups in the list with a pinned "Design system" row; the Design system view (Tokens / Components / Source, selection panel, draft, Send); palette review for a proposed system; "built on vN" in set rows and "Built on Design system vN ›" in the set header.
- Mobile: project groups with the Design system row; "built on vN" on set rows; Design system screen with token, component and add sheets; send.

## Out of scope (follow-ups)

- System stored in the request folder when the project has no writable folder (n1 last line).
- Mobile request card and palette review (no mobile boards).

## Data contracts

### tokens.json (W3C design-tokens shape)

Groups `color`, `type`, `space`, `radius`, `shadow`, `motion`; each leaf `{ "$type"?, "$value": string, "$description"? }`. Type leaves may carry `"$extensions": { "massorca": { "weight": 600 } }`. Root metadata:

```json
"$extensions": { "massorca": {
  "version": 2, "status": "detected" | "proposed", "agent": "Codex", "updatedAt": "2026-10-29",
  "history": [{ "version": 1, "status": "detected", "at": "2026-10-21" }],
  "sources": [{ "path": "src/assets/main.css", "took": ":root and .dark → 8 colors, radius base 10px" }],
  "palettes": [{ "id": "A", "name": "Calm blue", "note": "Neutral grays, one blue accent for actions", "swatches": ["#2563eb","#0f172a","#f8fafc","#16a34a"], "tokens": { "color.primary": "#2563eb" } }]
} }
```

Token ids are `group.name`. CSS variable of a token: `--group-name` (dots → dashes). Token count = number of leaves.

### components.html

A `<style>` block plus one `<section>` per component:

```html
<section data-component="Button" data-variants="primary secondary disabled"
  data-variant-options="primary secondary disabled hover loading"
  data-bind-background="color.primary" data-bind-radius="radius.md" data-bind-text="type.body">…</section>
```

Markup uses `var(--bind-<prop>)` for bound props and `var(--<token css var>)` otherwise. MassOrca previews each section in its own script-less sandboxed frame: `:root` token variables (draft values applied), the file's `<style>`, and the section with `--bind-<prop>: var(--<bound token>)` (draft bindings applied).

### Hidden instruction (n3, verbatim, then the format)

Appended to every prototype request except "Skip": the n3 text, followed by a short format section describing the two contracts above (it is never shown in the chat).

## Decisions (needed by the build, not on the boards; defaults taken under the parent's "resolve non-blocking decisions with recommended defaults")

1. Project group label: repo display name (desktop via `worktreeId`); host also returns `projectName` (repo folder name, resolving linked worktrees to their main repo) for mobile and for sets without a repo.
2. Existing v8 row content (age, agent badge, filters, mobile scope) stays; the board adds group headers, the Design system row and the ` · built on vN` suffix.
3. Swatch icon (list row, detected only, as on the boards): `color.primary`, `color.border`, `color.muted`, `color.success`, filled from the other color tokens when missing. Request card swatches: primary, foreground, muted, success, same fallback.
4. Type sample text: the token's `$description`, else its name capitalized ("Display").
5. Token value swatches: the original value and the draft value (one when equal); the custom swatch opens the existing picker. Only color, type, space and radius tokens are selectable (shadow and motion are display-only, as on the board).
6. "Used by N components · M sets": N = components whose bindings name the token; M = sets of the project built on the current version. Component "used in M sets" uses the same M.
7. Binding options: tokens of the same group as the bound token. Mobile Edit shows the color bindings only, each labelled "{Prop} token" (Button → "Background token" as on the board).
8. Send target: the chat of the project's newest set; the agent label is that chat's agent. With no set, Send is disabled.
9. Send message: `Update the design system to v{n+1}.`, then a `Design system · tokens` group and a `Design system · components` group with item lines `{label}: {text}`, then (when checked) `Rebuild {titles} on v{n+1}.`, then the free text. Hidden instruction: file paths, bump version and history, and for rebuild the set folders with the next version names. Success clears the draft; failure keeps it and shows the v8 send-failure line.
10. "Re-detect from project" sends `Re-detect the design system from the project.` with the n3 hidden instruction through the same chat.
11. Request card: "Use it" and "Propose one first" send the request with the n3 instruction (the agent detects or proposes and stops); "Skip" sends without it; "Review first" opens the Design system view and leaves the card pending. Shown once per request after the count card. A proposed system shows the existing-system card. Card line: "v{n} · {count} tokens from {source names}. {The direction will use it. | Both directions will use it. | All {n} directions will use it.}"
12. Chat link card for "Propose one first" requests: "Design system · proposed" / "Review ›", opens the Design system view.
13. Palette review (proposed system with palettes): the Flow column-3 panel replaces the selection section of the desktop side panel. "Approve {name}" sends `Use the {name} palette for the design system.` with a hidden instruction to apply it, set status `detected`, and make the directions of the pending request. "Adjust tokens" opens the Tokens tab.
14. Mobile draft review: the v8 draft sheet layout with the desktop rebuild line, "Anything else" and "Send to {agent}". The bottom bar shows only when there are changes.
15. Mobile requests send with the n3 instruction (no card).
16. Desktop set header: "Built on Design system v{n} ›" under the title when the set records a version.
17. Groups are keyed by the host's `projectKey` (one per project root) and labelled `projectName`; two linked worktrees of one repo are two groups, because each has its own `design/system/` files.
18. `builtOn` for a request sent with "Use it" or "Propose one first" before any system existed: the host records the system's current version in `request.json` the first time `prototypes.list` sees one (same persist-on-first-sight rule as `gentleDesignSlug`).

19. A project's system is listed even when the project has no listed set (a "Propose one first" request has no direction files yet). Each `designSystems` entry carries the newest pending propose request (`requestId`, `sessionId`, `agent`): a request with `designSystemMode: 'propose'` and no direction files. "Approve {name}" targets that request and is disabled when there is none; the draft's send target falls back to it when the project has no set.
20. An unreadable design-system file is logged once per file version (path + mtime + size), not on every list refresh.
21. Header subtitle uses "from 1 source" for one source (plural otherwise).

## Constraints

STYLEGUIDE tokens and shadcn primitives on desktop, desktop strings through `translate()`, mobile theme tokens and hardcoded English on mobile. SSH and folder workspaces: the host owns reads and derives the project root from the chat record (clients never send paths). Additive optional RPC fields, regenerated params catalog. TDD off (source: no project/session TDD configuration); runners `pnpm test`, `mobile/ pnpm exec vitest run`.

## Delivery

Work-unit Conventional Commits on `claude/prototypes-section-f8edf5`, no push, no PR, no AI attribution. SHAs reported to the parent session. Forecast well over 400 lines: slice boundaries per task.

## Tasks

- [x] DS1 — `a27c153be8f`, `ccf3890df54` — Shared model + host: token/component parsing, draft model + message, hidden instruction, preview document, project root + name, `prototypes.readDesignSystem({sessionId})`, list summaries + `projectKey`/`projectName`/`builtOn`, request mode + version in `request.json`, clients (desktop + mobile). Tests. Route: delegated writer (2+ non-trivial files).
- [x] DS2 — `1d3b3c13ce5`, `f08564abc2b`, `b89c87050b2`, `6916928e4ae`, `cf99aab9a57`; DS1 review fixes (R3 swatch length, R4 unreadable files) `6d706196a10` — Desktop: list groups + Design system row, Design system view (tabs, selection panel, draft, Send, Re-detect), palette review, set header link and row suffix. Tests. Route: delegated writer.
- [x] DS3 — `181fb4845df`, `d31d7a9883b`, `c2142bc309f`, `35e473ddb49`; review fix (R3 stale manifest rewrite on DS2 slice 1) `988631ae69d`; incremental-reuse instruction (user requirement 2026-10-29: build the system once, change it only incrementally) `d3cc593b4d0` — Desktop request flow: system card, n3 instruction, link card, Decisions 19–21.
- [x] QA1 — `5d5bd7cbadc` — (pv53) Pins persist only when something changed; untouched pins are dropped when the selection moves or closes (shared reducer). Tests. Route: delegated writer.
- [x] QA2 — `7f1cd50df0a` — (pv53) Inspector shows every control: nested text read and rewritten through the single text leaf, clicks on inline children climb to the nearest button / label / link / role=button, no silent drop of deep elements (selector cap). Tests for label and button cases. Route: delegated writer.
- [x] QA3 — `2825a9912a2`, test typing `2152cda1900` — Panel collapse (approved 2026-10-29, artifact 4KG3VobcJAegnPAomKsMG1): desktop icon button after Browse / Annotate, aria-label Hide panel / Show panel; hidden panel gives the prototype full width and keeps the draft; picking an element or pin reopens it. Mobile unchanged. Route: delegated writer.
- [x] QA4 — `1c036f9a126` (removed: desktop `/prototype` description "Make HTML prototypes of an idea"; mobile `/prototype` `/prototipo` description "Make prototypes to compare" and hint "<what to design>"; viewer header suffix " · iterating X"; added board aria-labels "Width unit" / "Height unit"); re-detect steps `2acafb85d84`; DS3 slice-5 review fix (proposal gate tests) `a0789a7effa` — Fidelity removals from the audit (slash-menu descriptions desktop + mobile, viewer-header " · iterating X" suffix; add the board's "Width unit" / "Height unit" labels). Open items sent to the user. Route: delegated writer. Tests. Route: delegated writer.
- [x] MM1 — `88d363f0fc8`, `26e4722f07a`, `ae94ba2ae28`, `90dd5e13e82`, `0928f486869`, `9defe30de41`; toolbar (pv54) `91acfb35bb3`, `712348f33eb`, `736d573630f` (controls wrap by group; viewer is 410 px at 1280 and 570 px at 1440 with the panel open) — Desktop main direction + merge (design v6 approved 2026-10-29 "Listo, aprobadísimo", artifact C7fQd5S4v5UXVk5fW5XX6M boards 1–5): main-first strip with read-only children nested under it; "View all" / "Design main"; View all clicks only open; "Back to main" (primary) / "Make main"; read-only directions show properties disabled under "Properties · read-only", no notes or edits (sibling "from C" notes removed); a former main keeps its edits and notes visible read-only; amber star per direction (new token --status-amber #f59e0b) + "Merge (n)" disabled below 2; merge review (agent-suggested source per part, segmented source, suggested/changed/left out, leave-out checkbox, plan preview, Anything else, Cancel / Merge into D); merged direction joins as the main, stars clear. Route: delegated writer(s), after QA1–QA4.
- [x] MM2 — `4adb90ef77f`, `23f104feb7b`, `d5e8ac7afc2`, review fix `6befe1fa30b` — Mobile main direction + merge (boards 6–10 of v9, approved 2026-10-29 "Sí, dale, aprobado"): set screen with main-first strip, stars, Merge (n), tap only opens; read-only viewer with Back to main / Make main and the read-only properties sheet; merge review sheet with Parts / Preview tabs; result. After MM1. Route: delegated writer.
- [x] MM1R — `a4bd475159f` — Review fix R3-stale-plan-accepted (MM1 slice 26e4722f07a..0928f486869, lineage abandoned): use-prototype-merge-plan.ts accepts any parsed merge-plan.json without checking it belongs to the awaited merge; use isPlanForRequest / plan id. MM1 slice dfe14572d69..26e4722f07a ran no lenses; re-review it with the fix.
- [x] HDR — `78b5c2121cf`, one-star Merge label `eed71a34bcc` — Icon-only viewer header (user asked for a prototype first, 2026-10-29): design https://claude.ai/artifact/KoyEEMTTKqFWYrPPfvPs18 approved 2026-10-29 ("aprobado"): icon-only controls (Merge = star + count; View all / Design main, Desktop / Phone, Browse / Annotate as icons), names as accessible labels and hover/focus tooltips, panel toggle after Browse/Annotate, one line at 410 and 570 px with the panel open, title truncates. Verify with rendered screenshots.
- [x] DET — lexicon `2ab1389bbd1`, word families `8751209b59c`, delegated child seam `f6fa7772c79` + tests `d966abc3efa`, resolver fallback `e32f21373c1` — (pv54) Design-word detection: inflections (diseñe, diseñar, diseño, rediseño, …) and bounded typo tolerance (Damerau-Levenshtein ≤ 1 on tokens ≥ 5), real ES/EN phrasings in tests; a parent asking a child session to design: option (A), user decision 2026-10-29 — the child gets the prototype request with the Settings count (Always N or the Ask default), no card, starts right away; the set belongs to the child's agent.
- [x] ATTR — desktop `e719b287f20`, `f05d07bb941`; mobile `1f2ec33c2f0`, `502d0953db3` (parent name from taskTitle, then displayName; hidden when absent) — Attribution (user confirmed 2026-10-29): a prototype made by a child session is attributed to the child's agent, with the parent chat stored as its origin (data now). Visible origin link approved 2026-10-29 ("aprobado ambos", https://claude.ai/artifact/XamwGEJWqaLRSqg9sAHB1r): desktop line under the title credits the child's agent and chat, "open chat ↗" + "· from “<parent chat>” ↗"; mobile set subtitle adds "· from “<parent chat>” ›"; sets made directly in a chat unchanged. Own commit after MM1R and HDR.
- [x] DSV — `5bbf5e4aae9` (card read shares the 20 s request budget; read and listing already worked on the owning runtime) — (pv54) Design-system visibility: the user cannot find the design system; check the entry point and conditions (incl. remote-host projects) and fix discoverability within the approved design.
- [x] DS4 — `c8ef511021b`, `65a994abfdb`, `9d9211df23b`, `d28b2135830`, `77c9062a854`, `aa8836fb448`, `b796ab9528e`; Decision 15 (gated on the host listing designSystems) `266a7149b7f` — Mobile: list groups + row, set suffix, Design system screen with sheets and send, n3 on requests. Tests. Route: delegated writer.
- [ ] DS5 Fidelity pass on every surface; checks; report SHAs.

## Progress

DS1 done (shared model, host read RPC and list summaries, clients). Found in passing: the phone allowlist lacked `prototypes.writeAttachment`, so v8 mobile screenshot sends were refused — fixed in `bb25bf7b181` with the allowlist test updated.

## Verification evidence

- DS1: tests 152 shared + 138 host/renderer passed; typecheck:node/web, tsc cli, mobile typecheck, oxlint/oxfmt, code-quality gate clean. Review lineage review-089f1c84b09d24a5 asked for one correction (R3, R4); fixed on the branch in `6d706196a10`, lineage abandoned (this session cannot write into the review worktree).
- DS4: mobile typecheck; src/prototypes + host rpc 34 files / 279 tests; node/web typecheck; code-quality gate (base 7ebe7089a5b) clean; build:mobile-web 201 assets / 25 routes.
- DET/ATTR/DSV: reviewed in slices eed71a34bcc..e32f21373c1 and ..5bbf5e4aae9, approved and acknowledged.
- QA1–QA4: root prototype suites 52 files / 864 tests; typecheck node/web/cli + mobile; oxlint/oxfmt; code-quality gate (base 9058360928e) clean; build:mobile-web 193 assets. Reviews: DS2/DS3 slices 1–4 approved and acknowledged; slice 5 correction (proposal gate tests) fixed in `a0789a7effa`, lineage abandoned.
- DS3: focused vitest 19 files / 252 tests; typecheck node/web/cli, verify:rpc-params-catalog, oxlint/oxfmt, code-quality gate (base 867f326d703) clean; mobile typecheck + 23 files / 141 tests. Localization verify scripts fail on base findings outside DS3.
- DS2: focused vitest 20 files / 194 tests passed; typecheck:node/web, tsc cli, oxlint, oxfmt, code-quality gate (base 964f3e193f7) clean. `verify:localization-extraction` fails on the base commit too (51 keys missing from en.json, none from this work).

## Next step

Restart after the 2026-10-29 crash: MM2 writer resumed with its uncommitted set-screen work; MM1 reviews restarted (slice boundaries keep each module with its tests); diagnosis for DET/DSV resumed.

QA1–QA4, then DS4. Pending user approval: main-direction + merge design (artifact C7fQd5S4v5UXVk5fW5XX6M).

## pv56 QA (2026-10-30)

- [x] Design system for worktree chats: host resolves the workspace when the record pins no launch directory (`1490e2ab984`). Rendered: list, screen and "No design system" card.
- [x] Delegated capture and credit: `c0a82130533`, `574c28f7a52`, `469c1eb4856`, `39e6668cf11`. Unit tests only. Terminal children get no first prompt.
- [x] Desktop QA: `dd389dd803c`, `6a923d410c0`, `4604a58a972`, `69a066bce7b`, `7a831a2e7cb`, `f13f3ac68c6`, `f0a4c523a0c`. Rendered before the header rework.
- [x] Mobile QA: `cdda5fb9934`, `6d224e6eb2e`, `dea0b49cd82`, `6eaf1e99bde`, `6a296129c44`, `cd6e976e203`, `519b5e66d24`, `bbe92db405a`. Not rendered.
- [x] Archive and delete: `5872b3eaa7e`, `193ac6b39c4`, `afd498c88b5`, `35a7f5a5170`; sweep keeps requests `15770cb1869`.
- [x] Narrow header and Spanish archive strings: `f28440a07a4`, `99249f06820`. Not rendered.
- Review: slices up to `469c1eb4856` approved. Later slices ran no reviewer lenses after the reboot.
- Design choices for review: https://claude.ai/artifact/LokvPTZC85njupM8ktSX6Z

## pv57 Components editing (2026-10-30)

Approved design reference: the pv57 scratchpad page `design-system-components-edit.html` (fake colors and text; the real values come from tokens.json and components.html).

- [x] E1 — `c7d4842af35` — The annotate frame reports each picked element's own design (its file values, with the frame's own overrides taken off) and its ancestors; overrides may set an allowlisted set of CSS properties; a pin may draw its outline without a badge; a chat visual may opt into a nonce-only script policy.
- [x] E2 — `dd48e8e8789` — Element model and draft: locators relative to the section (`elementLocatorOf`), the rows each kind offers, token binding by value, the CSS a draft edit becomes; per-element edits keyed by locator in the draft, a value back at its original drops out, an older draft reads as none; each edit is one item of the message.
- [x] E3 — `8607beb1c8e` — Aside for a picked element: rows per kind, token chips that collapse to four with `+N more` and keep the bound token, custom swatch and hex for colors, number and px / % / auto sizes, B / I / U, align, breadcrumb back up the component, text-only hint, a note per element. The Annotate panel now shares its unit group and field classes instead of copying them.
- [x] E4 — `8ee50475c0b` — Components tab: each card renders the component live in the annotate frame under a nonce-only policy; clicking an element picks it (hover and selected outlines are the Annotate ones); draft edits apply live; Grid (two compact cards, per-card full-size toggle), Collage and List, with the choice remembered per viewer; a rule under the Design system row.
- [x] E5 — `fb898b05fff`, `5e5102bb8b8`, `323e36a8553` — Collage fits each card to its content: the frame answers a measure request with its natural width and section readout (validated and bounded); cards span the columns and rows their width and height need, dense flow fills the gaps, narrow containers take full width. The whole component's Gap and Padding rows are offered on a card click. A Font row with no font tokens shows its value. New keys added to en.json.
- [x] E6 — Render check in the Electron app (2026-10-31): done on an isolated profile (`ORCA_E2E_USER_DATA_DIR` set to a fresh temp dir, Playwright's own ephemeral debugging port, headless window; the user's Orca was never connected or stopped). The check found two bugs, fixed in E7. Results are under Render check below. The earlier attempt failed because `ORCA_USER_DATA_PATH` is a CLI variable; the app reads `ORCA_E2E_USER_DATA_DIR`.
- [x] E7 — `7938c375e66`, `fa4d382e8d1` — Render-check fixes. Picks inside a card were dropped: the frame reports `html > body:nth-of-type(1) > section ...`, which the locator refused (fixed in the locator). Collage and List cards kept the chat visual's 80 px height floor; design system cards now take their content height (the floor stays an option of the height governor; chat visuals keep 80 px). Tests for both.

Verification evidence:
- `pnpm tc` exit 0 after the last source change (typecheck node, cli, web).
- Shared: annotate script, annotate design, design-system element/draft/preview/message suites: 19 files, 292 tests passed.
- Renderer: design system view, aside, rows, view mode, list panel, edit panel: 6 files, 73 tests passed (run with `config/vitest.config.ts`).
- oxlint and oxfmt clean on the changed files. The `max-lines` rule forced the draft and the components tab into smaller modules; no disable was added.
- `pnpm tc` exit 0 after each fix (E7). `pnpm test src/shared/prototype-design-system-element.test.ts`: 14 passed. `pnpm test` on the governor, shell, `NativeChatVisualFrame` and design system view tests: 4 files, 70 passed. `ORCA_CODE_QUALITY_BASE=custom/pv27-unified pnpm run check:code-quality:changed`: 0 new findings.

### Render check (2026-10-31)

E2E build (`electron-vite build --mode e2e`), isolated profile, one seeded project with `design/system/` and a chat with two prototype requests. Screenshots in `scratchpad/pv57/render/`.

- 1 Variants: pass. Variant chips toggle; the caption and the draft update (`Button: add hover state`, `Button: drop disabled state`). Editing the primary fill (`rgb(22, 163, 74)`) leaves the secondary at `rgb(241, 245, 249)`. Open: dropping a state does not hide its element in the preview; the state only reaches the draft.
- 2 Kinds: pass. Rows per picked kind match `DESIGN_ELEMENT_ROWS`: button (fill, text color, border; radius, border width, shadow; width, height, padding; font, size, style, align), badge (no width, height or align), text (color; width; font, size, line height, style, align), box (fill, border; radius, border width, shadow; padding, gap). The component root shows Layout rows.
- 3 Chips: pass. Four chips and `+2 more`; expanded shows six and `Show less`; a bound token past the fourth stays among the first four.
- 4 Text: pass. Size 22px, italic, and the `type.family-mono` family token (`ui-monospace, Menlo, monospace`) applied; bold toggles weight 700 to 400. No editable text content (the "Text is never edited here" hint; no contenteditable).
- 5 Inner element: pass. The card paragraph takes `color.primary` (`rgb(37, 99, 235)`); the card's own box takes `radius.sm` (6px).
- 6 Separator: pass. A 1 px `bg-border` rule (`rgb(229, 229, 229)`) sits between the Design system row and the list. No prototype sets are seeded, so nothing is listed below it.
- 7 Full size: pass. Grid cards show `<>` "View full size"; the toggled card spans two columns and shows `><` "Back to compact size".
- 8 Layouts: pass for toggle, clipping and memory. Collage frames equal their section heights (40, 26, 151, 42 px) with no overflow. Grid, then List, survived a reload and a full relaunch (`localStorage` key `orca.prototypes.designSystem.componentsView`). Open: a card spans at least two of six columns (the approved rule), so a tiny component does not fill only its own width.

Open, not fixed (product questions):
- A design system whose project has only a `use` request and no direction set opens a blank view: the screen has no chat to read its files through (`designSystemChatOf` returns none). Needs a decision on which chat reads and sends.
- Whether a variant state should change the preview, or only the draft message.
- Whether a tiny component may span one collage column (the approved reference floors cards at two).
