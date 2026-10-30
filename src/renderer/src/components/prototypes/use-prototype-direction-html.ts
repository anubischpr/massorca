import { useEffect, useState } from 'react'
import { latestVersionOf } from '../../../../shared/prototype-list-model'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { readPrototypeSetFileOnHost } from '../../runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

export type PrototypeDirectionsHtml = {
  /** False until every direction was read or refused. */
  ready: boolean
  /** The latest HTML of each direction that could be read, by letter. */
  htmlByLetter: Readonly<Record<string, string>>
}

const LOADING: PrototypeDirectionsHtml = { ready: false, htmlByLetter: {} }

/** The latest file of each listed direction, read from the host; a new file name reads again. */
export function usePrototypeDirectionsHtml(
  set: Pick<PrototypeListedSet, 'sessionId' | 'requestId' | 'directions'>,
  letters: readonly string[]
): PrototypeDirectionsHtml {
  const [state, setState] = useState<PrototypeDirectionsHtml>(LOADING)
  const { sessionId, requestId } = set
  const files = letters.map((letter) => ({
    letter,
    fileName: latestVersionOf(set.directions.find((direction) => direction.letter === letter))
      ?.fileName
  }))
  const filesKey = files.map((file) => `${file.letter}=${file.fileName ?? ''}`).join('|')
  useEffect(() => {
    let active = true
    setState(LOADING)
    const target = prototypeTargetForSession(sessionId)
    void Promise.all(
      filesKey
        .split('|')
        .map((entry) => entry.split('='))
        .map(async ([letter = '', fileName = '']) => {
          if (fileName === '') {
            return [letter, null] as const
          }
          try {
            const result = await readPrototypeSetFileOnHost(target, {
              sessionId,
              requestId,
              fileName
            })
            return [letter, result.ok ? result.html : null] as const
          } catch {
            // An older host or a lost connection leaves that direction's parts unplaced.
            return [letter, null] as const
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
  }, [sessionId, requestId, filesKey])
  return state
}
