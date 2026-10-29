import { useRef, type RefObject } from 'react'
import { translate } from '@/i18n/i18n'
import { NativeChatVisualFrame } from '../native-chat/NativeChatVisualFrame'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState
} from '../../../../shared/native-chat-visual-annotate'
import type { PrototypeFileHtml } from './use-prototype-file-html'

/** The frame's width in CSS pixels by viewport: a desktop or a phone screen. */
export const PROTOTYPE_FRAME_WIDTH = { desktop: 640, phone: 360 } as const

/**
 * One prototype on screen: blank while it loads, one line when it cannot be opened, else the live
 * page with its annotate state. A frame that stops answering is reported like an unreadable one.
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
  viewport: keyof typeof PROTOTYPE_FRAME_WIDTH
  annotate: NativeChatVisualAnnotateState
  onAnnotateEvent: (event: NativeChatVisualAnnotateEvent) => void
  boxRef: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const scopeRef = useRef<HTMLDivElement | null>(null)
  const width = PROTOTYPE_FRAME_WIDTH[viewport]
  return (
    <div
      ref={(element) => {
        scopeRef.current = element
        boxRef.current = element
      }}
      className="relative flex h-[640px] max-h-[70vh] min-h-0 flex-col overflow-hidden rounded-lg bg-card text-card-foreground"
      style={{ width }}
    >
      {file.status === 'error' ? (
        <p className="p-6 text-sm text-muted-foreground">
          {translate('components.prototypes.frameError', "Couldn't open this prototype")}
        </p>
      ) : null}
      {file.status === 'ready' ? (
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
      ) : null}
    </div>
  )
}
