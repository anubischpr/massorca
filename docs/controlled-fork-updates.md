# Controlled fork updates

Custom releases from `anubischpr/orca` must be built with `ORCA_MANUAL_UPDATES=1`.
Set it for every platform's Electron packaging command, alongside the existing
private version and `--publish never`. The builder embeds `orcaDistribution`
in the installed `package.json`; verify that the packaged artifact contains
`repository: anubischpr/orca` and `updatePolicy: manual` before installation.
An unknown or unreadable marked identity refuses managed updates.

The marker disables startup, wake, timer, campaign, menu, local/pinned build,
download, install and release fallback paths. Remote update RPC reports the
existing manual-service-update requirement. The menu explains that a maintainer
must supply a verified build. Unmarked official builds retain their updater.
Changing `app-update.yml` or setting a runtime environment variable is insufficient.
This policy does not disable independent agent, skill or plugin update systems.

Keep `main` as the upstream reference and integrate reviewed PR chains into
`custom/stable`, initially based on official tag `v1.4.224`, not today's upstream
main. Deliberately select an upstream release, integrate custom changes, run
checks and packaging guards, then produce and hash Windows/Linux artifacts.
No update is downloaded or installed automatically by this distribution.

Before manual installation, coordinate active work, back up installed binaries
and same-host profiles with their private permissions, and retain the previous
artifact. Preserve pairing, accounts and the separate daemon. Validate startup,
version, private connectivity and custom features after replacement. Restore the
previous binary if validation fails; profile/schema compatibility must be checked
separately, so rollback is not an unconditional guarantee. Keep native signing
verification intact; an unsigned private build must not claim an official signature.

Existing installed custom builds do not acquire this protection until rebuilt
and deliberately replaced with a marked artifact.
