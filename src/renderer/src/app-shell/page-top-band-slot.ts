import { createBarActionsSlot } from './bar-actions-slot'

const slot = createBarActionsSlot()

export const setPageTopBandActionsTarget = slot.setTarget

/** The element a page renders its own toggle into, next to the window controls; null with no band. */
export const usePageTopBandActionsTarget = slot.useTarget
