import type { posix } from 'node:path'
import type { SkillScanRoot } from './skill-discovery-sources'

/**
 * Antigravity's skill roots in its own CLI directory: the user's skills and the ones the CLI ships.
 * `agy -p "/skills"` lists both, so the `/` menu offers both.
 */
export function antigravitySkillSources(
  home: string,
  pathApi: Pick<typeof posix, 'join'>
): SkillScanRoot[] {
  const cliDirectory = pathApi.join(home, '.gemini', 'antigravity-cli')
  return [
    {
      id: 'home-antigravity-cli',
      label: 'Antigravity CLI skills',
      path: pathApi.join(cliDirectory, 'skills'),
      sourceKind: 'home',
      providers: ['agent-skills'],
      owner: 'antigravity'
    },
    {
      id: 'home-antigravity-builtin',
      label: 'Antigravity built-in skills',
      path: pathApi.join(cliDirectory, 'builtin', 'skills'),
      // Why: `plugin` roots are never deletable, and Orca must not remove files the CLI ships.
      sourceKind: 'plugin',
      providers: ['agent-skills'],
      owner: 'antigravity'
    }
  ]
}
