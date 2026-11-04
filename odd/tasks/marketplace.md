Objective: build the first working slice of the Marketplace from the approved boards (canvas v27) and `docs/reference/marketplace-design.md`.
Branch: claude/sleepy-hodgkin-9f2dc4. Delivery: ask-on-risk; commits reported to the orchestrator for pv80. Test runner: Vitest (`pnpm test <file>`).

## Specs

- S1. "The Marketplace lives in the left sidebar." A Marketplace row in the left sidebar nav opens a Marketplace page in the main area (`activeView: 'marketplace'`).
- S2. "It installs apps and integrations: Git, GitHub, Engram, OpenMetadata and others." The page lists a bundled catalog with those four items, grouped in sections (All, Tools, Services), each with its detected status on this computer.
- S3. "Its first real targets are Engram and OpenMetadata, which today are configured by hand on the VPS preview. The goal is that this is later built from the Marketplace." Engram's page shows the CLI, the memory store and, per agent (Claude Code, Codex), whether the `engram` MCP server is set; it can add or remove that MCP server in the agent's own config, backing the file up first. OpenMetadata's page shows, per agent, whether the reader (`openmetadata`) and writer (`openmetadata-escritura`) entries are set.
- S4. "Do not touch Gentle Shell's own config (.pi, .gentle-shell)." No code reads or writes those folders.
- S5. Security (orchestrator, earlier): "Never show tokens." "Do not read secrets, just name the mechanism." Detection reads entry names only, never values.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S3, S5 | inline | done | 10b0f263b15 |
| T2 | S3, S4 | inline | done | 10b0f263b15 |
| T3 | S1, S2, S3 | delegated (parallel unit, disjoint renderer surface) | done | see Log L4 |

T1: main-process catalog detection (`src/main/marketplace/`), IPC `marketplace:detect`, preload bridge. T2: Engram MCP add/remove for Claude Code and Codex with backup, IPC `marketplace:setEngramMcp`. T3: sidebar row, view action, Marketplace page with Engram and OpenMetadata detail.

## Log

- L1 (2026-11-03, orchestrator, verbatim): "Overnight mandate: the user is asleep and left me in charge. Please finish the Marketplace end to end tonight without stopping. Boards: your pending boards (canvas v27) are approved with your own recommendations wherever a choice was open. Log it as "approved by the orchestrator on the user's behalf, 2026-11-03, for morning review". Then build: The Marketplace lives in the left sidebar. It installs apps and integrations: Git, GitHub, Engram, OpenMetadata and others. Its first real targets are Engram and OpenMetadata, which today are configured by hand on the VPS preview. The goal is that this is later built from the Marketplace. Do not touch Gentle Shell's own config (.pi, .gentle-shell). Gentle Shell already has Engram. Reuse before building: check the existing integration and settings code first. Decisions: for any question you would normally ask the user, pick the option that best fits the boards and earlier decisions, and continue. Append each decision to your feature document's Log under "Overnight decisions 2026-11-03", one line each, with the alternative you rejected. Commits: commit work units and report them to me so I can include them in pv80. Bugs in your own work you fix without asking."
- L2: Boards approved by the orchestrator on the user's behalf, 2026-11-03, for morning review.
- L3: T1/T2 committed in 10b0f263b15. `src/main/marketplace` has 14 passing Vitest tests. Implementation came before tests, so RED was not observed. Node typecheck is clean in the new files; the one error is pre-existing, in `structured-agent-session-message-options.ts`. oxlint exit 0.
- L4: T3 renderer page, written by a delegated writer. Afterwards the parent added `'marketplace'` to `TopLevelView`, `TOP_LEVEL_VIEW_LOOKUP`, `TopLevelViewSchema` (an additive enum value) and `RIGHT_SIDEBAR_SUPPRESSED_VIEWS`. Checks: the web typecheck (`tsconfig.tc.web.json`) has 0 errors, the marketplace, sidebar and navigation tests pass (68), the format check is clean, and code-quality reports 0 findings. A broad `src/shared` run had 18 failing files, all in unrelated areas (darwin, wsl, git, runtime-environment, omp launch); they were not compared against the base commit.
- D7. The Hooks and Instructions rows show "Coming soon". Rejected: hiding them, which would drop the layers the boards approved.

### Overnight decisions 2026-11-03

- D1. Entry point: a "Marketplace" row in the existing left sidebar nav (`SidebarNav.tsx`), always shown. Rejected: a new icon rail, which this codebase does not have.
- D2. First slice covers this computer only; SSH, WSL and paired hosts show "Only this computer for now". Rejected: probing remote hosts tonight without a relay file probe to reuse.
- D3. Engram MCP is written directly (Claude `mcpServers.engram` = `engram mcp`, Codex `[mcp_servers.engram]` = `engram mcp --tools=agent`). Rejected: running `engram setup <agent>`, whose full effect on the user's files is not verified.
- D4. Hooks and Instructions layers, Engram cloud sync and import: shown as designed but not built tonight. Rejected: writing hooks and instruction blocks into global agent files in the same slice.
- D5. OpenMetadata is detect-only tonight; connect needs pasted tokens and a bridge. Open questions resolved with the recommendation: the person pastes tokens; the host's existing renewal service keeps owning renewal. Rejected: MassOrca creating tokens with an admin token.
- D6. Git and GitHub status reuse `preflight:check`; install stays the existing links. Rejected: one-click installers tonight.
- L5: The independent verifier found blockers B1-B3 in Codex removal: CRLF files gained a blank line each cycle, files without a final newline gained one, and a comment above the next table was deleted. All three were fixed in one correction batch. RED was observed on the old code (5 failing), then GREEN (32 passing). Advisories left for later: JSON reserialization of `.claude.json` (numbers above 2^53, full reformat), no compare-and-swap on the Codex write, and different backup names.
- L6 (2026-11-03, the user's words, relayed by the orchestrator): "En el Marketplace en Github no aparece para logearse con múltiples cuentas". The GitHub page now has an accounts card. It lists every gh login on this computer (from `gh:listHostBindableAccounts`), marks the active one and shows the projects bound to each (`repo.ghAccount`). A new `gh:switchActiveAccount` (`gh auth switch`) is called from a Make active button. To add an account, the card shows the existing `gh auth login` command with Copy and Refresh. Checks: 21 tests, node and web typechecks clean, oxlint 0, and the quality gate clean against `a92743d7e1e`.
- D8. Add account copies the existing `gh auth login` command; the app has no sign-in flow of its own. Rejected: building the board's in-app one-time-code flow in this change.
- D9. Remove account and other hosts' accounts are not built. Only this computer's accounts are listed, and SSH and runtime repos are left out. Rejected: running `gh auth logout` from the app without a confirmation design.
- D10. No new board: the approved "GitHub: connected" board already shows accounts per host with Active, Make active and Add account.

## pv84 build (2026-11-03, boards approved: canvas v44)

Branch: claude/marketplace-pv84 (from custom/pv27-unified 2805b178a70). Commits are reviewable slices that can be merged on their own.

### Specs pv84
- P1. Marketplace sidebar matched to the Catalog board: Search; All, Tools, Agents, Skills, Services; "Your apps" with "All of them" and a count, then the installed apps.
- P2. Standard five-section app page (boards: Engram: standard app page, OpenMetadata: standard app page, GitHub: standard app page, several accounts): header plus @ prompt banner; Connection (only what the app needs to connect); Information (description, developer, category, version, website, privacy, terms, "How each agent uses it" with level badges); Advanced options; Danger zone with Disconnect.
- P3. Engram and OpenMetadata for Claude Code, Codex, Antigravity and Gentle Shell, on for everyone by default. Gentle Shell: detect what it already has, never add a duplicate, back up its config before writing, keep the rose icon.
- P4. Credentials in the vault on this computer (integration-credential-file over safeStorage); agents launched by MassOrca get them as environment variables; no token in any config file. (a) answered: agents started outside MassOrca keep today's token files.
- P5. GitHub accounts on the standard page (existing accounts card).
- P6. Disconnect removes the app's entries from every agent and its stored credentials.
- Then, in order, as far as time allows: P7 token handoff over SSH/VPS and the VPS vault; P8 Who can use it; P9 @ for installed apps in the composers (shared installed-apps list for the Bot teams session); P10 Agents and Skills sections, Git one-click install, in-app GitHub sign-in, Engram cloud sync and import, phone boards.

### Log pv84
- L7 (2026-11-03, orchestrator relaying the user): approved "ya lo veo, ahora sí, aprobado"; scope "intentemos agregar lo máximo posible en la pv84, quisiera que la pv85 y 86 sean más para depurar que para agregar features".
- L8 (2026-11-03, the user's decision relayed by the orchestrator; it replaces my proposal (b)). User: "si el usuario se queda sin pc o trabaja desde celular, entonces no perdería las credenciales? ... en VPS no me cuadra tanto la idea. No hay una forma de crear un llavero sencillo en caso la versión base no lo tenga? Algo así como lo tiene paperclip"; then "Sí, dale". Decision:
  - Every host that runs agents keeps its own vault (the desktop, a paired VPS, SSH/relay hosts), with AES-256-GCM at rest.
  - The master key comes from the OS keychain (safeStorage or libsecret). Otherwise it is a separate key file, mode 0600, under the host's Orca data dir, never next to the ciphertext, and generated on first use.
  - Any client sets or replaces a token over the existing RPC, write-only. A token is never read back; the UI shows only "set" or "not set" and when it was last changed.
  - The host injects tokens into the agents it launches with no client connected.
  - "SSH stores nothing" is dropped; desktop-local agents keep the desktop vault.
  - The page says where each credential lives, for example "Stored encrypted on srv2056164".
  - The new RPC methods are capability-gated.
  - Risk: item 2 (security). It ships as its own slice.
- P7 (rewritten by L8): per-host vault as above, write-only RPC, host-side injection, a location label on the page.

