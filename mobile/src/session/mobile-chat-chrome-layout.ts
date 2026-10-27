import { createContext } from 'react'
import { spacing } from '../theme/mobile-theme'

/** The transcript's start below the floating controls, before the controls have been measured. The
 *  bar and the session chip take about this much under a 390-wide phone's status bar. */
export const MOBILE_CHAT_CHROME_CONTENT_TOP = 128

export type MobileChatChromeLayout = {
  /** The floating controls' measured height in pixels, from the top of the content column; 0 when
   *  no floating controls are on screen. */
  height: number
  setHeight: (height: number) => void
}

export const MobileChatChromeLayoutContext = createContext<MobileChatChromeLayout>({
  height: 0,
  setHeight: () => undefined
})

/**
 * Where a chat's transcript starts: just beneath the measured controls. Before the first measurement,
 * the fixed estimate below the status bar stands in.
 */
export function mobileChatContentTop(measuredHeight: number, insetTop: number): number {
  return measuredHeight > 0
    ? measuredHeight + spacing.sm
    : insetTop + MOBILE_CHAT_CHROME_CONTENT_TOP
}
