import { useEffect, useState } from 'react'
import type { BaseRefSearchResult } from '../../../src/shared/repo-types'
import { MobileSearchField } from '../components/MobileSearchField'
import { CreateSessionChoiceSheet } from './CreateSessionChoiceSheet'
import { DEFAULT_BASE_REF_VALUE, buildBaseRefChoices } from './create-session-base-ref'
import type { CreateSessionBaseRefSource } from './use-create-session-base-ref'

const SEARCH_DEBOUNCE_MS = 250

/** Picks the branch a new worktree starts from; the host searches local and remote branches. */
export function CreateSessionBaseRefSheet({
  visible,
  source,
  selected,
  onSelect,
  onClose
}: {
  visible: boolean
  source: CreateSessionBaseRefSource
  /** The pick, or null while the repository default is in use. */
  selected: string | null
  /** Null clears the pick back to the repository default. */
  onSelect: (baseRef: string | null) => void
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{
    // The search bound to the project, so results never outlive a project change.
    search: CreateSessionBaseRefSource['search']
    query: string
    refs: readonly BaseRefSearchResult[]
    failed: boolean
  } | null>(null)
  const typed = query.trim()
  const { search } = source

  useEffect(() => {
    if (!visible || typed === '') {
      return
    }
    let stale = false
    const timer = setTimeout(() => {
      search(typed).then(
        (refs) => {
          if (!stale) {
            setFound({ search, query: typed, refs, failed: false })
          }
        },
        () => {
          if (!stale) {
            setFound({ search, query: typed, refs: [], failed: true })
          }
        }
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [visible, typed, search])

  const current = found?.search === search && found.query === typed ? found : null
  const refs = typed === '' ? source.initialRefs : (current?.refs ?? [])
  const rows = buildBaseRefChoices({ refs, query: typed, defaultRef: source.defaultRef })
  const searchDone = typed !== '' && current !== null
  const searchFailed = current?.failed === true
  return (
    <CreateSessionChoiceSheet
      visible={visible}
      title="Base branch"
      hint="New worktrees start from this branch"
      rows={rows}
      emptyMessage={
        searchFailed
          ? 'Could not search the branches of this repository. Edit the search to try again.'
          : searchDone
            ? 'No branch matches this search.'
            : 'Searching branches…'
      }
      selectedValue={selected ?? DEFAULT_BASE_REF_VALUE}
      searchField={
        <MobileSearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search branches"
          accessibilityLabel="Search branches"
        />
      }
      onSelect={(value) => {
        onSelect(value === DEFAULT_BASE_REF_VALUE ? null : value)
        setQuery('')
      }}
      onClose={() => {
        onClose()
        setQuery('')
      }}
    />
  )
}
