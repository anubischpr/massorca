import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check, Plus } from 'lucide-react-native'
import {
  NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS,
  type NativeChatChecklistItem
} from '../../../src/shared/native-chat-checklist'
import { BottomDrawer } from '../components/BottomDrawer'
import { SheetSectionLabel } from '../components/SheetSectionLabel'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type {
  MobileChecklistItemChange,
  MobileChecklistScreenshotDraft
} from './use-mobile-native-chat-checklist'

type Props = {
  visible: boolean
  item: NativeChatChecklistItem | null
  /** 1-based place of the item in the checklist. */
  position: number
  total: number
  agentLabel: string
  readOnly: boolean
  onClose: () => void
  /** Saves what changed; resolves true once the host has stored it. */
  onSave: (change: MobileChecklistItemChange) => Promise<boolean>
  onPickScreenshot: () => Promise<MobileChecklistScreenshotDraft[]>
}

type ScreenshotDraft = MobileChecklistScreenshotDraft | { path: string; name: string; previewUri: null }

/**
 * One item's sheet: its check, note and screenshots. The parent keys it by open count, so each open
 * starts from the stored item and a poll never overwrites what the person is typing.
 */
export function MobileChecklistItemSheet({
  visible,
  item,
  position,
  total,
  agentLabel,
  readOnly,
  onClose,
  onSave,
  onPickScreenshot
}: Props): React.JSX.Element {
  const [checked, setChecked] = useState(item?.checked ?? false)
  const [note, setNote] = useState(item?.note ?? '')
  const [shots, setShots] = useState<ScreenshotDraft[]>(() => storedShots(item))
  const [saving, setSaving] = useState(false)

  const save = async (): Promise<void> => {
    if (!item || saving) {
      return
    }
    const change: MobileChecklistItemChange = {}
    if (checked !== item.checked) {
      change.checked = checked
    }
    if (note !== (item.note ?? '')) {
      change.note = note
    }
    if (!sameScreenshots(shots, item.screenshots)) {
      change.screenshots = shots.map((shot) => ({ path: shot.path, name: shot.name }))
    }
    if (Object.keys(change).length === 0) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await onSave(change)
    } finally {
      setSaving(false)
    }
  }

  const addScreenshot = async (): Promise<void> => {
    const picked = await onPickScreenshot()
    if (picked.length > 0) {
      setShots((current) => [...current, ...picked].slice(0, NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS))
    }
  }

  return (
    <BottomDrawer visible={visible} onClose={onClose} dragContentToDismiss contentScrollable>
      {item ? (
        <View style={styles.content}>
          <Text style={styles.caption}>{`Checklist · item ${position} of ${total}`}</Text>
          <Text style={styles.title}>{item.text}</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Checked"
            accessibilityState={{ checked, disabled: readOnly }}
            disabled={readOnly}
            style={styles.checkRow}
            onPress={() => setChecked((value) => !value)}
          >
            <View style={[styles.box, checked && styles.boxChecked]}>
              {checked ? <Check size={12} color={colors.onAccent} strokeWidth={3} /> : null}
            </View>
            <Text style={styles.checkLabel}>Checked</Text>
          </Pressable>
          <SheetSectionLabel label="Note" />
          <TextInput
            accessibilityLabel="Note"
            multiline
            editable={!readOnly}
            value={note}
            onChangeText={setNote}
            style={styles.input}
            textAlignVertical="top"
          />
          <SheetSectionLabel label="Screenshot" />
          <View style={styles.shotRow}>
            {shots.map((shot) => (
              <ScreenshotTile key={shot.path} shot={shot} />
            ))}
            {shots.length < NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS && !readOnly ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add"
                style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
                onPress={() => void addScreenshot()}
              >
                <Plus size={16} color={colors.textSecondary} strokeWidth={2.2} />
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            ) : null}
          </View>
          {readOnly ? null : (
            <Text style={styles.agentLine}>{`${agentLabel} reads this with your next message.`}</Text>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: readOnly || saving, busy: saving }}
              disabled={readOnly || saving}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              onPress={() => void save()}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomDrawer>
  )
}

function storedShots(item: NativeChatChecklistItem | null): ScreenshotDraft[] {
  return (item?.screenshots ?? []).map((shot) => ({
    path: shot.path,
    name: shot.name,
    previewUri: null
  }))
}

function sameScreenshots(
  drafts: readonly ScreenshotDraft[],
  stored: readonly { path: string }[]
): boolean {
  return (
    drafts.length === stored.length &&
    drafts.every((draft, index) => draft.path === stored[index]?.path)
  )
}

function ScreenshotTile({ shot }: { shot: ScreenshotDraft }) {
  if (shot.previewUri) {
    return <Image accessibilityLabel={shot.name} source={{ uri: shot.previewUri }} style={styles.thumb} />
  }
  // A screenshot the host stored has no bytes on this phone, so its tile names the file instead.
  return (
    <View style={styles.thumbName}>
      <Text style={styles.thumbNameText} numberOfLines={2}>
        {shot.name}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm
  },
  caption: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600'
  },
  checkRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  box: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted
  },
  boxChecked: {
    borderColor: colors.statusGreen,
    backgroundColor: colors.statusGreen
  },
  checkLabel: {
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  input: {
    minHeight: 88,
    padding: spacing.sm,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  shotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.camera,
    backgroundColor: colors.bgRaised
  },
  thumbName: {
    width: 64,
    height: 64,
    padding: spacing.xs,
    borderRadius: radii.camera,
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  thumbNameText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  addTile: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.camera,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  addText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  agentLine: {
    color: colors.textMuted,
    fontSize: typography.metaSize
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.accentBlue
  },
  saveText: {
    color: colors.onAccent,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  pressed: {
    backgroundColor: colors.bgRaised
  }
})
