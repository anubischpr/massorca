import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { EngramImportResult } from '../../../../shared/marketplace-engram-ops'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'

const KEY = 'auto.components.marketplace.MarketplaceEngramImport'

export function engramImportMessage(result: EngramImportResult): string | null {
  if (result.ok) {
    const parts = [
      ['observations', result.counts.observations],
      ['sessions', result.counts.sessions],
      ['prompts', result.counts.prompts]
    ]
      .filter(([, count]) => typeof count === 'number')
      .map(([noun, count]) => `${count} ${noun}`)
    return parts.length > 0
      ? `${translate(`${KEY}.done`, 'Imported')}: ${parts.join(', ')}.`
      : translate(`${KEY}.doneNoCounts`, 'Memories imported.')
  }
  switch (result.reason) {
    case 'canceled':
      return null
    case 'not-installed':
      return translate(`${KEY}.notInstalled`, 'Engram is not installed on this computer.')
    case 'not-json':
      return translate(`${KEY}.notJson`, 'Pick a .json file made by "engram export".')
    case 'too-large':
      return translate(`${KEY}.tooLarge`, 'That file is too large to import (limit 256 MB).')
    case 'unreadable':
      return translate(`${KEY}.unreadable`, 'That file could not be read.')
    case 'failed':
      return translate(
        `${KEY}.failed`,
        'Engram could not import that file. Check that it came from "engram export".'
      )
  }
}

/** Imports an `engram export` file; only counts come back, never memory contents. */
export function MarketplaceEngramImport(): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const choose = async (): Promise<void> => {
    const api = window.api?.marketplaceEngramOps
    if (!api) {
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      setMessage(engramImportMessage(await api.importMemories()))
    } catch {
      setMessage(translate(`${KEY}.failed`, 'Engram could not import that file.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1" data-marketplace-engram="import">
      <p className="text-sm font-medium">{translate(`${KEY}.title`, 'Import memories')}</p>
      <MarketplaceInfoRow label={translate(`${KEY}.label`, 'From an Engram export file')}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void choose()}
        >
          {translate(`${KEY}.choose`, 'Choose file')}
        </Button>
      </MarketplaceInfoRow>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}
