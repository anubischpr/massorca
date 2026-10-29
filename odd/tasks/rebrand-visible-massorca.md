# Rebrand visible product name to MassOrca

## Objective

Every human-visible "Orca" product name reads "MassOrca" (`PRODUCT_DISPLAY_NAME`), approved by the user on 2026-10-29.

## Problem / why

The earlier rebrand covered the window titles, the landing wordmark and the renderer locale catalogs. About 620 main-process strings plus mobile and store text still say Orca.

## Scope

- Main-process dialogs, notifications, error messages and other text a user reads.
- Renderer copy and locale strings still saying Orca.
- Mobile `app.json` display name and permission prompts, and TestFlight/store text.

## Constraints (do not rename)

- `productName` / `executableName` `Orca` in the electron-builder config, appId, bundle IDs.
- Identifiers, file paths (`/opt/Orca`, `Orca.app`), `ORCA_*` env vars, the `orca` CLI and URL scheme, config keys.
- Anything a paired older client or host parses or matches (remote wire compatibility). Such strings are listed, not changed.

## Tasks

Route: delegated direct (writer trigger, 2+ non-trivial files per task). TDD: off (no project/session TDD setting); ordinary checks.

- [x] T1 Main-process visible strings (`src/main`, `src/cli`, `src/relay`, `src/shared`)
- [x] T2 Renderer copy and locale catalogs left over
- [x] T3 Mobile `app.json`, mobile copy and TestFlight/store text

## Checks

`pnpm tc:node`, `pnpm typecheck:web`, `tsc-cli`, mobile typecheck, `build:mobile-web`, affected tests, `src/main/startup/desktop-identity-contract.test.ts`.

## Delivery

Branch `fix/rebrand-visible-massorca` from `custom/pv27-unified`, one work-unit commit per task, no push. Strategy: ask-on-risk (mechanical string churn; the parent decides PR slicing).

## Progress

- Engram mirror `odd/rebrand-visible-massorca/tasks`: pending (save hook refused, host session ended).
- T1: 829 literals in 329 files plus tests. The recoverable-error classifier keeps the old orca fragments for older hosts. Left alone: agent prompts, Orca Cloud/Relay/Mobile/Computer Use names, persisted markers, X-Orca headers, TERM_PROGRAM, paths, generated src/cli/bundled-skill-guides.ts. Checks: tsc node/cli/web 0 errors; classifier tests pass; check:code-quality:changed unverified (timed out).
- T3: app.json permission prompts, Fastfile TestFlight changelog, Android release banner and GitHub release title, mobile web <title>, mobile timeout text and tests. The host card relay label is `MassOrca Relay` (mobile/src/transport/mobile-connection-path-label.ts:5), so the card tests guard that label. Left alone: upstream labels on the about screen, ids, schemes, fixtures, comments. Checks: mobile tsc 0 errors; 8 edited mobile test files 123/123 pass (incl. the 3 react-test-renderer files); build:mobile-web and its verify OK; oxlint pass.
- T2: renderer remote-runtime and terminal notices, settings search keywords, renderer tests, locale override/policy scripts (so catalog regeneration no longer reinserts Orca), and an e2e dialog guard that accepts both spellings. No translate() fallback changed, so no catalog keys moved. Left alone: font family, third-party attribution, agent prompts, console logs, fixtures, comments. Follow-up: 5 zh/ja/ko overrides now apply and differ from the shipped catalogs; translators decide. Checks: tsc web/node/cli 0 errors; 42 locale/i18n/identity files 379/379 pass; 12 renderer files asserting the new copy 188/188 pass; oxlint and oxfmt clean.
- Reviews: T1 e420d1dead3 declined (lens_context_budget_exceeded, 422 files). T3 556a0b97f07 abandoned after captured_artifacts_unverifiable (findings came from a stale doc line, fixed in fcdb45cbd4b). T2 469f7ff8b3a approved after one correction e1923274dd9 (CJK brand repair accepts Orca and MassOrca); acknowledged. Advisory follow-ups: CJK spacing and mistranslation maps lost Orca-only coverage, ja unified-value key alignment unproved, timeout message not in the classifier test, renamed hidden-output notices lack direct tests.
- Open decisions for the parent: product names kept as Orca (Orca Cloud, Orca Relay on desktop, Orca Mobile firewall name, Orca Computer Use), X-Orca headers, generated src/cli/bundled-skill-guides.ts (sources in skills/ and skill-guides/).

- Decisions applied (user, 2026-10-29: accept recommendations): a9041ec27c5 desktop pairing guidance says MassOrca Relay; 57803e66f61 agent-facing prompts say MassOrca, keeping the parsed dispatch-status sentence (see M6) and fixing 4 stale session-ID expectations from T1. Review of both: abandoned after repeated operation_timeout. Known base failure: agent-facing-parity guide line limit (skill-guides/orchestration.md, M1).

## Follow-up plan: full MassOrca identity migration

The user wants the whole identity to point at MassOrca, even where that means redoing something (2026-10-29). This section tracks every remaining "Orca" identity item. Nothing here is implemented yet. Items are ordered by user visibility, then risk. Each lands as its own feature with tests.

- [ ] M1 Bundled skill guides. What: agent-facing skill text in `skills/` and `skill-guides/`, generated into `src/cli/bundled-skill-guides.ts` (227 mentions). Deferred: generated; this change only covered text edited in place. Approach: edit the sources, keeping the lowercase `orca` CLI commands; regenerate; add a guard test that the generated file has no bare `Orca` brand outside commands and paths.
- [ ] M2 zh/ja/ko overrides vs catalogs. What: 5 override entries now apply and differ from the shipped catalogs (zh "MassOrca Mobile" labels, ja Browser Use spacing, 2 ko entries). Also, a few `menu.*` keys in `locale-key-overrides.mjs` already disagreed before this change. Deferred: translation content needs a reader of each language. Approach: a native reader picks the value; regenerate the catalogs; the identity contract test stays green.
- [ ] M3 Orca Cloud naming. What: the "Orca Cloud" sign-in/service label (`src/main/orca-profiles/profile-cloud-auth-config.ts:63`, dead ja override at `config/scripts/locale-ja-value-overrides.mjs:303`), and docs (`docs/site`). Deferred: names the upstream-owned service, so first decide whether MassOrca runs its own cloud. Approach: if MassOrca owns the endpoint, rename the label only; endpoints and OAuth client IDs stay as they are until a MassOrca backend exists.
- [ ] M4 Windows mobile firewall rule. What: rule name, display name and "Orca Mobile" description (`src/main/runtime/windows-mobile-firewall.ts:11,12,226`). Deferred: a plain rename leaves the old rule behind and a second rule open. Approach: on upgrade, create the MassOrca rule, then delete the old-named rule. Use the existing elevated path, idempotent and safe to retry; detect by the old name. Cover it in tests with both rules present, only the old one, and only the new one.
- [ ] M5 Orca Computer Use helper. What: the helper bundle and app name in `src/main/computer/*.ts` and `src/cli/handlers/computer.ts:56,66`, which macOS shows in Privacy & Security prompts. Deferred: renaming the bundle on disk invalidates granted TCC permissions and existing paths. Approach: ship the new bundle name alongside the old one, migrate on first launch (move or reinstall, then remove the old one), and tell the user once that macOS will ask for permission again. Keep detection of the old path for a release.
- [ ] M6 Remaining non-visible strings. What: the dispatch-status sentence (src/shared/orca-dispatch-status-prompt.ts:9,14, preamble.ts:87, parsed by agent-row-primary-text.ts and agent-status-field-normalization.ts), about 30 main-process log lines, test titles, comments, the `Orca:` feedback footer marker (`src/shared/client-environment-info.ts:12`), truncation markers (`journal-payload-bounds.ts:24`, `structured-agent-session-projection.ts:64`, `agent-session-delta-coalescer.ts:23`), the serve readiness marker (`src/main/server/serve-readiness.ts:98`, matched by `config/scripts/run-headless-linux-pairing-docker.mjs:313`), and the mobile e2e and dev scripts. Deferred: markers are parsed back. Approach: change logs and comments freely. For each marker, accept old and new on read first and write the new one a release later.
- [ ] M7 Ownership markers written into users' config. What: `src/main/amp/agent-status-plugin-source.ts:2`, `src/main/hermes/hermes-managed-plugin-source.ts:2`, `src/main/cli/wsl-cli-scripts.ts:3-4`, `src/main/dsh/dsh-home-patch.ts:17`, `src/main/kimi/kimi-hook-config-toml.ts:33`, `src/main/codex/codex-hook-legacy-cleanup.ts:28-29`, `src/main/shell-templates.ts:9`. Deferred: cleanup code finds its own blocks by the old marker. Approach: detect both markers, rewrite to the new marker the next time the block is refreshed, and drop old-marker detection only after a migration window.
- [ ] M8 Environment identity. What: `TERM_PROGRAM` (`spawn-environment.ts:178`, `local-pty-spawn-environment.ts:33`, `src/relay/pty-handler.ts:906`), shell-ready `headerLabel`, the Codex client title (`codex-app-server-handshake.ts:11`), the Jira user agent, the TLS certificate CN (`src/main/runtime/tls-certificate.ts:54`), `--who=Orca` (`linux-lid-sleep-assertion.ts:81`), the git initial-commit identity, and the keychain service (`src/main/claude-accounts/keychain.ts:12`). Deferred: user tools and shell configs key on `TERM_PROGRAM`; the keychain service holds stored credentials; a CN change can break pinned certificates. Approach: per item. Keep `TERM_PROGRAM` (or add a MassOrca-specific variable). Move keychain entries by reading the old service, writing the new one, then deleting the old entry. Regenerate the certificate with a new CN, keeping the old one trusted for a while.
- [ ] M9 Wire names and identifiers shared with paired peers. What: `X-Orca-Agent-Hook-*` headers (25 sites), the `ORCA-*` probe markers in SSH relay deploy, `orcad` migration codes (`src/main/ssh/orcad-migration-catalog-client.ts:33`), RPC names, the `orca://` scheme, `ORCA_*` env vars, storage keys (`orca:` mobile keys), IPC channels. Deferred: clients and hosts update independently (AGENTS.md "Remote Wire Compatibility"). Approach: add new names alongside the old ones. Accept both on read, keep writing the old name until a capability flag says the peer understands the new one, then switch writes; the old name is never removed while supported versions still send it. Register a `massorca://` scheme in addition to `orca://`, and keep both.
- [ ] M10 Install identity. What: `productName`/`executableName` `Orca`, `appId` `com.stablyai.orca`, mac `CFBundleName` (Keychain), Linux `orca-ide` package, the NSIS artifact name, install paths (`/opt/Orca`, `%LOCALAPPDATA%\Programs\Orca`), userData folder, the mobile bundle IDs `com.stably.orca.mobile`, and `Orca.xcworkspace`/scheme. Deferred: highest risk; changing these makes a new app that does not upgrade the old one, loses userData and Keychain access, and breaks shortcuts and the VPS service. Approach: decide whether MassOrca becomes a separate app. If so: new appId and productName, plus a first-run importer that copies userData and settings from the Orca folder. Keychain items are migrated by the old-signed build before the switch. Run the installer side by side, then uninstall the old one. Mobile ships under a new bundle ID as a new store app. `desktop-identity-contract.test.ts` pins today's values and changes with this item.
