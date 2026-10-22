// Why: the name people see in window titles, menus, About, installers and shortcuts.
// Electron's runtime app name stays 'Orca' (see main/startup/dev-instance-identity.ts),
// because it keys the macOS Keychain item and other name-derived storage on existing installs.
export const PRODUCT_DISPLAY_NAME = 'MassOrca'

// Why: the production profile is <appData>/orca on every platform. The CLI and the Codex
// home resolve the same directory, so the app pins it instead of deriving it from the name.
export const PRODUCTION_USER_DATA_DIR_NAME = 'orca'
