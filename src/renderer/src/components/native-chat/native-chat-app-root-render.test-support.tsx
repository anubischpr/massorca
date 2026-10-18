import type { ReactNode } from 'react'
import { render as baseRender, type RenderResult } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Mounts a tree under the TooltipProvider the app root provides (App.tsx); the chat pane's tooltips
 * rely on it. rerender keeps the provider.
 */
export function renderAtAppRoot(ui: ReactNode): RenderResult {
  const view = baseRender(<TooltipProvider delayDuration={400}>{ui}</TooltipProvider>)
  return {
    ...view,
    rerender: (next: ReactNode) =>
      view.rerender(<TooltipProvider delayDuration={400}>{next}</TooltipProvider>)
  }
}
