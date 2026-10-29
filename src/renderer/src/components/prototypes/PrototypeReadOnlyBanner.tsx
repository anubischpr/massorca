import { Trans } from 'react-i18next'
import { i18n, translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import {
  backToActive,
  makeMain,
  type PrototypeSetState
} from '../../../../shared/prototype-set-state'

type Update = (transform: (state: PrototypeSetState) => PrototypeSetState) => void

/** Shown over a read-only direction: where the main is, and the only way to change it. */
export function PrototypeReadOnlyBanner({
  state,
  update
}: {
  state: PrototypeSetState
  update: Update
}): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex w-full max-w-[680px] flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2.5"
    >
      <span className="min-w-[240px] flex-1 text-xs">
        <Trans
          i18n={i18n}
          defaults={translate(
            'components.prototypes.peekText',
            'Viewing <letter>{{view}}</letter>, read-only. Select any element to see its properties; notes and edits go on the main, <letter>{{active}}</letter>.',
            { view: state.view, active: state.active }
          )}
          components={{ letter: <span className="font-semibold" /> }}
        />
      </span>
      <Button type="button" size="xs" onClick={() => update(backToActive)}>
        {translate('components.prototypes.backToMain', 'Back to main')}
      </Button>
      <Button type="button" size="xs" variant="outline" onClick={() => update(makeMain)}>
        {translate('components.prototypes.makeMain', 'Make main')}
      </Button>
    </div>
  )
}
