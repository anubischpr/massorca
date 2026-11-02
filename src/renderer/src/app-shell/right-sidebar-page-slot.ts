import { createBarActionsSlot } from './bar-actions-slot'

const slot = createBarActionsSlot()

export const setRightSidebarPageTarget = slot.setTarget

/** The right sidebar's body while a page owns it; null when the sidebar is closed. */
export const useRightSidebarPageTarget = slot.useTarget
