Objective: simplify the desktop interface as approved in the canvas https://claude.ai/artifact/NgUV6TR25YQ2VY78GWn3QJ.
Branch: claude/desktop-simplification, from local refs/heads/custom/pv27-unified at 60b4fb3f70d. Delivery: single-pr into custom/integration through custom/pv27-unified (standing user rule). Test runner: `pnpm test`; UI checks through CDP screenshots with ORCA_BACKGROUND_LAUNCH=1.

## Specs

The canvas is the visual source; nothing outside it gets added ("por favor, que no ocurra como otras veces que implementan labels o componentes que están fuera del prototipo.").

- S1 Rail: "crear una barrita lateral, siempre visible y a la izquierda del todo", 52 wide, with usage at the bottom ("con un anillo los que tengan sólo consumo semanal y con doble anillo los que tengan consumo de 5 horas y semanal") and "Recolocar el botón de Settings". Outer ring weekly, inner ring 5h; rings keep the status bar's used or remaining display setting.
- S2 Rail buttons that depend on unfinished work stay hidden, not dead: Bot team mode and Calendar wait for the Bot teams session (PR #93 and its routines phase); Workflows and Canvas are "la próxima semana". Assumption, confirm with the user at close.
- S3 Tasks: "una pantalla limpia, parecida a la del botón \"+ Crear\" pero que te permite crear una Tarea o Sesión", with a switch reading "WorkSpaces/Bot Team", plus what "necesiten tu aprobación". Bot Team side waits for S2. Assumption: the existing `tasks` view (source-control task board) must stay reachable; where it goes is an open point recorded at T6.
- S4 + Create: "Crear sesiones nuevas en una rama/worktree existente".
- S5 + Create: "Reacomodar las 3 opciones en una nueva sección encima del chat composer": host place, project, branch or worktree.
- S6 + Create: "Agregar un nuevo Toogle switch a la derecha de \"Access\" para elegir entre modo terminal y modo ChatUI". The rainbow border is on the switch only ("el borde arcoíris es sólo para el toogle switch, no para todo el chat composer."), default Chat; Terminal shows a message about limited features; returning to Chat wobbles the switch and relights the border. Reduced motion: no wobble, static border. Rainbow colors become documented tokens.
- S7 "eliminar las pestañas de la barra superior de las sesiones."
- S8 Top bar: "Imprimir el nombre de la sesión pegado al lado izquierdo de la barra y dejando los botones del lado derecho", "agrandar los botones", "Quitar el botón de \"Cerrar pestaña\"".
- S9 "Agregar un botón para Ocultar la sección \"Resumen del chat\"", icon as the user's image (two circles with lines), labels Hide Chat summary and Show Chat summary.
- S10 Side panel button, icon arrow out of a square: "abra una barra lateral derecha en donde allí sí se puedan crear pestañas": New Terminal, New Browser Tab, New Markdown, New Mobile Emulator. "En este nuevo panel lateral no se muestra la sección de agentes."
- S11 Toggle right sidebar keeps the rectangle with a right strip icon; it stays at the far right and can be open with the side panel.
- S12 "el panel principal del chat debe llegar hasta arriba (mira cómo está Claude Code)": no title bar above; window controls share the session bar. Must keep window dragging and macOS traffic lights.
- S13 Shortcuts: Mod+T and Mod+Shift+B open the panel and add the tab; Mod+W closes the focused panel tab and never a session; reopen and tab switching target the panel.
- S15 Status bar stays, its four segments right-aligned (keep awake, resource usage, ports, remote hosts), without usage meters: "antes esa barra de estado iba de extremo a extremo, ahora debería ir del final del side panel izquierdo al borde final derecho". It runs under the main area, side panel and right sidebar, never under the rail or left sidebar. Built in T4 with the shell layout.
- S14 Every change considers SSH, folder workspaces, Windows, macOS and Linux.
- S16 Calendar (boards 13 Week, 14 Day, 15 Month): "build the \"Calendario\" view from your desktop prototype: the bots' scheduled tasks, shown in calendar mode", with Previous, Today, Next, a Day/Week/Month switch, a team legend, run chips (time, name, bot · team) and Upcoming runs. Bot runs come from `botTeams.listScheduledRuns` (Bot teams session); "Consider also showing ordinary Orca automations in the same calendar, if it fits the board."

## Tasks

- T1 S9 Hide or show Chat summary. Route inline. Done, setting nativeChatSummaryVisible; RED then GREEN on the pane header test. NativeChatStructuredSession.test.tsx has 3 failures that also fail at the base commit.
- T2 S1 S2 Rail, usage rings, Settings. Route inline. Done, 3aea932d985; status bar slot 929448c5ba5.
- T3 S7 S8 S10 S11 S13 Tabless main area and side panel. Route delegated, context backstop. Done, 6e5b8ed0fc0 and 15049c0737d. Risk items 1 and 3; independent verifier passed, tab identity kept across upgrade, two relaunches and downgrade. A populated split group was not seeded.
- T4 S12 S15 Remove the title bar. Route delegated. Done, 8d79dac1bfe and 15049c0737d. Verified on Windows only.
- T5 S4 S5 S6 + Create. Route delegated, context backstop with T3 in parallel. Done in tests, 81 create-chat tests pass; not yet seen in the app. Locale keys pending. The notice drops "You can move back with Switch to chat view." because the control is absent for unsupported agents and for some agents on SSH.
- T6 S3 Tasks page. Route delegated. Done, 8d79dac1bfe. WorkSpaces and Bot Team switch waits for PR #93 behind TASKS_HOME_CREATE_MODES; the old board stays reachable through openTaskPage.
- T7 pv79 QA: approvals on Tasks, drafts, split view, Bot Teams filter. Route: drafts inline (8bbca617e98); approvals, split view and the Workspaces draft loss delegated in parallel (disjoint surfaces); the filter belongs to the Bot teams branch (commit 49553fc89e0) and was handed to that session.
- T8 S16 Calendar view. Route pending.

## Log

L1 (2026-10-31, user, verbatim excerpts in Specs; full request on canvas board 19): "oye. siguiendo el tema de simplificar la interfaz de la versión desktop".
L2 (2026-10-31, user): "Igual lo importante aquí más que nada es tener claro el concepto de la limpieza de la nueva interfaz, queda claro para su implementación? hay opciones que aún no se van a implementar porque depende de \"Prototipo de Bot teams sobre MassOrca\" que termine de implementar su parte. Se entiende? Si ya lo entendiste, prototipo aprobado y puedes continuar."
L3 Map: no bot team mode on this branch. WindowControls, TitlebarMainStrip and TitlebarLeftControls own the title bar. Seam for tabs: per-worktree panel group through createUnifiedTab targetGroupId, FloatingTerminalPanel as template. About 40 tab-bar test files and several e2e specs assert current structure.
L4 (2026-11-01) Verification: orchestration-worker-terminal-visibility duplicate spawn and settled-worker-tab-survives-restart codex probe fail identically at 60b4fb3f70d, so they are baseline defects. paired-* specs and two layout oracle fixtures cannot run on this Windows host. remote-agent-session-focus-authority and golden-quit-relaunch-session are not rewritten. Not checked: SSH, folder workspaces, macOS, Linux, window dragging, populated split groups.
L5 (2026-11-01) Native review: the slice 60b4fb3f70d..HEAD (174 files, 8640 lines) failed with lens_context_budget_exceeded, so its consent was declined after the failure. No native review covers this feature; the independent verifier is the outside view. Open point for the user: the session bar stops at the right sidebar, while canvas board 5b draws it across the whole width.
L6 (2026-11-03, orchestrator relaying pv79 QA): tasks awaiting approval missing on Tasks; unsent text lost on click-away in Workspaces sessions, + Crear, Tareas and the Bot teams room; "Mostrar Bot Teams" should hide only the no-project Bot teams group; split view needs a dimmer unfocused pane and toolbars kept in their halves with the divider reaching the top bar.
L7 (2026-11-03, orchestrator): overnight mandate, then build the Calendar view from the prototype (S16).

Overnight decisions 2026-11-03
- Drafts: one hook, useComposerDraft, on top of the existing native chat draft store (IndexedDB, journal). Rejected: a second localStorage store with a 7-day expiry, as first proposed with the Bot teams session.
- Bot Teams filter: handed to the Bot teams session, because the switch lives on its branch (49553fc89e0). Rejected: rebuilding the switch on this branch.
- Calendar sources: bot routine runs and ordinary Orca automations in the same calendar. Automations get their own legend entry beside the teams. Rejected: bot runs only, because the board's run chip fits an automation as well.
- Calendar dependency: merge claude/bot-teams-character-motion once its scheduled-runs API lands (standing rule, merge dependency branches). Rejected: copying its RPC types here.
