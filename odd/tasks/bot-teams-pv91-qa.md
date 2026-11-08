# Bot Teams pv91 QA fixes
Objective: fix pv91 QA items 9, 11, 12 and four new notes in the Bot Teams conference room.
Branch: claude/bot-teams-character-motion. Delivery: ask-on-risk. Runner: `node node_modules/vitest/vitest.mjs run --config config/vitest.config.ts <paths>`.

## Specs
- S1 (item 9): "Cuando hago el reply me pide elegir proyecto. Además internamente en la tarea que genera para responder como contexto se le pasa los últimos textos. Debería de pasar el mensaje del "reply" y el agente debería poder explorar la tarea que generó dicho mensaje." A reply never asks "Which project is this for?". Its context is the quoted message (not the last room lines), and the agent can open the task that produced the quoted message.
- S2 (item 11): "OK, pero luego me exije enviarlo a otro team, creo que hay instrucciones que están colisionando, hay que afinarlas." After "¿Qué quieres que haga con IMG-20261102-WA0010.jpg?", the answer "Sólo guárdalo" saves the file in the room with no routing card ("Choose where this task goes: create a new team, or send it to an existing team").
- S3 (item 12): "No tengo forma de probarlo, prúebalo tú con un puerto de depuración." Test Estrellita (Gentle Shell) delegation end to end on pv-vps and report the run.
- S4: "Si un agente crea una tarea para responder, en el chat de sala de conferencias no debería aparecer dicha tarea. Sino un feedback como si estuviera escribiendo, se entiende? algo como "escribiendo..." con una animación en los puntos suspensivos. Las únicas tareas que deberían aparecer en Conference room, son las tareas que funcionan como entregables, por ejemplo, las de las rutinas."
- S5: "Si creo varias tareas programadas, la nueva tarea archiva a la anterior. Eso sólo debería suceder si yo reprogramo algo, si los agentes encuentran dos tareas similares, deben consultar con el usuario si esa tarea está relacionada y en realidad lo que quiere es reprogramar o quiere crear una nueva porque son distintas."
- S6: "No funciona el hover en los archivos adjuntos." The attachment chip in a room message shows a visible hover.
- S7 (pv94 item 6): "OK. Pero aún me dice su frase de plantilla (On it) o similares." No bot posts a template line ("On it", "En ello", "Yo tomaré…") when it takes a task.
- S8 (pv94 item 8): "OK. Pero para probarlo completo necesito que limpies Los conference room y los files." Clear the preview hosts' conference rooms and Files; list before, report after.
- S9 (pv94 item 10): "No, sigue sin funcionar el hover en los archivos adjuntos." Reproduce in the rendered UI through the debug port and fix.
- S10 (pv94 item 12): "Pruébalo tú". The delegated task card must not stay "Unknown" after its child finishes.
- S11: "Las tareas asignadas a otros teams se mueven siempre debajo y no se quedan en la posición del chat donde se crearon."
- S12: "Cuando adjunto un archivo, cambio de sección y vuelvo al cchat composer del conference room, el adjunto desaparece."
- S13: "Los prototipos no deberían mostrarse en files, tampoco los archivos internos que genera el agente para crear el prototipo. (analiza el conference room para analizar esto)"

## Tasks
- [x] T1 S1+S4 reply context, no project question, hidden reply tasks with typing line. Route: delegated writer A (parallel units, disjoint surfaces). Commit 83332169152.
- [x] T2 S2+S5 save-only files and similar-routine question. Route: delegated writer B (parallel units, disjoint surfaces). Commit 6632a9d24db.
- [x] T3 S6 chip hover. Route: inline (small). Commit 26028cb5b2e.
- [x] T4 S3 + live checks on pv-vps. Route: inline. pv93 run (L5), pv94 re-run (L6).
- [x] T5 S7 no template acknowledgement. Route: inline. Commit 504aa1652ea.
- [x] T6 S10 delegated status kept. Route: inline. Commit ad20f157661 (RED observed).
- [x] T7 S11 cross-team tracker placement. Route: inline. Commit 1db78f2c8af (RED observed).
- [x] T8 S12 composer files kept per team. Route: inline. Commit 3bfcb2bd559 (RED observed).
- [x] T9 S13 prototypes out of Files. Route: inline. Commit 11f4cda166f (RED observed).
- [x] T10 S9 composer chip hover preview. Route: inline. Commit 4f2ea40a068 (RED observed).
- [x] T11 S8 pv-vps rooms and Files cleared (L8).
- [ ] T12 live check of T5-T10 on a pv95 build.

## Log
- L1 2026-11-07 parent relayed pv91 QA (items 7, 8, 10 passed) with the user's words quoted in S1-S6.
- L2 Mapping: no code archives a routine when another is created (`createBotTeamRoutine` is a plain insert; Archived = a once-routine that already ran). Light-theme `--accent` equals `--muted` (#f5f5f5), so `hover:bg-accent` is invisible on a person's bubble.
- L3 S5 reproduction through the post path: three scheduled requests made three active routines; none was archived or hidden. A once-routine shows under Archived only after it runs. The similar-routine question was added anyway; it offers only one-time routines that will still run.
- L4 Gaps: no command lets an agent open another task, so the reply note inlines the source task's title and request. A failed reply task shows only on the board. Older desktop clients show the new-team card for a similar-routine choice; mobile reads it as no choice. Reschedule/Create post no bot confirmation in the room (a toast instead).
- L5 pv93 on pv-vps, temporary team "QA pv93" (removed after): S1 pass (reply to a bot line in a team with a project: no project question, task `answersMessageId` set, start notes hold the quoted line and its source task, no room excerpt). S2 pass (file without words, "Sólo guárdalo", bot posts "Guardado: recibo-qa.txt.", no task, no card). S3: person-to-Gentle-Shell handoff Done; bot-to-bot team-delegate to Gentle Shell started with piRuntime gentle-shell (no refusal), but the child got a prototype request and built a design system: fixed in a59f0a97c1f (first prompt re-classified the standing room rules, which mention "prototipo"). S5 fail: two alike requests went to different bots (the first "Ana, …" was routed to Estrella QA), so the same-bot rule missed: fixed in 5f20accd523. Open: a request that starts with a bot's name was routed to another bot.
- L6 pv94 on pv-vps, temporary team "QA pv94" (removed after): S3 pass (Ana team-delegated to Estrella QA, Gentle Shell; the child answered "hecho", modified no files, and no prototype request was made). S5 pass (second alike request returned a similar-routine choice for the 09:00 routine and created nothing). The first request went to Ana this time, so the name-routing issue did not reproduce. The delegated card shows status Unknown in `bot-teams tasks` after the child finished.
- L7 2026-11-07 pv94 QA relayed by the parent (items 7, 9, 11 OK) with S7-S13 quoted. Explorer map: the delegated task's `session_id` is linked only on reads, so `setBotTeamTaskLastStatus` matched no row; a choice-card answer filed a cross-team task with no origin message; composer files lived in component state; finish reports attached a child's `prototypes/<request>/` files and Files listed `design/system`.
- L8 S9 on the PC preview pv94 (CDP 127.0.0.1:9335): all 13 room chips in Desarrollo opened their hover card with a preview (images, .md, .json, sandboxed .html); the composer's pending chip had no hover card at all, so that is the one fixed. The window was put back on the user's chat with its draft. S8: the PC preview has no rooms of its own (local team, 0 messages, no folder); pv-vps was backed up to `~/orca-preview/backups/pv95-room-files-clear-20261108-014913`, then its 48 room messages (and 2 reply links, 1 return, origin message ids) and its Files (19 files in two team folders, plus `bot-team-deliverables/team_ac38387ae1a7.json`) were cleared; tasks, routines, memory and projects stay.
