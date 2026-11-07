# CLI write commands for MassOrca features
Objective: every write action the UI has for MassOrca-built features gets an `orca` CLI command with `--json`, so an agent on the host can test and change things.
Branch: claude/musing-raman-3abdf2. Delivery: ask-on-risk. Runner: vitest (`pnpm exec vitest run <file>`).

## Specs
- S1 Marketplace: "pick the host (local, WSL distro, paired host); install, remove, open and configure skills; connect and disconnect services with a token; turn an agent on or off for a skill (and see its copy removed on that host)."
- S2 Bot Teams: "send a message to a room (with a reply quote and attachments), list room messages and tasks, answer a choice card, trigger a delegation to a given bot (for example Estrellita on Gentle Shell) and read its result."
- S3 "Everything else we built: the same rule. Every write action the UI has gets a CLI command."
- S4 "Add tests, keep the help text current, and report the commits plus a sample run of each new command on pv-vps."
- S5 Constraints carried over: never print secrets (tokens from stdin or env only); wire compatibility (no new stream opcodes, new optional fields only); Gentle Shell is never called Pi.

## Tasks
- T1 Map write RPC surface (S1-S3) - delegated explorer - done
- T2 Marketplace write commands (S1, S4, S5) - delegated writer (parallel units) + inline services wiring - done
- T3 Bot Teams write commands (S2, S4, S5) - delegated writer (parallel units) - done
- T4 Other fork feature write commands (S3, S4, S5) - delegated writer (parallel units) - done
- T5 Registry split (massorca-handler-groups.ts), rm verbs, help, docs, checks (S4) - done; pv-vps sample runs pending (needs remote authorization)

## Log
- L1 (2026-11-07, orchestrator relaying the user) "Esto deberías haberlo probado tú con el puerto de depuración nuevo, si lo has hecho sólo para visualizar, pues está mal, debe servir también para que puedas testear o modificar." and "No puedo acceder a ninguna skills instalada ... Esto también debería haberse podido ver o testear desde el puerto de depuración."
- L2 RPC map: CLI --host is local|ssh:<id>|runtime:<id> (src/cli/execution-host-flag.ts), no wsl. Skills writes are skills.* RPC (skills-admin), install needs download-grant/staged-upload/local-file ingress; per-agent choice = `providers`. Bot Teams room/assign/CRUD/routines are RPC (workspace); orchestration.botTeamDelegate needs a bot caller session. Prototypes, Jev, folder workspace writes exist as RPC. GitLab/Bitbucket/Azure DevOps/Gitea connect has no RPC yet; the Marketplace session (local_80a9f033) is adding it on claude/marketplace-pv84.
- L3 Marketplace session asks for `--host local|runtime:<id>|ssh:<id>|wsl:<distro>` mapped like use-marketplace-host-targets.ts / marketplace-skill-host-install.ts; it will add any missing skills RPC on request.
- L4 Checks: tc:cli clean; oxlint clean on changed files; vitest src/cli 18 failures, all pre-existing (orchestration recovery quoting, Orca vs MassOrca wording, cloud push); new tests pass. Gaps: catalog/SSH skill install and agent switch without --file wait on `skills.installPackageVersion` RPC (Marketplace session); bot-teams --attach only names files already in the team's attachments/ folder; child sessions have no list RPC.
