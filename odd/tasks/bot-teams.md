# Bot teams

Objective: add a Bot teams mode to MassOrca, desktop and mobile, for non-technical users, reusing what MassOrca already has.
Branch: claude/peaceful-solomon-017ef2 for phase 0; each later phase gets its own branch. Delivery: ask-on-risk. PRs target custom/integration.
Test runner: `pnpm test`, `pnpm tc`. Approved design: https://claude.ai/artifact/RciXSHfXaHRyWECoQrKRLx (version 17).

## Specs

- S1. Model: Company > Team > one Conference room > Tasks, each with its own thread, optionally grouped in Projects. Design canvas version 17 is the UI reference.
- S2. Phases, approved by the user: 0 foundations, 1 mode and teams, 2 Conference room and tasks, 3 projects and versions, 4 memory, hand-offs and integrations, 5 Workspaces option, 6 routines and webhooks.
- S3. Minimal scope: "tengamos MUCHO cuidado en NO hacer sobre ingeniería, la base de MassOrca ya tiene bastantes cosas que se pueden reutilizar, mantengamos esto a lo mínimo necesario."
- S4. Git: "agreguemos Git en el instalador pesará más, pero es necesario para que funcionen ciertas features."
- S5. Engram: "no nos olvidemos de Engram, lo íbamos a incorporar como nativo en el proyecto para el tema de memorias compartidas". Whether it also solves large binaries is an open question for phase 0 (user: "pensaría que podríamos utilizarlo aquí también a nuestra manera").
- S6. Access: "Bot teams en general manera modo full access por defecto, en settings se podría configurar si se quiere granularidad por team y qué modo tendría cada team". Reason: "para usuarios no técnicos es importante que no sientan fricción al realizar tareas."
- S7. Stopped reuses the status `done` with `interrupted`; no new status state. Assumption to verify: it survives a host restart.
- S8. Bot teams runs on the host selected in mobile; team data lives on that host. Sharing teams across hosts is out of this version.
- S9. Code is never copied from nightly-labs/openbot (PolyForm Noncommercial) or CopilotKit/openbot; ideas only.
- S10. Phase 2, create a task without starting it: a task can be saved as "Not started" in the Todo column, with no agent working on it, and starts only when the person says so. The task record must exist before its delegated child session is launched. Stopped stays separate: a task that started and was interrupted (S7).
- S11. Phase 2, bots read and create tasks from the conversation: a bot in a Conference room can create a task on request and list pending tasks from the real board, not from memory.
- S12. Phase 2, a Workspaces session that comes from a team shows that team's character beside it in its row, as in the user's reference from Codex.

## Tasks

- [x] T0 (S2-S9) Phase 0 technical decisions, recorded in the Log (L3). Route: delegated read-only map (understanding exceeded the inline budget), then inline document. No UI, no production code.
- [x] T1 (S1, S2, S6) Phase 1 mode and teams. Route: inline. Commits 2d1784d7b3b, a723349f867, 080f0c4a49c on claude/bot-teams-phase-1.
- [ ] T2 (S1, S2, S3, S6, S7, S10, S11, S12) Phase 2 Conference room and tasks, starting with one team, one bot and one task end to end. Route: to be decided.
- [ ] T3 (S2, S4, S5) Phase 3 projects and versions. Route: to be decided.
- [ ] T4 (S2, S5, S6) Phase 4 memory, hand-offs and integrations. Route: to be decided.
- [ ] T5 (S2, S8) Phase 5 Workspaces option. Route: to be decided.
- [ ] T6 (S2) Phase 6 routines and webhooks; needs its own design first, the canvas has none. Route: to be decided.

## Log

- L1 (2026-10-31), user request: "Empecemos por las fases antes de desarrollar código."
- L2 (2026-10-31), user: "Sí, y una última cosas, agreguemos Git en el instalador pesará más, pero es necesario para que funcionen ciertas features. Además no nos olvidemos de Engram, lo íbamos a incorporar como nativo en el proyecto para el tema de memorias compartidas, y eso te resuelve un problema respecto a los binarios grandes, porque este maneja SQL Lite, pensaría que podríamos utilizarlo aquí también a nuestra manera, no? Por último Bot teams en general manera modo full access por defecto, en settings se podría configurar si se quiere granularidad por team y qué modo tendría cada team, se entiende? Esto debido a que para usuarios no técnicos es importante que no sientan fricción al realizar tareas."
- L3 (2026-10-31), phase 0 decisions, from a code read without running anything (CodeGraph failed, plain search used):
  - Data: Bot teams tables in orchestration SQLite, next migration after `SCHEMA_VERSION = 43` (`src/main/runtime/orchestration/db/contract-constants.ts:23`). It is per host (S8) and `delegation_requests` can gain a column to link a task. Mobile needs new RPC methods and allowlist entries (`src/main/runtime/runtime-rpc/runtime-rpc-mobile-method-allowlist.ts`).
  - Naming: `botTeams` in code and RPC; "Task" only in UI, since `tasks` already means orchestration tasks and tracker issues.
  - Chats: reuse the projectless flow (`src/main/projectless-chats/projectless-chat-workspace.ts:25-65`) with a "Bot teams" group and root, one folder per project and one for tasks without a project. Unverified: how to keep them out of the Workspaces sidebar; no hidden flag was found, T1 traces it.
  - Task threads: delegated child sessions (`src/main/delegated-session/`), adding a named bot as the routing target.
  - Access (S6): team `accessMode`, default `full-access`, passed at start. Children inherit it unchanged (`src/main/delegated-session/delegation-access-mode.ts:15-50`). ACP agents declare no modes, so their prompts may still appear; whether they are answered automatically is unverified.
  - Stopped (S7): `done` with `interrupted`. Structured rows are not in the last-status file; the journal is the durable source (`src/main/agent-hooks/server/server-persistence.ts:29-33`). Surviving a restart is unverified; T2 adds a test.
  - Git (S4): bundled on all platforms in T3, following the ripgrep packaging and `beforePack` guard (`config/bundled-ripgrep-resources.cjs`, `config/electron-builder.config.cjs:357-362`), Windows first. Git is resolved as bare `git` today (`src/main/git/command-runner/git-exec-file.ts:321`); reaching agents through PATH is untraced. License notice required.
  - Engram (S5): not bundled today. It appears only as a name in `src/main/ports/agent-infrastructure-listener.ts` and `NativeChatSessionConnectorRow.tsx` on custom/integration. Native Engram is new work in T4, for team and bot memory.
  - Large binaries (S5): Engram does not solve them. SQLite storage alone gives no restore flow and the database would grow with each copy; Engram's own limits were not checked. T3 uses git snapshots on hidden refs, with a size limit to skip large files.
  - Versions: the exploration in odd/research/fine-grained-versioning.md (branch claude/explore-fine-grained-versioning-250308) also recommends git, pending an owner decision; T3 reconciles with it.
- Canvas gap for T1: the design shows restrictive permissions and a publish approval, which conflicts with S6. Adjust before implementing those screens.
- L4 (2026-10-31), user: "Sí, empieza con la phase 1, y si utilizar sqlite no cambia nada, entonces simplemente veamos la mejor manera de trabajarlo en Git como has planteado. De acuerdo." Closes the large-binaries question for T3: git snapshots, no SQLite storage.
- L6 (2026-10-31), user, relayed by the parent session: "yo le podría pedir a mi bot en bot team que me cree una tarea en Todo (Stopped) simplemente para ir organizándome e ir acumulando próximas tareas y que no se me olviden?" and "yo podría preguntar por las tareas que quedaron pendientes, cierto?" Approval: "Sí, agrégalas". Out of scope: the proactive Monday or next-day check-in belongs to T6, and no coordinator bot role is defined.
- L7 (2026-10-31), user: "las sesiones que vengan del Bot Team no podrían tener el personaje del team al que están relacionados al lado, tal como ves en la imagen?" and "Sí, en la fase 2, y sólo para aclarar, me refería a las sesiones de Workspaces que vienen de Bot Team, se entiende?" Dependency: those rows only exist for teams with the Workspaces option on, whose full flow is T5; T2 stores the team link and draws the character.
- L8 (2026-10-31), T1 evidence: store and migration tests pass under vitest (the bun lane lacks node:sqlite here, as for the existing delegation store). The hidden-window e2e `tests/e2e/bot-teams-create-team.spec.ts` passed before the last mobile-only fix. Mobile tests 4/4; `pnpm tc` clean. An independent verifier found no blocker; native review (risk, reliability) found one defect, fixed in 080f0c4a49c, then approved. Not verified: mobile screens on a device, and `check:code-quality:changed`, which crashes in this checkout. Gaps: teams are unreachable on wide mobile layouts and from the shell's Workspaces page; `accessMode` is stored but applied from T2, when sessions exist; the Settings pane has no rendered test.
- L5 (2026-10-31), T1 scope: branch claude/bot-teams-phase-1 from origin/custom/integration, so the PR leaves out the unrelated work on claude/peaceful-solomon-017ef2. Tables `bot_teams` and `bot_team_bots` (schema v44), RPC `botTeams.*` allowed on mobile, desktop view `bot-teams` with a Workspaces/Bot teams switch, all teams, new team, add a bot, team bots, a Settings pane for each team's access mode, and a mobile Teams home with the same screens. Access defaults to `full-access` (S6), so the design's "limited access" copy is dropped. The Conference room stays for T2, and the sidebar filter moves to T2 because T1 creates no workspaces.
