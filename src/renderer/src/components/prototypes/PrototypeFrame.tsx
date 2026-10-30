import { useEffect, useRef, useState, type RefObject } from 'react'
import { translate } from '@/i18n/i18n'
import { NativeChatVisualFrame } from '../native-chat/NativeChatVisualFrame'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState
} from '../../../../shared/native-chat-visual-annotate'
import { prototypeFrameLayout } from '../../../../shared/prototype-frames'
import type { PrototypeViewport } from '../../../../shared/prototype-set-state'
import type { PrototypeFileHtml } from './use-prototype-file-html'

/**
 * One prototype on screen at its true size, scaled down to fit the pane: blank while it loads, one
 * line when it cannot be opened, else the live page with its annotate state. A frame that stops
 * answering is reported like an unreadable one.
 */
export function PrototypeFrame({
  file,
  fileKey,
  viewport,
  annotate,
  onAnnotateEvent,
  boxRef
}: {
  file: PrototypeFileHtml
  fileKey: string
  viewport: PrototypeViewport
  annotate: NativeChatVisualAnnotateState
  onAnnotateEvent: (event: NativeChatVisualAnnotateEvent) => void
  boxRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const areaRef = useRef<HTMLDivElement | null>(null)
  const scopeRef = useRef<HTMLDivElement | null>(null)
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = areaRef.current
    if (element === null) {
      return
    }
    const measure = (): void => {
      const { width, height } = element.getBoundingClientRect()
      setAvailable({ width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const layout = prototypeFrameLayout(viewport, available)
  return (
    <div ref={areaRef} className="flex min-h-0 w-full flex-1 justify-center">
      {layout === null ? null : (
        <div
          ref={(element) => {
            scopeRef.current = element
            boxRef.current = element
          }}
          className="relative overflow-hidden rounded-lg bg-card text-card-foreground"
          style={{ width: layout.boxWidth, height: layout.boxHeight }}
        >
          {file.status === 'error' ? (
            <p className="p-6 text-sm text-muted-foreground">
              {translate('components.prototypes.frameError', "Couldn't open this prototype")}
            </p>
          ) : null}
          {file.status === 'ready' ? (
            <div
              // The panel layout fills a flex parent, so the artboard is one.
              className="absolute top-0 left-0 flex origin-top-left flex-col"
              style={{
                width: layout.designWidth,
                height: layout.designHeight,
                transform: `scale(${layout.scale})`
              }}
            >
              <NativeChatVisualFrame
                key={fileKey}
                document={{ revision: fileKey, html: file.html }}
                title={translate('components.prototypes.frameTitle', 'Prototype')}
                layout="panel"
                themeScope={scopeRef}
                onRetired={() => undefined}
                annotate={annotate}
                onAnnotateEvent={onAnnotateEvent}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
