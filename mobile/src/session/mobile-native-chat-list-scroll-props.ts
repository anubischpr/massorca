/** Scroll behavior of the native chat transcript list while the view follows the tail. */
const FOLLOWING_TAIL_SCROLL_PROPS = {
  // Let link/file taps land while the composer keyboard is up
  // instead of being swallowed by the dismiss gesture.
  keyboardShouldPersistTaps: 'handled',
  scrollEventThrottle: 32,
  // Why: Android defaults this on, detaching rows as they leave the window and re-attaching them
  // mid-drag, so markdown rows visibly repaint under the finger.
  removeClippedSubviews: false
} as const

/** The same list once the user has left the tail. */
const DETACHED_SCROLL_PROPS = {
  ...FOLLOWING_TAIL_SCROLL_PROPS,
  // Why: rows above the viewport (history pages, late-measured markdown, code and visuals) change
  // height after they mount; anchoring the first visible row keeps a drag from jumping. While the
  // tail is followed the pin owns the position, and anchoring as well made a jump bounce.
  maintainVisibleContentPosition: { minIndexForVisible: 0 }
} as const

/** Stable per state, so the list never sees a new props object while nothing changed. */
export function mobileNativeChatListScrollProps(followingTail: boolean) {
  return followingTail ? FOLLOWING_TAIL_SCROLL_PROPS : DETACHED_SCROLL_PROPS
}
