import { translate } from '@/i18n/i18n'
import { joinCreateProjectPath } from './create-project-defaults'
import { tryDeriveCloneRepoName } from '../../../../shared/clone-repo-name'

export function getDefaultCloneParent(workspaceDir: string): string {
  if (!workspaceDir) {
    return ''
  }

  const trimmed = workspaceDir.replace(/[\\/]+$/, '')
  if (!trimmed) {
    return workspaceDir
  }

  const separatorIndex = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const lastSegment = separatorIndex === -1 ? trimmed : trimmed.slice(separatorIndex + 1)

  if (lastSegment !== 'workspaces') {
    return workspaceDir
  }

  // Why: default Orca worktrees live under "workspaces"; clones should sit beside that tree.
  const parent = separatorIndex === -1 ? '' : trimmed.slice(0, separatorIndex)
  if (parent === '' && trimmed.startsWith('/')) {
    return '/'
  }
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}${trimmed[separatorIndex]}`
  }
  return parent
}

export function getCloneDestinationAutoFill({
  step,
  cloneDestination,
  activeRuntimeEnvironmentId,
  sshTargetId,
  workspaceDir,
  cloneStepAutoFilled
}: {
  step: string
  cloneDestination: string
  activeRuntimeEnvironmentId: string | null | undefined
  sshTargetId?: string | null | undefined
  workspaceDir: string | null | undefined
  cloneStepAutoFilled: boolean
}): { destination: string } | null {
  if (step !== 'clone' || cloneStepAutoFilled || cloneDestination) {
    return null
  }
  if (activeRuntimeEnvironmentId?.trim() || sshTargetId?.trim() || !workspaceDir) {
    return null
  }
  return { destination: getDefaultCloneParent(workspaceDir) }
}

/** SSH/runtime parent: the host's configured location, else `<remote home>/projects`. */
export function getRemoteCloneParent(
  source: { configuredLocation: string } | { home: string }
): string {
  if ('configuredLocation' in source) {
    return getDefaultCloneParent(source.configuredLocation.trim())
  }
  const home = source.home.trim()
  return home ? joinCreateProjectPath(home, 'projects') : ''
}

/** Full path `git clone` will create, or null until both URL and parent are usable. */
export function getClonePreviewPath(cloneUrl: string, parent: string): string | null {
  const repoName = tryDeriveCloneRepoName(cloneUrl)
  return repoName && parent.trim() ? joinCreateProjectPath(parent, repoName) : null
}

const TARGET_EXISTS_RE = /already exists and is not an empty directory/i

/** Turns git's "destination already exists" failure into an actionable message. */
export function describeCloneFailure(message: string, cloneUrl: string, parent: string): string {
  const target = getClonePreviewPath(cloneUrl, parent)
  if (!target || !TARGET_EXISTS_RE.test(message)) {
    return message
  }
  return translate(
    'auto.components.sidebar.cloneDefaults.targetExists',
    '{{path}} already exists and is not empty. Pick another parent folder, or remove or rename that folder.',
    { path: target }
  )
}
