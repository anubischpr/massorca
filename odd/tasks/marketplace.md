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
| T1 | S2, S3, S5 | inline | pending | |
| T2 | S3, S4 | inline | pending | |
| T3 | S1, S2, S3 | inline | pending | |

T1: main-process catalog detection (`src/main/marketplace/`), IPC `marketplace:detect`, preload bridge. T2: Engram MCP add/remove for Claude Code and Codex with backup, IPC `marketplace:setEngramMcp`. T3: sidebar row, view action, Marketplace page with Engram and OpenMetadata detail.

## Log

- L1 (2026-11-03, orchestrator, verbatim): "Overnight mandate: the user is asleep and left me in charge. Please finish the Marketplace end to end tonight without stopping. Boards: your pending boards (canvas v27) are approved with your own recommendations wherever a choice was open. Log it as "approved by the orchestrator on the user's behalf, 2026-11-03, for morning review". Then build: The Marketplace lives in the left sidebar. It installs apps and integrations: Git, GitHub, Engram, OpenMetadata and others. Its first real targets are Engram and OpenMetadata, which today are configured by hand on the VPS preview. The goal is that this is later built from the Marketplace. Do not touch Gentle Shell's own config (.pi, .gentle-shell). Gentle Shell already has Engram. Reuse before building: check the existing integration and settings code first. Decisions: for any question you would normally ask the user, pick the option that best fits the boards and earlier decisions, and continue. Append each decision to your feature document's Log under "Overnight decisions 2026-11-03", one line each, with the alternative you rejected. Commits: commit work units and report them to me so I can include them in pv80. Bugs in your own work you fix without asking."
- L2: Boards approved by the orchestrator on the user's behalf, 2026-11-03, for morning review.

### Overnight decisions 2026-11-03

- D1. Entry point: a "Marketplace" row in the existing left sidebar nav (`SidebarNav.tsx`), always shown. Rejected: a new icon rail, which this codebase does not have.
- D2. First slice covers this computer only; SSH, WSL and paired hosts show "Only this computer for now". Rejected: probing remote hosts tonight without a relay file probe to reuse.
- D3. Engram MCP is written directly (Claude `mcpServers.engram` = `engram mcp`, Codex `[mcp_servers.engram]` = `engram mcp --tools=agent`). Rejected: running `engram setup <agent>`, whose full effect on the user's files is not verified.
- D4. Hooks and Instructions layers, Engram cloud sync and import: shown as designed but not built tonight. Rejected: writing hooks and instruction blocks into global agent files in the same slice.
- D5. OpenMetadata is detect-only tonight; connect needs pasted tokens and a bridge. Open questions resolved with the recommendation: the person pastes tokens; the host's existing renewal service keeps owning renewal. Rejected: MassOrca creating tokens with an admin token.
- D6. Git and GitHub status reuse `preflight:check`; install stays the existing links. Rejected: one-click installers tonight.
