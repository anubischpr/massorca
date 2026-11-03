import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NATIVE_CHAT_CHECKLIST_ITEM_MAX_LENGTH } from '../../../../shared/native-chat-checklist'

/**
 * The row under a checklist that adds the person's own item. Enter or Add saves the trimmed text
 * through `onAdd`; the field clears only once the host has kept the item.
 */
export function NativeChatChecklistAddItem({
  onAdd
}: {
  /** Resolves false when the host did not keep the item; the text then stays for another try. */
  onAdd: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const placeholder = t('components.nativeChatSummary.checklistAddItem', 'Add an item')

  const add = async (): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed || saving) {
      return
    }
    setSaving(true)
    const saved = await onAdd(trimmed).catch(() => false)
    setSaving(false)
    if (saved) {
      setText('')
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={text}
        disabled={saving}
        maxLength={NATIVE_CHAT_CHECKLIST_ITEM_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void add()
          }
        }}
      />
      <Button type="button" variant="outline" size="xs" disabled={saving} onClick={() => void add()}>
        {t('components.nativeChatSummary.checklistAdd', 'Add')}
      </Button>
    </div>
  )
}
