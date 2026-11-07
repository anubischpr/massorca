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

## Tasks
- [x] T1 S1+S4 reply context, no project question, hidden reply tasks with typing line. Route: delegated writer A (parallel units, disjoint surfaces). Commit 83332169152.
- [x] T2 S2+S5 save-only files and similar-routine question. Route: delegated writer B (parallel units, disjoint surfaces). Commit 6632a9d24db.
- [x] T3 S6 chip hover. Route: inline (small). Commit 26028cb5b2e.
- T4 S3 + live checks on pv-vps. Route: inline, needs a build with these commits and the Bot Teams write CLI from feature-debug-cli.

## Log
- L1 2026-11-07 parent relayed pv91 QA (items 7, 8, 10 passed) with the user's words quoted in S1-S6.
- L2 Mapping: no code archives a routine when another is created (`createBotTeamRoutine` is a plain insert; Archived = a once-routine that already ran). Light-theme `--accent` equals `--muted` (#f5f5f5), so `hover:bg-accent` is invisible on a person's bubble.
- L3 S5 reproduction through the post path: three scheduled requests made three active routines; none was archived or hidden. A once-routine shows under Archived only after it runs. The similar-routine question was added anyway; it offers only one-time routines that will still run.
- L4 Gaps: no command lets an agent open another task, so the reply note inlines the source task's title and request. A failed reply task shows only on the board. Older desktop clients show the new-team card for a similar-routine choice; mobile reads it as no choice. Reschedule/Create post no bot confirmation in the room (a toast instead).
