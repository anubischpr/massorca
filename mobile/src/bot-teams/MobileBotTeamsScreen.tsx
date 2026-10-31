import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, Plus, Settings, Users } from 'lucide-react-native'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { colors } from '../theme/mobile-theme'
import { useHostClient } from '../transport/host-client-hooks'
import { botAgentLabel } from '../../../src/shared/bot-team-character-art'
import type { BotDraftInput, BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileAddBotForm, MobileNewTeamForm } from './MobileBotTeamForms'
import { MobileBotTeamModeSwitch } from './MobileBotTeamModeSwitch'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import {
  addMobileBot,
  createMobileBotTeam,
  listMobileBotTeams,
  updateMobileBotTeam,
  type MobileBotTeamList
} from './mobile-bot-team-rpc'

type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'newTeam' }
  | { name: 'newTeamBot' }
  | { name: 'team'; teamId: string }
  | { name: 'teamBot'; teamId: string }

function SubBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.iconButton}
      >
        <ChevronLeft size={22} color={colors.textSecondary} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.barTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  )
}

/** The first screen of a host: its teams. A host older than Bot teams opens on Workspaces instead. */
export function MobileBotTeamsScreen({
  hostId,
  onShowWorkspaces
}: {
  hostId: string
  onShowWorkspaces: () => void
}) {
  const { client } = useHostClient(hostId)
  const [list, setList] = useState<MobileBotTeamList | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [draftBots, setDraftBots] = useState<BotDraftInput[]>([])

  const reload = useCallback(async () => {
    if (client !== null) {
      setList(await listMobileBotTeams(client))
    }
  }, [client])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (list?.kind === 'unsupported') {
      onShowWorkspaces()
    }
  }, [list, onShowWorkspaces])

  const apply = async (change: Promise<BotTeam | null>, next: Screen) => {
    if ((await change) === null) {
      Alert.alert('That did not save', 'Check the connection to this host and try again.')
      return
    }
    await reload()
    setScreen(next)
  }

  const teams = list?.kind === 'ready' ? list.teams : []
  const backHome = () => setScreen({ name: 'home' })
  const openTeam = screen.name === 'team' ? teams.find((t) => t.id === screen.teamId) : undefined

  let body
  if (client !== null && (screen.name === 'newTeam' || screen.name === 'newTeamBot')) {
    const addingBot = screen.name === 'newTeamBot'
    body = (
      <>
        {/* Stays mounted while a bot is added: the team name and choices live in this form. */}
        <View style={addingBot ? styles.hidden : styles.grow}>
          <SubBar
            title="New team"
            onBack={() => {
              setDraftBots([])
              backHome()
            }}
          />
          <MobileNewTeamForm
            usedCharacters={teams.map((team) => team.character)}
            bots={draftBots}
            onOpenAddBot={() => setScreen({ name: 'newTeamBot' })}
            onCreate={(input) => {
              setDraftBots([])
              void apply(createMobileBotTeam(client, input), { name: 'home' })
            }}
          />
        </View>
        {addingBot ? (
          <>
            <SubBar title="Add a bot" onBack={() => setScreen({ name: 'newTeam' })} />
            <MobileAddBotForm
              onAdd={(bot) => {
                setDraftBots((current) => [...current, bot])
                setScreen({ name: 'newTeam' })
              }}
            />
          </>
        ) : null}
      </>
    )
  } else if (client !== null && screen.name === 'teamBot') {
    const back: Screen = { name: 'team', teamId: screen.teamId }
    body = (
      <>
        <SubBar title="Add a bot" onBack={() => setScreen(back)} />
        <MobileAddBotForm
          onAdd={(bot) => void apply(addMobileBot(client, screen.teamId, bot), back)}
        />
      </>
    )
  } else if (openTeam) {
    body = (
      <>
        <SubBar title={openTeam.name} onBack={backHome} />
        <ScrollView contentContainerStyle={styles.form}>
          {openTeam.purpose ? <Text style={styles.rowMeta}>{openTeam.purpose}</Text> : null}
          {openTeam.bots.map((bot) => (
            <View key={bot.id} style={styles.row}>
              <MobileAgentIcon agentId={bot.agent} size={20} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{bot.name}</Text>
                <Text style={styles.rowMeta}>{bot.job || botAgentLabel(bot.agent)}</Text>
              </View>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen({ name: 'teamBot', teamId: openTeam.id })}
            style={styles.row}
          >
            <Text style={styles.rowTitle}>Add a bot</Text>
          </Pressable>
        </ScrollView>
      </>
    )
  } else if (client !== null && screen.name === 'settings') {
    body = (
      <>
        <SubBar title="Bot teams" onBack={backHome} />
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.rowMeta}>
            What each team can do without asking. New teams start with full access.
          </Text>
          {teams.map((team) => (
            <Pressable
              key={team.id}
              accessibilityRole="button"
              accessibilityLabel={`${team.name} access`}
              onPress={() =>
                void apply(
                  updateMobileBotTeam(client, {
                    teamId: team.id,
                    accessMode: team.accessMode === 'full-access' ? 'default' : 'full-access'
                  }),
                  { name: 'settings' }
                )
              }
              style={styles.row}
            >
              <MobileBotTeamCharacterIcon character={team.character} size={28} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{team.name}</Text>
                <Text style={styles.rowMeta}>
                  {team.accessMode === 'full-access' ? 'Full access' : 'Ask first'}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </>
    )
  } else {
    body = (
      <>
        <View style={styles.bar}>
          <MobileBotTeamModeSwitch mode="teams" onChange={onShowWorkspaces} />
          <View style={styles.grow} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bot teams settings"
            onPress={() => setScreen({ name: 'settings' })}
            style={styles.iconButton}
          >
            <Settings size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New team"
            onPress={() => setScreen({ name: 'newTeam' })}
            style={styles.iconButton}
          >
            <Plus size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        {list?.kind === 'failed' ? (
          <Pressable accessibilityRole="button" onPress={() => void reload()}>
            <Text style={styles.message}>Could not reach this host. Tap to retry.</Text>
          </Pressable>
        ) : list?.kind === 'ready' && teams.length === 0 ? (
          <View style={styles.form}>
            <Users size={28} color={colors.textMuted} />
            <Text style={styles.message}>
              No teams yet. Create one to give your bots a place to work.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {teams.map((team) => (
              <Pressable
                key={team.id}
                accessibilityRole="button"
                accessibilityLabel={team.name}
                onPress={() => setScreen({ name: 'team', teamId: team.id })}
                style={styles.carouselItem}
              >
                <MobileBotTeamCharacterIcon character={team.character} size={64} />
                <Text style={styles.carouselName} numberOfLines={1}>
                  {team.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {body}
    </SafeAreaView>
  )
}
