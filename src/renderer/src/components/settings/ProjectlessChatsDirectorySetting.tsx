import React, { useEffect, useId, useRef, useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { isImeCompositionKeyDown } from '@/lib/ime-composition-keyboard-event'
import { translate } from '@/i18n/i18n'

type ProjectlessChatsDirectorySettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ProjectlessChatsDirectorySetting({
  settings,
  updateSettings
}: ProjectlessChatsDirectorySettingProps): React.JSX.Element {
  const inputId = useId()
  const value = settings.projectlessChatsDir
  // Why: the renderer has no home directory, so the stock path comes from main.
  // null (still loading or unavailable) keeps Reset disabled rather than guessing.
  const [defaultValue, setDefaultValue] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState(value)
  const draftValueRef = useRef(value)
  const skipNextBlurCommitRef = useRef(false)

  useEffect(() => {
    let active = true
    void window.api.settings
      .getDefaultProjectlessChatsDir()
      .then((dir) => {
        if (active) {
          setDefaultValue(dir)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setDraftValue(value)
    draftValueRef.current = value
  }, [value])

  const setDraft = (next: string): void => {
    draftValueRef.current = next
    setDraftValue(next)
  }

  const commitDraftValue = (): void => {
    const next = draftValueRef.current.trim()
    if (!next) {
      setDraft(value)
      return
    }
    if (next === value) {
      return
    }
    updateSettings({ projectlessChatsDir: next })
  }

  const handleBlur = (): void => {
    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false
      return
    }
    commitDraftValue()
  }

  const handleBrowse = async (): Promise<void> => {
    try {
      const path = await window.api.repos.pickFolder()
      if (path) {
        setDraft(path)
        updateSettings({ projectlessChatsDir: path })
        return
      }
      setDraft(value)
    } finally {
      skipNextBlurCommitRef.current = false
    }
  }

  const handleReset = (): void => {
    if (defaultValue === null) {
      return
    }
    setDraft(defaultValue)
    updateSettings({ projectlessChatsDir: defaultValue })
  }

  const isDefault = defaultValue === null || value === defaultValue
  const title = translate(
    'auto.components.settings.ProjectlessChatsDirectorySetting.c5ef89ab92',
    'Projectless chats folder'
  )

  return (
    <SearchableSetting
      title={title}
      description={translate(
        'auto.components.settings.ProjectlessChatsDirectorySetting.b6dd0334f6',
        'Where chats started outside a project are stored, one folder per day.'
      )}
      keywords={['projectless', 'chat', 'folder', 'path', 'directory', 'no project']}
      className="space-y-2"
    >
      <div className="space-y-1">
        <Label htmlFor={inputId}>{title}</Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.ProjectlessChatsDirectorySetting.b6dd0334f6',
            'Where chats started outside a project are stored, one folder per day.'
          )}
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draftValue}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            // Why: an Enter that only confirms a CJK IME candidate must not commit the path.
            if (isImeCompositionKeyDown(e)) {
              return
            }
            if (e.key === 'Enter') {
              skipNextBlurCommitRef.current = true
              commitDraftValue()
              e.currentTarget.blur()
              return
            }
            if (e.key === 'Escape') {
              skipNextBlurCommitRef.current = true
              setDraft(value)
              e.currentTarget.blur()
            }
          }}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onPointerDown={() => {
            skipNextBlurCommitRef.current = true
          }}
          onClick={() => void handleBrowse()}
          className="shrink-0"
        >
          <FolderOpen className="size-3.5" />
          {translate(
            'auto.components.settings.ProjectlessChatsDirectorySetting.a43dc59fe4',
            'Change'
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isDefault}
          onClick={handleReset}
          className="shrink-0"
        >
          <RotateCcw className="size-3.5" />
          {translate(
            'auto.components.settings.ProjectlessChatsDirectorySetting.43545b7a79',
            'Reset'
          )}
        </Button>
      </div>
    </SearchableSetting>
  )
}
