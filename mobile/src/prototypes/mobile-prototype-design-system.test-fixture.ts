import { designSystemContentOf } from '../../../src/shared/prototype-design-system-content'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import { listedSet } from './mobile-prototype-sets.test-fixture'

export const NEXUS_PROJECT_KEY = '/work/nexuscare'

export const NEXUS_SYSTEM: PrototypeListedDesignSystem = {
  projectKey: NEXUS_PROJECT_KEY,
  projectName: 'nexuscare',
  status: 'detected',
  version: 2,
  tokenCount: 14,
  agent: 'Codex',
  swatches: ['#2563eb', '#e5e5e5', '#f5f5f5', '#16a34a']
}

const TOKENS_JSON = JSON.stringify({
  color: {
    primary: { $value: '#2563eb' },
    background: { $value: '#ffffff' },
    foreground: { $value: '#0a0a0a' },
    muted: { $value: '#f5f5f5' }
  },
  type: {
    display: { $value: '32px', $extensions: { massorca: { weight: 600 } } },
    title: { $value: '20px', $extensions: { massorca: { weight: 600 } } },
    body: { $value: '14px', $extensions: { massorca: { weight: 400 } } }
  },
  space: { '1': { $value: '4px' }, '2': { $value: '8px' }, '3': { $value: '12px' } },
  radius: { sm: { $value: '6px' }, md: { $value: '10px' } },
  $extensions: {
    massorca: {
      version: 2,
      status: 'detected',
      agent: 'Codex',
      sources: [
        { path: 'src/assets/main.css', took: ':root and .dark → 4 colors, radius base 10px' },
        { path: 'docs/STYLEGUIDE.md', took: 'type scale, spacing rules' }
      ]
    }
  }
})

const COMPONENTS_HTML = `<style>.btn{background:var(--bind-background)}</style>
<section data-component="Button" data-variants="primary secondary" data-variant-options="primary secondary disabled hover" data-bind-background="color.primary" data-bind-radius="radius.md"><button class="btn">Go</button></section>
<section data-component="Input" data-variants="default focus"><input /></section>
<section data-component="Card" data-variants="default" data-bind-background="color.muted"><div>Card</div></section>`

/** The content of a small system: four colors, a type scale, space, radius, three components and two sources. */
export function nexusContent(): ReturnType<typeof designSystemContentOf> {
  return designSystemContentOf({ tokensJson: TOKENS_JSON, componentsHtml: COMPONENTS_HTML })
}

/** A set of the project built on version 2, in a chat of the project. */
export function nexusSet(overrides: Partial<PrototypeListedSet> = {}): PrototypeListedSet {
  return listedSet({
    requestId: 'req-nexus',
    sessionId: 'session-nexus',
    agent: 'codex',
    chatTitle: 'Liquidaciones fases 1-3',
    projectKey: NEXUS_PROJECT_KEY,
    projectName: 'nexuscare',
    builtOn: 2,
    ...overrides
  })
}
