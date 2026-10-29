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
- [ ] QA1 (pv53) Pins persist only when something changed; untouched pins are dropped when the selection moves or closes (shared reducer). Tests. Route: delegated writer.
- [ ] QA2 (pv53) Inspector shows every control: nested text read and rewritten through the single text leaf, clicks on inline children climb to the nearest button / label / link / role=button, no silent drop of deep elements (selector cap). Tests for label and button cases. Route: delegated writer.
- [ ] QA3 Panel collapse (approved 2026-10-29, artifact 4KG3VobcJAegnPAomKsMG1): desktop icon button after Browse / Annotate, aria-label Hide panel / Show panel; hidden panel gives the prototype full width and keeps the draft; picking an element or pin reopens it. Mobile unchanged. Route: delegated writer.
- [ ] QA4 Fidelity removals from the audit (slash-menu descriptions desktop + mobile, viewer-header " · iterating X" suffix; add the board's "Width unit" / "Height unit" labels). Open items sent to the user. Route: delegated writer. Tests. Route: delegated writer.
- [ ] DS4 Mobile: list groups + row, set suffix, Design system screen with sheets and send, n3 on requests. Tests. Route: delegated writer.
- [ ] DS5 Fidelity pass on every surface; checks; report SHAs.

## Progress

DS1 done (shared model, host read RPC and list summaries, clients). Found in passing: the phone allowlist lacked `prototypes.writeAttachment`, so v8 mobile screenshot sends were refused — fixed in `bb25bf7b181` with the allowlist test updated.

## Verification evidence

- DS1: tests 152 shared + 138 host/renderer passed; typecheck:node/web, tsc cli, mobile typecheck, oxlint/oxfmt, code-quality gate clean. Review lineage review-089f1c84b09d24a5 asked for one correction (R3, R4); fixed on the branch in `6d706196a10`, lineage abandoned (this session cannot write into the review worktree).
- DS3: focused vitest 19 files / 252 tests; typecheck node/web/cli, verify:rpc-params-catalog, oxlint/oxfmt, code-quality gate (base 867f326d703) clean; mobile typecheck + 23 files / 141 tests. Localization verify scripts fail on base findings outside DS3.
- DS2: focused vitest 20 files / 194 tests passed; typecheck:node/web, tsc cli, oxlint, oxfmt, code-quality gate (base 964f3e193f7) clean. `verify:localization-extraction` fails on the base commit too (51 keys missing from en.json, none from this work).

## Next step

QA1–QA4, then DS4. Pending user approval: main-direction + merge design (artifact C7fQd5S4v5UXVk5fW5XX6M).
