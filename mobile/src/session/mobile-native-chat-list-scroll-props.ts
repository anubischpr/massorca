/** Scroll behavior of the native chat transcript list, shared by every provider's chat. */
export const MOBILE_NATIVE_CHAT_LIST_SCROLL_PROPS = {
  // Let link/file taps land while the composer keyboard is up
  // instead of being swallowed by the dismiss gesture.
  keyboardShouldPersistTaps: 'handled',
  scrollEventThrottle: 32,
  // Why: Android defaults this on, detaching rows as they leave the window and re-attaching them
  // mid-drag, so markdown rows visibly repaint under the finger.
  removeClippedSubviews: false,
  // Why: rows above the viewport (history pages, late-measured markdown, code and visuals) change
  // height after they mount; anchoring the first visible row keeps a drag from jumping.
  maintainVisibleContentPosition: { minIndexForVisible: 0 }
} as const
