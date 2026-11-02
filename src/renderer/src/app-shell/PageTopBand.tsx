import { cn } from '@/lib/utils'
import { TitlebarLeftControls } from './TitlebarLeftControls'
import { TitlebarMainStrip } from './TitlebarMainStrip'
import { TOP_BAR_SURFACE_CLASS } from './top-bar-surface'
import type { AppChromeLayout } from './use-app-chrome-layout'

/**
 * The 44px band a page without a session bar (settings, tasks and the like) gets at the top of
 * the center column. It never spans the rail or the left sidebar, which reach the window top.
 */
export function PageTopBand({
  layout,
  withLeftControls
}: {
  layout: AppChromeLayout
  /** True when no sidebar-column header carries the menu, sidebar toggle and history controls. */
  withLeftControls: boolean
}): React.JSX.Element {
  return (
    <div
      data-page-top-band="true"
      data-terminal-focus-release-surface="true"
      className={cn('flex h-11 min-h-11 shrink-0 select-none items-center', TOP_BAR_SURFACE_CLASS)}
    >
      {withLeftControls ? (
        <div className="mr-2 flex shrink-0 items-center">
          <TitlebarLeftControls layout={layout} />
        </div>
      ) : null}
      <TitlebarMainStrip layout={layout} />
    </div>
  )
}
