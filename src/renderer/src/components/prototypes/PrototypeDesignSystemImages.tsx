import { ImageIcon, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { DesignSystemDraftImage } from '../../../../shared/prototype-design-system-view-state'
import type { DesignSystemImageControls } from './prototype-design-system-props'

/** The chat composer's attach button, for the Design system draft and its notes. */
export function PrototypeDesignSystemAttachButton({
  controls
}: {
  controls: DesignSystemImageControls
}): React.JSX.Element {
  const label = translate('components.native-chat.composer.attach', 'Attach file')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={controls.disabled}
      onClick={controls.pick}
    >
      <Plus />
    </Button>
  )
}

/** The draft's attached images, each removable, and what the last attach could not take. */
export function PrototypeDesignSystemImageList({
  images,
  controls
}: {
  images: readonly DesignSystemDraftImage[]
  controls: DesignSystemImageControls
}): React.JSX.Element | null {
  if (images.length === 0 && controls.notice === null) {
    return null
  }
  return (
    <div className="flex flex-col gap-1">
      {images.length === 0 ? null : (
        <ul
          aria-label={translate('components.prototypes.designSystem.images', 'Attached images')}
          className="flex flex-wrap gap-1"
        >
          {images.map((image) => (
            <li
              key={image.id}
              className="flex max-w-full items-center gap-1 rounded-md border border-border py-0.5 pr-0.5 pl-1.5 text-xs"
            >
              <ImageIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {image.path === undefined
                  ? translate(
                      'components.prototypes.designSystem.imageUploading',
                      '{{name}} (uploading…)',
                      {
                        name: image.name
                      }
                    )
                  : image.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={translate(
                  'components.prototypes.designSystem.removeImage',
                  'Remove {{name}}',
                  {
                    name: image.name
                  }
                )}
                onClick={() => controls.remove(image.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {controls.notice === null ? null : (
        <span role="alert" className="text-[11px] text-destructive">
          {controls.notice}
        </span>
      )}
    </div>
  )
}
