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
- [ ] T2 Renderer copy and locale catalogs left over
- [x] T3 Mobile `app.json`, mobile copy and TestFlight/store text

## Checks

`pnpm tc:node`, `pnpm typecheck:web`, `tsc-cli`, mobile typecheck, `build:mobile-web`, affected tests, `src/main/startup/desktop-identity-contract.test.ts`.

## Delivery

Branch `fix/rebrand-visible-massorca` from `custom/pv27-unified`, one work-unit commit per task, no push. Strategy: ask-on-risk (mechanical string churn; the parent decides PR slicing).

## Progress

- Engram mirror `odd/rebrand-visible-massorca/tasks`: pending (save hook refused, host session ended).
- T1: 829 literals in 329 files plus tests. The recoverable-error classifier keeps the old orca fragments for older hosts. Left alone: agent prompts, Orca Cloud/Relay/Mobile/Computer Use names, persisted markers, X-Orca headers, TERM_PROGRAM, paths, generated src/cli/bundled-skill-guides.ts. Checks: tsc node/cli/web 0 errors; classifier tests pass; check:code-quality:changed unverified (timed out).
- T3: app.json permission prompts, Fastfile TestFlight changelog, Android release banner and GitHub release title, mobile web <title>, mobile timeout text and tests. Left alone: upstream labels on the about screen, ids, schemes, fixtures, comments. Checks: oxlint pass; 5 test files (81 tests) pass via scratch config; mobile typecheck, build:mobile-web and 3 react-test-renderer tests blocked (mobile/node_modules not installed).
