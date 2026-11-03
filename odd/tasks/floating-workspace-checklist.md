# Floating workspace: Checklist tab, open sessions, host selector

Objective: let the person keep a chat's checklist, an existing session, and new work on a paired host in the floating workspace while they move between pages (Prototipos first).
Branch: claude/checklist-card. Delivery: ask-on-risk. Runner: `pnpm test <path>` (vitest), `pnpm tc:web`.
Boards: https://claude.ai/artifact/RSW5BkKUDK94wGd8jfYzME, boards Floating 1-3.

## Specs

- S1 Checklist tab. User: "hay forma de agregar el Checklist dentro del 'Espacio flotante'? me interesa porque así puedes entrar a Prototipos y revisar los prototipos con el checklist a la mano e interactuar con él". "Checklist" is a new entry in the floating workspace "+" menu. The tab shows one chat's checklist with the same card and the same host store as the chat, live in both directions, and stays open across pages.
- S2 Session picker. User: "pueden haber varias sesiones con checklist, debería poder elegir el checklist de qué sesión". It lists every session that has a checklist, with the session title, its agent icon (Gentle Shell shows the rose, never Pi) and progress such as "3/7", grouped like the Workspaces sidebar, with search.
- S3 Default selection. User: "en el caso particular de prototipos debería mostrarme primero el checklist del prototipo donde esté focus, no? allí está al final la data de la sesión que lo generó". Order: on Prototipos, the session that generated the set in focus (its own chat, else its origin chat); otherwise the chat in focus; otherwise the most recently active session with a checklist. While following focus it switches with the focus; a session picked by hand stays pinned until "Follow focus".
- S4 Open existing sessions. User: "también que muestre las sesiones... para que puedas trabajar en paralelo, actualmente te deja crear una sesión nueva de Agentes, pero no seguir con un trabajo en el side bar de worktrees." "Open a session..." in the "+" menu opens any Workspaces session (any worktree or host) in the floating workspace, with the same picker. Decision: by reference, as split-view reference panes do, so one session is never live in two places; closing it gives it back.
- S5 Host selector. User: "parece que está tomando los agentes y terminales de la sesión local, no hay forma de cambiar a la sesión del VPS, yo me imaginaría un selector en la sección que te he marcado de rojo." A host select in the floating header, left of the agent button: "This computer" and each paired host with its status dot. New terminals and agent chats start on the selected host. Default: the host of the focused Workspaces session, else the last used host. Decision: on a paired host the new terminal or chat is created in that host's workspace in focus (else its last used workspace) and shown in the floating workspace by reference, because the floating pseudo-workspace itself is local-only.

## Tasks

- T1 S1-S3 shared session picker, Checklist tab kind, follow/pin, Prototipos focus. Route: delegated (parallel unit). Status: done, 50952990caf.
- T2 S5 host selector and remote creation. Route: delegated (parallel unit). Status: done in code, 741fbccdd80; no live VPS check.
- T3 S4 Open a session using the T1 picker. Route: inline, after T1. Status: done, 50952990caf.

## Log

- L1 2026-11-02 Parent session relayed the user's requests quoted in S1-S5, and asked for boards first, then a desktop build with tests checked against the paired VPS.
- L2 2026-11-02 Boards Floating 1-3 published, marked pending approval as the user's request.
- L3 2026-11-03 Writers done. T1 reads a chat's journal at rest via `agentSession.history` (no host or RPC change) and polls marks every 4 s. The parent added the tab kind to tab reconciliation, the floating surface and chrome models, and activation/close. T2 factored `RuntimeHostSelect` out of the Bot teams picker. The parent registered the floating overlay root (referenced sessions otherwise stay hidden), routed the panel "+" and Ctrl+T through the host-aware creator, and kept the Codex banner's "Open new terminal" local.
- L4 2026-11-03 Checks: `pnpm tc` exit 0; oxlint and oxfmt clean on the 59 changed files; touched suites pass (some panel and TabBar suites time out only under full parallel load, and pass with 2 workers). `useTabGroupTabCloseCommands.structured-session.test.ts` fails to load at HEAD too (its i18n mock lacks `i18n`; the chain via worktree-activation is unchanged). Not done: live VPS check, locale catalog entries (English fallbacks show), `check:code-quality:changed` (overflows on this branch's base).
