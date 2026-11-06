import { useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import { ConnectionRow } from './MarketplaceAppConnection'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import type { MarketplaceIntegrationId } from './marketplace-integrations'

export type IntegrationAccount = { id: string; name: string; detail: string }

type TestOutcome = { ok: true } | { ok: false; error: string }

/** Connected workspaces or sites, each with the Test the Settings card offers. */
export function MarketplaceIntegrationAccounts({
  integration,
  accounts,
  onTest
}: {
  integration: MarketplaceIntegrationId
  accounts: readonly IntegrationAccount[]
  onTest: (accountId: string) => Promise<TestOutcome>
}): React.JSX.Element {
  const mountedRef = useMountedRef()
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, TestOutcome>>({})

  const test = async (accountId: string): Promise<void> => {
    setTesting(accountId)
    setResults((previous) => {
      const next = { ...previous }
      delete next[accountId]
      return next
    })
    const outcome = await onTest(accountId)
    if (mountedRef.current) {
      setResults((previous) => ({ ...previous, [accountId]: outcome }))
      setTesting(null)
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      {accounts.map((account) => {
        const result = results[account.id]
        return (
          <ConnectionRow
            key={account.id}
            icon={
              <MarketplaceIntegrationIcon id={integration} className="size-4 text-foreground" />
            }
            name={account.name}
            sub={account.detail}
            action={
              <div className="flex shrink-0 items-center gap-2">
                {result?.ok === true ? (
                  <span className="flex items-center gap-1 text-xs text-status-success">
                    <CheckCircle2 className="size-3.5" />
                    {translate(
                      'auto.components.marketplace.MarketplaceIntegrationAccounts.verified',
                      'Verified'
                    )}
                  </span>
                ) : null}
                {result?.ok === false ? (
                  <span className="flex min-w-0 max-w-[220px] items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="truncate">{result.error}</span>
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testing === account.id}
                  onClick={() => void test(account.id)}
                >
                  {testing === account.id ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      {translate(
                        'auto.components.marketplace.MarketplaceIntegrationAccounts.testing',
                        'Testing...'
                      )}
                    </>
                  ) : (
                    translate(
                      'auto.components.marketplace.MarketplaceIntegrationAccounts.test',
                      'Test'
                    )
                  )}
                </Button>
              </div>
            }
          />
        )
      })}
    </div>
  )
}
