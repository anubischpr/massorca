// Where a structured chat's visuals folder sits under the host's state directory. Shared so the host
// that creates those folders and the path predicates that leave them out name one layout.

/** The folder under the host's state directory that holds every chat's visuals. */
export const NATIVE_CHAT_VISUALS_DIR_NAME = 'native-chat-visuals'

/** A chat's own folder name: the first 32 hex characters of the SHA-256 of its session id. */
export const NATIVE_CHAT_VISUALS_CHAT_FOLDER_PATTERN = /^[0-9a-f]{32}$/u
