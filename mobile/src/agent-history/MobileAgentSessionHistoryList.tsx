import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from 'react-native'
import { Play } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { recentSessionConversationTurns } from '../../../src/shared/ai-vault-session-display'
import type { AiVaultSession } from '../../../src/shared/ai-vault-types'
import type { MobileAgentHistorySection } from './agent-history-sections'
import {
  automatedRunBadgeLabel,
  DELEGATED_CHILD_BADGE_LABEL,
  delegatedChildStatusLabel,
  type MobileAgentHistoryCard
} from './agent-history-session-card'
import { styles } from './agent-history-styles'

// Lazy-render at most this many preview turns when a card is tapped — the
// scanner already bounds preview text, but rendering them only on tap keeps the
// list cheap.
const PREVIEW_TURN_LIMIT = 5

type Props = {
  sections: MobileAgentHistorySection[]
  sessionsById: ReadonlyMap<string, AiVaultSession>
  refreshing: boolean
  showCurrentWorktreeBadges: boolean
  resumeActionStateBySessionId?: ReadonlyMap<string, { disabled: boolean; loading: boolean }>
  onResume?: (session: AiVaultSession) => void | Promise<void>
  onRefresh: () => void
}

export function MobileAgentSessionHistoryList({
  sections,
  sessionsById,
  refreshing,
  showCurrentWorktreeBadges,
  resumeActionStateBySessionId,
  onResume,
  onRefresh
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const renderCard = useCallback(
    (card: MobileAgentHistoryCard) => (
      <AgentHistoryCardRow
        key={card.id}
        card={card}
        expanded={expandedId === card.id}
        session={sessionsById.get(card.id) ?? null}
        showCurrentWorktreeBadge={showCurrentWorktreeBadges}
        resumeActionState={resumeActionStateBySessionId?.get(card.id)}
        onResume={onResume}
        onPress={() => toggleExpanded(card.id)}
      />
    ),
    [
      expandedId,
      onResume,
      resumeActionStateBySessionId,
      sessionsById,
      showCurrentWorktreeBadges,
      toggleExpanded
    ]
  )

  // Why: a parent and its delegated children are one block, so the children draw under the parent card.
  const renderItem = useCallback(
    ({ item }: { item: MobileAgentHistoryCard }) => (
      <View style={styles.cardGroup}>
        {renderCard(item)}
        {item.nestedChildren?.map(renderCard)}
      </View>
    ),
    [renderCard]
  )

  return (
    <SectionList
      sections={sections}
      keyExtractor={(card) => card.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
        />
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.groupHeader}>
          <Text style={styles.groupHeaderText} numberOfLines={1}>
            {section.label}
          </Text>
          <Text style={styles.groupHeaderCount}>{section.data.length}</Text>
        </View>
      )}
      renderItem={renderItem}
    />
  )
}

function AgentHistoryCardRow({
  card,
  expanded,
  session,
  showCurrentWorktreeBadge,
  resumeActionState,
  onResume,
  onPress
}: {
  card: MobileAgentHistoryCard
  expanded: boolean
  session: AiVaultSession | null
  showCurrentWorktreeBadge: boolean
  resumeActionState?: { disabled: boolean; loading: boolean }
  onResume?: (session: AiVaultSession) => void | Promise<void>
  onPress: () => void
}) {
  const previewTurns = useMemo(
    () => (expanded && session ? recentSessionConversationTurns(session, PREVIEW_TURN_LIMIT) : []),
    [expanded, session]
  )
  const child = card.delegatedChild

  return (
    <Pressable
      style={({ pressed }) => [
        child ? styles.nestedChildRow : styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      {child ? (
        <Text style={styles.nestedChildTitle} numberOfLines={1}>
          {card.title}
        </Text>
      ) : (
        <View style={styles.cardTopRow}>
          <MobileAgentIcon agentId={card.agent} size={16} piRuntime={card.piRuntime} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {card.title}
          </Text>
          {card.timeAgo ? <Text style={styles.cardTimeAgo}>{card.timeAgo}</Text> : null}
        </View>
      )}
      {!child && card.lastMessage ? (
        <Text style={styles.cardLastMessage} numberOfLines={expanded ? undefined : 2}>
          {card.lastMessage}
        </Text>
      ) : null}
      <View style={styles.cardMetaRow}>
        {child ? (
          <DelegatedChildMetaItems card={card} />
        ) : (
          <CardMetaItems card={card} showCurrentWorktreeBadge={showCurrentWorktreeBadge} />
        )}
        {session && onResume ? (
          <ResumeButton
            session={session}
            resumeActionState={resumeActionState}
            onResume={onResume}
          />
        ) : null}
      </View>
      {expanded && previewTurns.length > 0 ? (
        <View style={styles.preview}>
          {previewTurns.map((turn, index) => (
            <View key={`${card.id}-turn-${index}`} style={styles.previewTurn}>
              <Text style={styles.previewRole}>{turn.role}</Text>
              <Text style={styles.previewText}>{turn.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  )
}

function CardMetaItems({
  card,
  showCurrentWorktreeBadge
}: {
  card: MobileAgentHistoryCard
  showCurrentWorktreeBadge: boolean
}) {
  return (
    <>
      {card.automatedRunKind ? (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{automatedRunBadgeLabel(card.automatedRunKind)}</Text>
        </View>
      ) : null}
      <Text style={styles.cardMetaText}>{card.agentLabel}</Text>
      <Text style={styles.cardMetaText}>
        {card.messageCount} {card.messageCount === 1 ? 'message' : 'messages'}
      </Text>
      {showCurrentWorktreeBadge && card.isCurrentWorktree ? (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>current worktree</Text>
        </View>
      ) : null}
    </>
  )
}

// Why: a delegated child's metadata line names only its badge, agent, status and time.
function DelegatedChildMetaItems({ card }: { card: MobileAgentHistoryCard }) {
  const status = card.delegatedChild?.status
  const statusLabel = status ? delegatedChildStatusLabel(status) : null
  return (
    <>
      <View style={styles.rowBadge}>
        <Text style={styles.rowBadgeText}>{DELEGATED_CHILD_BADGE_LABEL}</Text>
      </View>
      <Text style={styles.cardMetaText}>·</Text>
      <Text style={styles.cardMetaText}>{card.agentLabel}</Text>
      {statusLabel ? (
        <>
          <Text style={styles.cardMetaText}>·</Text>
          <View style={styles.nestedChildStatus}>
            {status === 'working' ? <View style={styles.nestedChildDot} /> : null}
            <Text style={styles.cardMetaText}>{statusLabel}</Text>
          </View>
        </>
      ) : null}
      {card.timeAgo ? (
        <>
          <Text style={styles.cardMetaText}>·</Text>
          <Text style={styles.cardMetaText}>{card.timeAgo}</Text>
        </>
      ) : null}
    </>
  )
}

function ResumeButton({
  session,
  resumeActionState,
  onResume
}: {
  session: AiVaultSession
  resumeActionState?: { disabled: boolean; loading: boolean }
  onResume: (session: AiVaultSession) => void | Promise<void>
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.resumeButton,
        resumeActionState?.disabled && styles.resumeButtonDisabled,
        pressed && !resumeActionState?.disabled && styles.resumeButtonPressed
      ]}
      onPress={(event) => {
        event.stopPropagation()
        if (!resumeActionState?.disabled) {
          void onResume(session)
        }
      }}
      disabled={resumeActionState?.disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Resume agent session"
    >
      {resumeActionState?.loading ? (
        <ActivityIndicator size="small" color={colors.textPrimary} />
      ) : (
        <Play size={17} color={colors.textPrimary} strokeWidth={2.4} />
      )}
    </Pressable>
  )
}
