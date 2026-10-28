import { saveTerminalTextScale } from '../storage/preferences'
import { TerminalPaneView } from './TerminalPaneView'
import type { MobileSessionController } from './use-mobile-session-controller'

/** Every terminal pane of the session. Inactive panes stay mounted, so each keeps its xterm state. */
export function MobileTerminalPaneStack({ controller }: { controller: MobileSessionController }) {
  const {
    terminals,
    activeHandle,
    activeTerminalKeyboardLift,
    terminalTextScale,
    setTerminalTextScale,
    setTerminalWebViewRef,
    handleTerminalWebReady,
    notifyTerminalCellBoxChange,
    handleSelectionMode,
    handleSelectionCopy,
    handleSelectionEvicted,
    handleModesChanged,
    handleKeyboardAvoidanceMetrics,
    handleHaptic,
    handleTerminalInput,
    handleTerminalQueryReply,
    handleTerminalTap,
    handleFileTap,
    handleTerminalOpenUrl
  } = controller
  return (
    <>
      {terminals.map((terminal) => (
        <TerminalPaneView
          key={terminal.handle}
          handle={terminal.handle}
          active={terminal.handle === activeHandle}
          keyboardLift={terminal.handle === activeHandle ? activeTerminalKeyboardLift : 0}
          terminalTheme={terminal.terminalTheme}
          textScale={terminalTextScale}
          onTextScaleChange={(scale) => {
            // Why: pinch-to-zoom reports a new preset; persist it so the size sticks across panes and launches.
            setTerminalTextScale(scale)
            void saveTerminalTextScale(scale)
          }}
          onRef={setTerminalWebViewRef}
          onWebReady={handleTerminalWebReady}
          onCellBoxChange={notifyTerminalCellBoxChange}
          onSelectionMode={handleSelectionMode}
          onSelectionCopy={handleSelectionCopy}
          onSelectionEvicted={handleSelectionEvicted}
          onModesChanged={handleModesChanged}
          onKeyboardAvoidanceMetrics={handleKeyboardAvoidanceMetrics}
          onHaptic={handleHaptic}
          onTerminalInput={handleTerminalInput}
          onTerminalQueryReply={handleTerminalQueryReply}
          onTerminalTap={handleTerminalTap}
          onFileTap={handleFileTap}
          onOpenUrl={handleTerminalOpenUrl}
        />
      ))}
    </>
  )
}
