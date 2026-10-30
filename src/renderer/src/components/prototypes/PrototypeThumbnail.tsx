import { useEffect, useRef, useState } from 'react'
import { NativeChatVisualFrame } from '../native-chat/NativeChatVisualFrame'
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { latestVersionOf } from '../../../../shared/prototype-list-model'
import { PROTOTYPE_FRAMES } from '../../../../shared/prototype-frames'
import { usePrototypeFileHtml } from './use-prototype-file-html'

/** The design size of a thumbnail's page: the desktop artboard, which keeps the 1.6:1 ratio. */
const THUMBNAIL_DESIGN_WIDTH = PROTOTYPE_FRAMES.desktop.width
const THUMBNAIL_DESIGN_HEIGHT = PROTOTYPE_FRAMES.desktop.height

/** A live, scaled-down render of a direction's latest version; it takes no pointer input. */
export function PrototypeThumbnail({
  set,
  direction
}: {
  set: PrototypeListedSet
  direction: PrototypeListedDirection | undefined
}): React.JSX.Element {
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
    const measure = (): void => setScale(element.clientWidth / THUMBNAIL_DESIGN_WIDTH)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={scopeRef}
      aria-hidden="true"
      className="pointer-events-none relative w-full overflow-hidden rounded-md bg-card"
      style={{ aspectRatio: `${THUMBNAIL_DESIGN_WIDTH} / ${THUMBNAIL_DESIGN_HEIGHT}` }}
    >
      {file.status === 'ready' ? (
        <div
          className="absolute top-0 left-0 flex origin-top-left flex-col"
          style={{
            width: THUMBNAIL_DESIGN_WIDTH,
            height: THUMBNAIL_DESIGN_HEIGHT,
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
