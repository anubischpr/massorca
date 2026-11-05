import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Switch, Text, View } from 'react-native'
import {
  marketplaceTeamAllowed,
  withTeamAllowed,
  withUnsupportedBotsKept
} from '../../../src/shared/marketplace-access-edit'
import {
  MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE,
  everyoneAccessPolicy,
  type MarketplaceAppId,
  type MarketplaceAppStatus,
  type MarketplaceAppsListResult
} from '../../../src/shared/marketplace-apps'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MarketplaceGlyph, type MarketplaceGlyphName } from '../marketplace/marketplace-glyphs'
import {
  listMarketplaceApps,
  setMarketplaceAppAccess,
  type MarketplaceHostRpc
} from '../marketplace/marketplace-host-rpc'
import { MarketplaceNotice } from '../marketplace/marketplace-screen-frame'
import { colors } from '../theme/mobile-theme'
import { MobileBotTeamWorkBar as SubBar } from './MobileBotTeamWorkBar'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

const APP_NAMES: Record<MarketplaceAppId, string> = {
  engram: 'Engram',
  openmetadata: 'OpenMetadata',
  github: 'GitHub'
}
const APP_GLYPHS: Record<MarketplaceAppId, MarketplaceGlyphName> = {
  engram: 'brain',
  openmetadata: 'db',
  github: 'github'
}
const LOAD_FAILED =
  'Could not load Marketplace apps. Check the connection to this host, or update it if it is older.'
const SAVE_FAILED = 'The change did not complete. Try again.'
const NO_CONNECTED_APPS = 'No apps are connected yet. Connect them from the Marketplace.'

type Notice = { bad: boolean; text: string }

/** One team's Marketplace apps: a switch per connected app, saved the way the desktop dialog saves them. */
export function MobileBotTeamMarketplaceApps({
  client,
  team,
  onBack
}: {
  client: MarketplaceHostRpc
  team: BotTeam
  onBack: () => void
}) {
  const [list, setList] = useState<MarketplaceAppsListResult | null>(null)
  const [saving, setSaving] = useState<MarketplaceAppId | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const load = useCallback(() => listMarketplaceApps(client).then(setList), [client])
  useEffect(() => {
    void load()
  }, [load])

  const changeAccess = (app: MarketplaceAppStatus, allowed: boolean) => {
    const policy = app.access ?? everyoneAccessPolicy()
    const kept = withUnsupportedBotsKept(policy, withTeamAllowed(policy.bots, team, allowed), [
      team
    ])
    setNotice(
      kept.heldBack ? { bad: false, text: MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE } : null
    )
    const bots = kept.bots
    if (!bots) {
      return
    }
    // Why: switches stay disabled until the save lands, so a second edit never builds on a stale policy.
    setSaving(app.id)
    void setMarketplaceAppAccess(client, app.id, { ...policy, bots })
      .then(async (outcome) => {
        if (!outcome.ok) {
          setNotice({ bad: true, text: SAVE_FAILED })
        }
        await load()
      })
      .finally(() => setSaving(null))
  }

  return (
    <>
      <SubBar title="Marketplace apps" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.rowMeta}>
          {`Choose which connected apps ${team.name}'s bots can use.`}
        </Text>
        <AppSwitches list={list} team={team} saving={saving !== null} onChange={changeAccess} />
        {notice ? <MarketplaceNotice bad={notice.bad} text={notice.text} /> : null}
      </ScrollView>
    </>
  )
}

function AppSwitches({
  list,
  team,
  saving,
  onChange
}: {
  list: MarketplaceAppsListResult | null
  team: BotTeam
  saving: boolean
  onChange: (app: MarketplaceAppStatus, allowed: boolean) => void
}) {
  if (list === null) {
    return <Text style={styles.message}>Checking connected apps…</Text>
  }
  if (!list.ok) {
    return <MarketplaceNotice bad text={LOAD_FAILED} />
  }
  const connected = list.apps.filter((app) => app.connected)
  if (connected.length === 0) {
    return <Text style={styles.message}>{NO_CONNECTED_APPS}</Text>
  }
  return (
    <>
      {connected.map((app) => {
        const name = APP_NAMES[app.id]
        return (
          <View key={app.id} style={styles.row}>
            <MarketplaceGlyph name={APP_GLYPHS[app.id]} size={18} color={colors.textSecondary} />
            <Text style={[styles.rowTitle, styles.grow]}>{name}</Text>
            <Switch
              accessibilityLabel={`Let ${team.name} use ${name}`}
              value={marketplaceTeamAllowed(app.access ?? everyoneAccessPolicy(), team)}
              disabled={saving}
              onValueChange={(next) => onChange(app, next)}
              trackColor={{ true: colors.textSecondary }}
            />
          </View>
        )
      })}
    </>
  )
}
