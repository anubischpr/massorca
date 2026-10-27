// Why: below this width the action row leaves the pill under ~40pt for the name, so it reads as noise.
export const MODEL_PILL_ICON_ONLY_BELOW_WIDTH = 360

/** The pill drops the model name on narrow screens, but only when an agent icon can stand in for it. */
export function isModelPillIconOnly(windowWidth: number, hasAgentIcon: boolean): boolean {
  return hasAgentIcon && windowWidth < MODEL_PILL_ICON_ONLY_BELOW_WIDTH
}
