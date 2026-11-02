import { createBarActionsSlot } from './bar-actions-slot'

const slot = createBarActionsSlot()

export const setSessionBarActionsTarget = slot.setTarget

/** The element panes render their session actions into; null when no bar is mounted. */
export const useSessionBarActionsTarget = slot.useTarget
