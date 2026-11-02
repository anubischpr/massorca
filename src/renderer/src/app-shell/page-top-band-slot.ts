import { createBarActionsSlot } from './bar-actions-slot'

const slot = createBarActionsSlot()

const titleSlot = createBarActionsSlot()

export const setPageTopBandActionsTarget = slot.setTarget

export const setPageTopBandTitleTarget = titleSlot.setTarget

/** The element a page renders its title into, at the band's left; null with no band. */
export const usePageTopBandTitleTarget = titleSlot.useTarget

/** The element a page renders its own toggle into, next to the window controls; null with no band. */
export const usePageTopBandActionsTarget = slot.useTarget
