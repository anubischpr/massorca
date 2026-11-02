import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, Plus, Settings, Users } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { useHostClient } from '../transport/host-client-hooks'
import type { RpcClient } from '../transport/rpc-client'
import { botAgentLabel } from '../../../src/shared/bot-team-character-art'
import type { BotDraftInput, BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { MobileAddBotForm, MobileNewTeamForm } from './MobileBotTeamForms'
import { MobileBotTeamRoom } from './MobileBotTeamRoom'
import { MobileBotTeamWork, isBotTeamWorkScreen, type BotTeamWorkScreen } from './MobileBotTeamWork'
import { MobileBotTeamModeSwitch } from './MobileBotTeamModeSwitch'
import { botTeamStyles as styles } from './mobile-bot-team-styles'
import {
  addMobileBot,
  updateMobileBot,
  createMobileBotTeam,
  listMobileBotTeams,
  updateMobileBotTeam,
  type MobileBotTeamList
} from './mobile-bot-team-rpc'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import {
  setBotCharacterAnimations,
  useBotCharacterAnimations
} from './mobile-bot-character-preference'
import { useMobileBotTeamStatus } from './use-mobile-bot-team-status'

const HOST_CHECK_MS = 20_000

type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'newTeam' }
  | { name: 'newTeamBot' }
  | { name: 'team'; teamId: string }
  | { name: 'teamBots'; teamId: string }
  | { name: 'editBot'; teamId: string; botId: string }
  | { name: 'editNewTeamBot'; index: number }
  | { name: 'teamBot'; teamId: string }
  | BotTeamWorkScreen

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
/** Carousel of teams; kept apart so the status hook only runs where a client exists. */
function TeamCarousel({
  client,
  teams,
  unreachable,
  onOpen
}: {
  client: RpcClient
  teams: readonly BotTeam[]
  unreachable: boolean
  onOpen: (teamId: string) => void
}) {
  const statusOf = useMobileBotTeamStatus(client, teams)
  return (
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
          onPress={() => onOpen(team.id)}
          style={styles.carouselItem}
        >
          <MobileBotTeamCharacterIcon
            character={team.character}
            size={64}
            working={statusOf(team.id) === 'Working'}
            unreachable={unreachable}
          />
          <Text style={styles.carouselName} numberOfLines={1}>
            {team.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

/** The Conference room with its team's real state, read the same way the carousel reads it. */
function TeamRoom(props: Omit<ComponentProps<typeof MobileBotTeamRoom>, 'workingOf'>) {
  const statusOf = useMobileBotTeamStatus(props.client, props.teams)
  return <MobileBotTeamRoom {...props} workingOf={(teamId) => statusOf(teamId) === 'Working'} />
}

export function MobileBotTeamsScreen({
  hostId,
  onShowWorkspaces,
  onOpenTask
}: {
  hostId: string
  onShowWorkspaces: () => void
  onOpenTask: (workspaceId: string, task: BotTeamTask) => void
}) {
  const { client } = useHostClient(hostId)
  const [list, setList] = useState<MobileBotTeamList | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [draftBots, setDraftBots] = useState<BotDraftInput[]>([])
  const characterAnimations = useBotCharacterAnimations()

  const reload = useCallback(async () => {
    if (client !== null) {
      const next = await listMobileBotTeams(client)
      setUnreachable(next.kind === 'failed')
      // What was last seen stays on screen, marked out of date, rather than disappearing.
      setList((current) => (next.kind === 'failed' && current?.kind === 'ready' ? current : next))
    }
  }, [client])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => void reload(), HOST_CHECK_MS)
    return () => clearInterval(timer)
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
  const openBotsTeam =
    screen.name === 'teamBots' ? teams.find((t) => t.id === screen.teamId) : undefined
  const workTeam = isBotTeamWorkScreen(screen)
    ? teams.find((t) => t.id === screen.teamId)
    : undefined

  const notice = unreachable ? (
    <View style={styles.notice}>
      <Text style={styles.rowTitle}>Can’t reach this host. Its bots may still be working.</Text>
      <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.secondary}>
        <Text style={styles.rowTitle}>Try again</Text>
      </Pressable>
    </View>
  ) : null

  let body
  if (
    client !== null &&
    (screen.name === 'newTeam' || screen.name === 'newTeamBot' || screen.name === 'editNewTeamBot')
  ) {
    const addingBot = screen.name === 'newTeamBot' || screen.name === 'editNewTeamBot'
    const editIndex = screen.name === 'editNewTeamBot' ? screen.index : null
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
            onEditBot={(index) => setScreen({ name: 'editNewTeamBot', index })}
            onCreate={(input) => {
              setDraftBots([])
              void apply(createMobileBotTeam(client, input), { name: 'home' })
            }}
          />
        </View>
        {addingBot ? (
          <>
            <SubBar
              title={editIndex === null ? 'Add a bot' : 'Edit bot'}
              onBack={() => setScreen({ name: 'newTeam' })}
            />
            <MobileAddBotForm
              client={client}
              key={editIndex ?? 'new'}
              {...(editIndex === null ? {} : { initial: draftBots[editIndex] })}
              onAdd={(bot) => {
                setDraftBots((current) =>
                  editIndex === null
                    ? [...current, bot]
                    : current.map((entry, index) => (index === editIndex ? bot : entry))
                )
                setScreen({ name: 'newTeam' })
              }}
            />
          </>
        ) : null}
      </>
    )
  } else if (client !== null && screen.name === 'editBot') {
    const back: Screen = { name: 'teamBots', teamId: screen.teamId }
    const editing = teams
      .find((team) => team.id === screen.teamId)
      ?.bots.find((bot) => bot.id === screen.botId)
    body = (
      <>
        <SubBar title="Edit bot" onBack={() => setScreen(back)} />
        <MobileAddBotForm
          client={client}
          {...(editing ? { initial: editing } : {})}
          onAdd={(bot) =>
            void apply(updateMobileBot(client, screen.teamId, screen.botId, bot), back)
          }
        />
      </>
    )
  } else if (client !== null && screen.name === 'teamBot') {
    const back: Screen = { name: 'teamBots', teamId: screen.teamId }
    body = (
      <>
        <SubBar title="Add a bot" onBack={() => setScreen(back)} />
        <MobileAddBotForm
          client={client}
          onAdd={(bot) => void apply(addMobileBot(client, screen.teamId, bot), back)}
        />
      </>
    )
  } else if (client !== null && openTeam && screen.name === 'team') {
    body = (
      <>
        {notice}
        <TeamRoom
          key={openTeam.id}
          client={client}
          team={openTeam}
          teams={teams}
          offline={unreachable}
          onBack={backHome}
          onPickTeam={(teamId) => setScreen({ name: 'team', teamId })}
          onOpenBots={() => setScreen({ name: 'teamBots', teamId: openTeam.id })}
          onOpenTask={(workspaceId, task) => onOpenTask(workspaceId, task)}
          onOpenWork={setScreen}
          onAddBot={() => setScreen({ name: 'teamBot', teamId: openTeam.id })}
          onNewTeam={() => setScreen({ name: 'newTeam' })}
        />
      </>
    )
  } else if (openBotsTeam) {
    const openTeam = openBotsTeam
    body = (
      <>
        <SubBar
          title={`${openTeam.name} bots`}
          onBack={() => setScreen({ name: 'team', teamId: openTeam.id })}
        />
        <ScrollView contentContainerStyle={styles.form}>
          {openTeam.purpose ? <Text style={styles.rowMeta}>{openTeam.purpose}</Text> : null}
          {openTeam.bots.map((bot) => (
            <View key={bot.id} style={styles.row}>
              <MobileBotAgentIcon agentId={bot.agent} size={20} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{bot.name}</Text>
                {bot.job ? <Text style={styles.rowMeta}>{bot.job}</Text> : null}
                <Text style={styles.rowMeta}>{botAgentLabel(bot.agent)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </>
    )
  } else if (client !== null && workTeam && isBotTeamWorkScreen(screen)) {
    body = (
      <MobileBotTeamWork
        key={workTeam.id}
        client={client}
        team={workTeam}
        teams={teams}
        offline={unreachable}
        screen={screen}
        onOpenRoom={() => setScreen({ name: 'team', teamId: workTeam.id })}
        onOpen={setScreen}
        onOpenTask={onOpenTask}
      />
    )
  } else if (client !== null && screen.name === 'settings') {
    body = (
      <>
        <SubBar title="Bot teams" onBack={backHome} />
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Character animations</Text>
              <Text style={styles.rowMeta}>
                Team characters move and react. Off, a still glow shows who is working.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Character animations"
              value={characterAnimations}
              onValueChange={setBotCharacterAnimations}
              trackColor={{ true: colors.textSecondary }}
            />
          </View>
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
              <MobileBotTeamCharacterIcon character={team.character} size={28} still />
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
        {notice}
        {list?.kind === 'failed' ? null : list?.kind === 'ready' && teams.length === 0 ? (
          <View style={styles.form}>
            <Users size={28} color={colors.textMuted} />
            <Text style={styles.message}>
              No teams yet. Create one to give your bots a place to work.
            </Text>
          </View>
        ) : client !== null ? (
          <TeamCarousel
            client={client}
            teams={teams}
            unreachable={unreachable}
            onOpen={(teamId) => setScreen({ name: 'team', teamId })}
          />
        ) : null}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {body}
    </SafeAreaView>
  )
}
