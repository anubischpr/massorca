import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MergePreviewPlacement } from '../../../src/shared/prototype-merge-preview-document'
import {
  keptMergeParts,
  type PrototypeMergeReviewPart
} from '../../../src/shared/prototype-merge-plan'
import { latestVersionOf } from '../../../src/shared/prototype-list-model'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { readMobilePrototypeFile } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import {
  buildMergePreviewRequest,
  mergePreviewFromResponse,
  type MergePreviewRequest,
  type MergePreviewResponse
} from './mobile-merge-preview-composer'

export type MobileMergePreview = {
  /** The composed page for the parts as they are now; null until the composer answers for them. */
  html: string | null
  /** Where each kept part ended up, by part id; a part without an entry is placed. */
  placement: Readonly<Record<number, MergePreviewPlacement>>
  /** The request for the composer; null until every direction the kept parts use was read. */
  request: MergePreviewRequest | null
  /** The composer's answer to any request. */
  onResponse: (response: MergePreviewResponse) => void
  /** The composer could not answer the current request. */
  failed: boolean
}

type DirectionsHtml = { ready: boolean; htmlByLetter: Readonly<Record<string, string>> }

const NOT_READY: DirectionsHtml = { ready: false, htmlByLetter: {} }

/** The latest file of each starred direction, read from the host; a new file name reads again. */
function useDirectionsHtml(
  client: RpcClient | null,
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId' | 'directions'>,
  letters: readonly string[]
): DirectionsHtml {
  const [state, setState] = useState<DirectionsHtml>(NOT_READY)
  const { sessionId, requestId } = set
  const filesKey = letters
    .map((letter) => {
      const direction = set.directions.find((candidate) => candidate.letter === letter)
      return `${letter}=${latestVersionOf(direction)?.fileName ?? ''}`
    })
    .join('|')
  useEffect(() => {
    if (client === null) {
      setState(NOT_READY)
      return
    }
    let active = true
    setState(NOT_READY)
    void Promise.all(
      filesKey.split('|').map(async (entry): Promise<readonly [string, string | null]> => {
        const [letter = '', fileName = ''] = entry.split('=')
        if (fileName === '') {
          return [letter, null]
        }
        try {
          const read = await readMobilePrototypeFile(client, { sessionId, requestId, fileName })
          return [letter, read.kind === 'ready' ? read.html : null]
        } catch {
          // A read that throws leaves that direction's parts unplaced.
          return [letter, null]
        }
      })
    ).then((entries) => {
      if (!active) {
        return
      }
      const htmlByLetter: Record<string, string> = {}
      for (const [letter, html] of entries) {
        if (html !== null) {
          htmlByLetter[letter] = html
        }
      }
      setState({ ready: true, htmlByLetter })
    })
    return () => {
      active = false
    }
  }, [client, sessionId, requestId, filesKey])
  return state
}

/**
 * The live merge preview: the starred directions' HTML is read from the host, the kept parts become a
 * composer request, and the composer's answer becomes the page and the marks. Only the latest request
 * counts, so an answer to an older set of parts is never shown.
 */
export function useMobilePrototypeMergePreview({
  client,
  set,
  letters,
  parts
}: {
  client: RpcClient | null
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId' | 'directions'>
  letters: readonly string[]
  parts: readonly PrototypeMergeReviewPart[]
}): MobileMergePreview {
  const directions = useDirectionsHtml(client, set, letters)
  const kept = useMemo(() => keptMergeParts(parts), [parts])
  const requestCount = useRef(0)
  const request = useMemo(() => {
    if (!directions.ready) {
      return null
    }
    requestCount.current += 1
    return buildMergePreviewRequest({
      requestId: requestCount.current,
      htmlByLetter: directions.htmlByLetter,
      parts: kept
    })
  }, [directions, kept])
  const [response, setResponse] = useState<MergePreviewResponse | null>(null)
  const onResponse = useCallback((next: MergePreviewResponse) => setResponse(next), [])
  const current =
    response !== null && request !== null && response.requestId === request.requestId
      ? response
      : null
  const composition = useMemo(
    () =>
      current !== null && current.ok
        ? mergePreviewFromResponse({ parts: kept, response: current })
        : null,
    [current, kept]
  )
  return {
    html: composition?.html ?? null,
    placement: composition?.placement ?? {},
    request,
    onResponse,
    failed: current !== null && !current.ok
  }
}
