import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { EngramProgramInfo } from '../../../../shared/marketplace-engram-ops'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'

type Manual = { instruction: string; url: string | null }

/** The Engram program on this computer: its version and, when one is reported, the update. */
export function MarketplaceEngramProgram(): React.JSX.Element | null {
  const [info, setInfo] = useState<EngramProgramInfo | null>(null)
  const [manual, setManual] = useState<Manual | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const api = window.api?.marketplaceEngramOps
    if (!api) {
      return
    }
    void api
      .getProgram()
      .then((next) => live && setInfo(next))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const updateNow = useCallback(async () => {
    setError(null)
    const api = window.api?.marketplaceEngramOps
    try {
      const result = await api?.updateNow()
      if (!result) {
        return
      }
      if (result.ok) {
        setInfo(result.info)
      } else if (result.reason === 'manual') {
        setManual({ instruction: result.instruction ?? '', url: result.url ?? null })
      } else {
        setError(
          translate(
            'auto.components.marketplace.MarketplaceEngramProgram.updateFailed',
            'Engram could not be updated. Try again, or update it by hand.'
          )
        )
      }
    } catch {
      setError(
        translate(
          'auto.components.marketplace.MarketplaceEngramProgram.updateFailed',
          'Engram could not be updated. Try again, or update it by hand.'
        )
      )
    }
  }, [])

  if (!info?.found) {
    return null
  }
  return (
    <div className="flex flex-col gap-1" data-marketplace-engram="program">
      <p className="text-sm font-medium">
        {translate('auto.components.marketplace.MarketplaceEngramProgram.title', 'Engram program')}
      </p>
      <MarketplaceInfoRow
        label={translate('auto.components.marketplace.MarketplaceEngramProgram.version', 'Version')}
      >
        <span className="text-sm text-muted-foreground">
          {info.current ??
            translate('auto.components.marketplace.MarketplaceEngramProgram.unknown', 'Unknown')}
        </span>
      </MarketplaceInfoRow>
      {info.updateAvailable && info.current && info.latest ? (
        <MarketplaceInfoRow
          label={`${translate(
            'auto.components.marketplace.MarketplaceEngramProgram.update',
            'Update available'
          )} ${info.current} -> ${info.latest}`}
        >
          <Button type="button" variant="outline" size="sm" onClick={() => void updateNow()}>
            {translate(
              'auto.components.marketplace.MarketplaceEngramProgram.updateNow',
              'Update now'
            )}
          </Button>
        </MarketplaceInfoRow>
      ) : null}
      {manual ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{manual.instruction}</p>
          {manual.url ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void window.api?.shell?.openUrl(manual.url ?? '')}
            >
              {translate(
                'auto.components.marketplace.MarketplaceEngramProgram.download',
                'Open download page'
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
