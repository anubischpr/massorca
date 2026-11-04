import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import type {
  MarketplaceCustomAddArgs,
  MarketplaceCustomKind,
  MarketplaceCustomPlatform
} from '../../../../shared/marketplace-custom'
import { notifyMarketplaceCustomChanged } from './MarketplaceCatalogCustom'
import { marketplaceUnavailableMessage } from './marketplace-action-messages'

const KINDS: readonly MarketplaceCustomKind[] = ['tool', 'agent', 'skill']

const INSTALL_PLATFORMS: readonly {
  platform: MarketplaceCustomPlatform
  label: string
  placeholder: string
}[] = [
  { platform: 'win32', label: 'Windows', placeholder: 'winget install --id [package id] -e' },
  { platform: 'darwin', label: 'macOS', placeholder: 'brew install [package]' },
  { platform: 'linux', label: 'Linux', placeholder: 'sudo apt-get install -y [package]' }
]

type InstallCommands = Partial<Record<MarketplaceCustomPlatform, string>>

const NAME_ID = 'marketplace-custom-name'
const CHECK_ID = 'marketplace-custom-check'
const LINK_ID = 'marketplace-custom-link'

function isCustomKind(value: string): value is MarketplaceCustomKind {
  return KINDS.some((kind) => kind === value)
}

/** The Add custom board: a tool, agent or skill, with how to tell it is installed and how to install it. */
export function MarketplaceAddCustomDialog({
  open,
  onOpenChange,
  onInstallSkillLink
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A skill is added through the existing install-from-link flow, so the page opens that flow. */
  onInstallSkillLink: (link: string) => void
}): React.JSX.Element {
  const [kind, setKind] = useState<MarketplaceCustomKind>('tool')
  const [name, setName] = useState('')
  const [checkCommand, setCheckCommand] = useState('')
  const [installCommands, setInstallCommands] = useState<InstallCommands>({})
  const [skillLink, setSkillLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setKind('tool')
    setName('')
    setCheckCommand('')
    setInstallCommands({})
    setSkillLink('')
    setSubmitting(false)
    setError(null)
  }

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      reset()
    }
    onOpenChange(next)
  }

  const canAdd = kind === 'skill' ? skillLink.trim() !== '' : name.trim() !== ''

  const submit = async (): Promise<void> => {
    if (!canAdd || submitting) {
      return
    }
    if (kind === 'skill') {
      const link = skillLink.trim()
      handleOpenChange(false)
      onInstallSkillLink(link)
      return
    }
    const api = window.api?.marketplaceCustom
    if (api === undefined) {
      setError(marketplaceUnavailableMessage())
      return
    }
    const args: MarketplaceCustomAddArgs = {
      kind,
      name: name.trim(),
      install: installArgs(installCommands)
    }
    const check = checkCommand.trim()
    if (check !== '') {
      args.checkCommand = check
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.add(args)
      if (result.ok) {
        notifyMarketplaceCustomChanged()
        handleOpenChange(false)
        return
      }
      setError(addFailureMessage(result.reason))
    } catch {
      setError(addFailureMessage('failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.marketplace.MarketplaceAddCustomDialog.title',
              'Add custom'
            )}
          </DialogTitle>
        </DialogHeader>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            if (isCustomKind(value)) {
              setKind(value)
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="tool">
              {translate('auto.components.marketplace.MarketplaceAddCustomDialog.tool', 'Tool')}
            </TabsTrigger>
            <TabsTrigger value="agent">
              {translate('auto.components.marketplace.MarketplaceAddCustomDialog.agent', 'Agent')}
            </TabsTrigger>
            <TabsTrigger value="skill">
              {translate('auto.components.marketplace.MarketplaceAddCustomDialog.skill', 'Skill')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {kind === 'skill' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={LINK_ID}>
              {translate(
                'auto.components.marketplace.MarketplaceAddCustomDialog.skillLink',
                'Link to the skill'
              )}
            </Label>
            <Input
              id={LINK_ID}
              placeholder="https://github.com/[owner]/[repo]"
              value={skillLink}
              onChange={(event) => setSkillLink(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.marketplace.MarketplaceAddCustomDialog.skillLinkHelp',
                'The same as Install from link on the Skills page today.'
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={NAME_ID}>
                {translate('auto.components.marketplace.MarketplaceAddCustomDialog.name', 'Name')}
              </Label>
              <Input
                id={NAME_ID}
                placeholder={translate(
                  'auto.components.marketplace.MarketplaceAddCustomDialog.namePlaceholder',
                  '[app name]'
                )}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={CHECK_ID}>
                {translate(
                  'auto.components.marketplace.MarketplaceAddCustomDialog.check',
                  'How to tell it is installed'
                )}
              </Label>
              <div className="font-mono">
                <Input
                  id={CHECK_ID}
                  placeholder="mytool --version"
                  value={checkCommand}
                  onChange={(event) => setCheckCommand(event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.marketplace.MarketplaceAddCustomDialog.checkHelp',
                  'MassOrca runs this on each host. If it answers, the app shows as installed, even if you installed it yourself.'
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {translate(
                  'auto.components.marketplace.MarketplaceAddCustomDialog.install',
                  'How to install it'
                )}
              </span>
              {INSTALL_PLATFORMS.map(({ platform, label, placeholder }) => (
                <div key={platform} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
                  <div className="min-w-0 grow font-mono">
                    <Input
                      aria-label={`${label} install command`}
                      placeholder={placeholder}
                      value={installCommands[platform] ?? ''}
                      onChange={(event) =>
                        setInstallCommands((current) => ({
                          ...current,
                          [platform]: event.target.value
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.marketplace.MarketplaceAddCustomDialog.installHelp',
                  'Leave a system empty if the app does not run there.'
                )}
              </p>
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            {translate('auto.components.marketplace.MarketplaceAddCustomDialog.cancel', 'Cancel')}
          </Button>
          <Button disabled={!canAdd || submitting} onClick={() => void submit()}>
            {translate('auto.components.marketplace.MarketplaceAddCustomDialog.add', 'Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function installArgs(commands: InstallCommands): InstallCommands {
  const install: InstallCommands = {}
  for (const { platform } of INSTALL_PLATFORMS) {
    const command = commands[platform]?.trim()
    if (command) {
      install[platform] = command
    }
  }
  return install
}

function addFailureMessage(reason: string): string {
  if (reason === 'duplicate') {
    return translate(
      'auto.components.marketplace.MarketplaceAddCustomDialog.duplicate',
      'An app with this name is already in the Marketplace.'
    )
  }
  return translate(
    'auto.components.marketplace.MarketplaceAddCustomDialog.failed',
    'Could not add this app.'
  )
}
