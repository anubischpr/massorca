// The Components tab's view (grid, collage or list) remembered for this viewer. The browser store is only a
// convenience: when it is missing, blocked or full, the view falls back to the default and holds for the session.

export const COMPONENTS_VIEWS = ['grid', 'collage', 'list'] as const

export type ComponentsView = (typeof COMPONENTS_VIEWS)[number]

export const DEFAULT_COMPONENTS_VIEW: ComponentsView = 'collage'

const STORAGE_KEY = 'orca.prototypes.designSystem.componentsView'

function isComponentsView(value: unknown): value is ComponentsView {
  return COMPONENTS_VIEWS.some((view) => view === value)
}

/** The view this viewer last chose; the default when none is stored or the store cannot be read. */
export function readComponentsView(): ComponentsView {
  try {
    const stored: unknown = window.localStorage.getItem(STORAGE_KEY)
    return isComponentsView(stored) ? stored : DEFAULT_COMPONENTS_VIEW
  } catch {
    return DEFAULT_COMPONENTS_VIEW
  }
}

/** Remembers the view; a store that refuses the write keeps the view for this session only. */
export function writeComponentsView(view: ComponentsView): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // No store: the chosen view still shows for this session.
  }
}
