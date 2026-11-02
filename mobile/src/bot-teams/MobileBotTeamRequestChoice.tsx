import { useState, type ReactElement } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { BotTeamRequestChoice } from '../../../src/shared/bot-team-request-choice'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

type Option = { id: string; name: string; detail: string; icon: ReactElement }

function optionsOf(choice: BotTeamRequestChoice, team: BotTeam, otherTeams: readonly BotTeam[]) {
  if (choice.kind === 'new-bot') {
    return team.bots.map((bot): Option => ({
      id: bot.id,
      name: bot.name,
      detail: bot.job,
      icon: <MobileBotAgentIcon agentId={bot.agent} size={16} />
    }))
  }
  // The suggested team comes first, so it is the one picked until the person changes it.
  const suggested = choice.kind === 'other-team' ? choice.teamId : null
  return [...otherTeams]
    .sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested))
    .map((other): Option => ({
      id: other.id,
      name: other.name,
      detail: other.purpose,
      icon: <MobileBotTeamCharacterIcon character={other.character} size={20} />
    }))
}

function questionOf(choice: BotTeamRequestChoice, team: BotTeam, picked: string | null): string {
  if (choice.kind === 'other-team') {
    return picked === null
      ? `Choose where this task goes: keep it in ${team.name}.`
      : `Choose where this task goes: Send to ${picked}, or keep it in ${team.name}.`
  }
  if (choice.kind === 'new-bot') {
    return 'Choose who takes this task: create a new bot, or send it to an existing bot.'
  }
  return 'Choose where this task goes: create a new team, or send it to an existing team.'
}

/** The outline action: keep the request in this team, or create the missing bot or team. */
function outlineActionOf(
  choice: BotTeamRequestChoice,
  team: BotTeam,
  actions: { onKeep: () => void; onCreateBot: () => void; onCreateTeam: () => void }
): { label: string; run: () => void } {
  if (choice.kind === 'other-team') {
    return { label: `Keep in ${team.name}`, run: actions.onKeep }
  }
  if (choice.kind === 'new-bot') {
    return { label: 'Create a new bot', run: actions.onCreateBot }
  }
  return { label: 'Create a new team', run: actions.onCreateTeam }
}

/** The room's question when no bot of the team can simply take a request, as on the desktop. */
export function MobileBotTeamRequestChoice({
  choice,
  team,
  otherTeams,
  busy,
  onSendToBot,
  onSendToTeam,
  onKeep,
  onCreateBot,
  onCreateTeam
}: {
  choice: BotTeamRequestChoice
  team: BotTeam
  otherTeams: readonly BotTeam[]
  busy: boolean
  onSendToBot: (botId: string) => void
  onSendToTeam: (teamId: string) => void
  onKeep: () => void
  onCreateBot: () => void
  onCreateTeam: () => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const rows = optionsOf(choice, team, otherTeams)
  const selected = rows.find((row) => row.id === picked) ?? rows[0] ?? null
  const send = () => {
    if (selected) {
      if (choice.kind === 'new-bot') {
        onSendToBot(selected.id)
      } else {
        onSendToTeam(selected.id)
      }
    }
  }
  const outline = outlineActionOf(choice, team, { onKeep, onCreateBot, onCreateTeam })
  return (
    <View style={styles.taskCard}>
      <Text style={styles.rowTitle}>{questionOf(choice, team, selected?.name ?? null)}</Text>
      {rows.map((row) => {
        const isSelected = row.id === selected?.id
        return (
          <Pressable
            key={row.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled: busy }}
            disabled={busy}
            onPress={() => setPicked(row.id)}
            style={[styles.row, isSelected && styles.rowSelected]}
          >
            {row.icon}
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.name}</Text>
              {row.detail ? <Text style={styles.rowMeta}>{row.detail}</Text> : null}
            </View>
          </Pressable>
        )
      })}
      <View style={styles.choiceActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={outline.label}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={outline.run}
          style={[styles.secondary, styles.choiceAction]}
        >
          <Text style={styles.rowTitle}>{outline.label}</Text>
        </Pressable>
        {selected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Send to ${selected.name}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={send}
            style={[styles.primary, styles.choiceAction, busy && styles.primaryDisabled]}
          >
            <Text style={styles.primaryText}>{`Send to ${selected.name}`}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
