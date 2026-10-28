// The sheet's empty-state copy for a chat's background work, shared by the chat and terminal lanes.

/** Nothing runs, and the host lists nothing that does. */
export const NO_BACKGROUND_WORK_NOTE = 'No background work is running.'

/** Work runs, but the host reports it without details. */
export const UNLISTED_BACKGROUND_WORK_NOTE =
  'Background work is running. This agent does not report its details.'
