import type { RefObject } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import type { ConnectionState } from '../transport/types'
import type { TerminalWebViewHandle } from './TerminalWebView'
import type { TerminalFrame } from './terminal-webview-messages'

export type TerminalViewportDims = { cols: number; rows: number }

export type TerminalViewportRefitOptions = {
  activeHandleRef: RefObject<string | null>
  terminalRefs: RefObject<Map<string, TerminalWebViewHandle>>
  // The terminal frame React Native laid out, unrounded; null until its first layout.
  terminalFrameRef: RefObject<TerminalFrame | null>
  viewportRef: RefObject<TerminalViewportDims | null>
  viewportMeasuredRef: RefObject<boolean>
  // Why: while native chat covers the active terminal, a refit would push phone dims into a PTY nobody on this device is viewing.
  nativeChatCoveredRef: RefObject<boolean>
  clientRef: RefObject<RpcClient | null>
  deviceTokenRef: RefObject<string | null>
  initializedHandlesRef: RefObject<Set<string>>
  connState: ConnectionState
  tabStripVisible: boolean
  // Why: text size (font scale); changing it changes cell size, so the PTY must be re-fitted to a new column count.
  textScale: number
  unsubscribeTerminal: (handle: string) => void
  subscribeToTerminal: (handle: string) => void
}
