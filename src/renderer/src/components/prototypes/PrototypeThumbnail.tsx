import { useEffect, useRef, useState } from 'react'
import { NativeChatVisualFrame } from '../native-chat/NativeChatVisualFrame'
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { latestVersionOf } from '../../../../shared/prototype-list-model'
import { PROTOTYPE_FRAME_WIDTH } from './PrototypeFrame'
import { usePrototypeFileHtml } from './use-prototype-file-html'

/** The design height of a thumbnail's page by viewport: a desktop page is 1.6:1, a phone page as tall as its frame. */
const THUMBNAIL_DESIGN_HEIGHT = { desktop: 400, phone: 640 } as const

/** A live, scaled-down render of a direction's latest version; it takes no pointer input. */
export function PrototypeThumbnail({
  set,
  direction,
  viewport = 'desktop'
}: {
  set: PrototypeListedSet
  direction: PrototypeListedDirection | undefined
  /** The page is drawn at this viewport's frame width, so a phone thumbnail is a phone-width page. */
  viewport?: keyof typeof PROTOTYPE_FRAME_WIDTH
}): React.JSX.Element {
  const designWidth = PROTOTYPE_FRAME_WIDTH[viewport]
  const designHeight = THUMBNAIL_DESIGN_HEIGHT[viewport]
  const latest = latestVersionOf(direction)
  const file = usePrototypeFileHtml(
    latest === null
      ? null
      : { sessionId: set.sessionId, requestId: set.requestId, fileName: latest.fileName }
  )
  const scopeRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const element = scopeRef.current
    if (element === null) {
      return
    }
    const measure = (): void => setScale(element.clientWidth / designWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [designWidth])
  return (
    <div
      ref={scopeRef}
      aria-hidden="true"
      className="pointer-events-none relative w-full overflow-hidden rounded-md bg-card"
      style={{ aspectRatio: `${designWidth} / ${designHeight}` }}
    >
      {file.status === 'ready' ? (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`
          }}
        >
          <NativeChatVisualFrame
            document={{ revision: latest?.fileName ?? '', html: file.html }}
            title=""
            layout="panel"
            themeScope={scopeRef}
            onRetired={() => undefined}
          />
        </div>
      ) : null}
    </div>
  )
}
