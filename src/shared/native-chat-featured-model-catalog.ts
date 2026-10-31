/** A host choice as either picker holds it: the value the host runs, its label and any live description. */
export type FeaturedModelChoice = { value: string; label: string; description?: string }

/** The agents with a featured set. A Pi-protocol agent counts only when it runs Gentle Shell. */
export type FeaturedModelAgent = 'claude' | 'codex' | 'antigravity' | 'gentle-shell'

export type FeaturedModelSpec = {
  name: string
  version: string
  /** Shown only when the live catalog gives the model no description. */
  description: string
  matches: (choice: FeaturedModelChoice) => boolean
}

// Each field as lower-case words, padded so a phrase spans whole words within that one field.
function paddedWords(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
}

// Why: value and label are matched separately, so a phrase can never splice across the two fields.
function hasPhrase(choice: FeaturedModelChoice, phrase: string): boolean {
  return [choice.value, choice.label].some((text) => paddedWords(text).includes(phrase))
}

const byValue =
  (value: string): ((choice: FeaturedModelChoice) => boolean) =>
  (choice) =>
    choice.value === value

const byPhrase =
  (phrase: string): ((choice: FeaturedModelChoice) => boolean) =>
  (choice) =>
    hasPhrase(choice, phrase)

// Why: a folded name must be the whole label, so "GPT-5.6 Luna Pro" never reads as the Luna row.
const byWholeLabel =
  (phrase: string): ((choice: FeaturedModelChoice) => boolean) =>
  (choice) =>
    [choice.value, choice.label].some((text) => paddedWords(text) === phrase)

// Why: ids vary by provider and effort suffix, so phrases match words, not whole ids.
export const FEATURED_MODELS: Readonly<Record<FeaturedModelAgent, readonly FeaturedModelSpec[]>> = {
  claude: [
    {
      name: 'Fable',
      version: '5.1',
      description: 'Most capable for the hardest, longest-running tasks',
      matches: byValue('fable')
    },
    {
      name: 'Opus',
      version: '5.5',
      description: 'For complex work and everyday tasks',
      matches: byValue('opus')
    },
    {
      name: 'Sonnet',
      version: '5.5',
      description: 'Efficient for routine tasks',
      matches: byValue('sonnet')
    },
    {
      name: 'Haiku',
      version: '5.5',
      description: 'Fastest for quick answers',
      matches: byValue('haiku')
    }
  ],
  codex: [
    {
      name: 'Astra',
      version: '6',
      description: 'Frontier intelligence for the most demanding work',
      matches: byPhrase(' gpt 6 astra ')
    },
    {
      name: 'Sol',
      version: '6.1',
      description: 'Latest workhorse model for coding and everyday work',
      matches: byPhrase(' gpt 6 1 sol ')
    },
    {
      name: 'Terra',
      version: '6.1',
      description: 'Balanced model for straightforward work',
      matches: byPhrase(' gpt 6 1 terra ')
    },
    {
      name: 'Luna',
      version: '6',
      description: 'Fast and affordable model for easier tasks',
      matches: byPhrase(' gpt 6 luna ')
    }
  ],
  antigravity: [
    {
      name: 'Gemini Argon',
      version: '4',
      description: 'Most capable Gemini for demanding work',
      matches: byPhrase(' gemini 4 argon ')
    },
    {
      name: 'Gemini Flash',
      version: '3.8',
      description: 'Fast Gemini for everyday tasks',
      matches: byPhrase(' gemini 3 8 flash ')
    }
  ],
  'gentle-shell': [
    {
      name: 'DeepSeek Flash',
      version: 'V4',
      description: 'Fast and affordable for everyday coding',
      matches: byPhrase(' deepseek v4 flash ')
    },
    {
      name: 'GLM Flash',
      version: '5.3',
      description: 'Fast and affordable for quick tasks',
      // Why: the Gentle Shell catalog writes GLM ids both as glm-5.3 and glm5.3.
      matches: (choice) =>
        hasPhrase(choice, ' glm 5 3 flash ') || hasPhrase(choice, ' glm5 3 flash ')
    }
  ]
}

// Why: the folded rows read as the prototype names them; any other folded label splits or reads whole.
export const FOLDED_MODELS: Readonly<Record<FeaturedModelAgent, readonly FeaturedModelSpec[]>> = {
  claude: [
    {
      name: 'Opus 1M',
      version: '5.5',
      description: 'Opus with a 1M context window',
      matches: byValue('opus[1m]')
    },
    {
      name: 'Sonnet 1M',
      version: '5.5',
      description: 'Sonnet with a 1M context window',
      matches: byValue('sonnet[1m]')
    }
  ],
  codex: [
    {
      name: 'Sol',
      version: '6',
      description: 'Previous generation workhorse model',
      matches: byWholeLabel(' gpt 6 sol ')
    },
    {
      name: 'Sol',
      version: '5.6',
      description: 'Older generation workhorse model',
      matches: byWholeLabel(' gpt 5 6 sol ')
    },
    {
      name: 'Terra',
      version: '5.6',
      description: 'Older balanced model for straightforward work',
      matches: byWholeLabel(' gpt 5 6 terra ')
    },
    {
      name: 'Luna',
      version: '5.6',
      description: 'Older fast and efficient model',
      matches: byWholeLabel(' gpt 5 6 luna ')
    }
  ],
  antigravity: [
    {
      name: 'Claude Opus',
      version: '5.5',
      description: 'For complex work and everyday tasks',
      matches: byWholeLabel(' claude opus 5 5 ')
    },
    {
      name: 'Claude Sonnet',
      version: '5.5',
      description: 'Efficient for routine tasks',
      matches: byWholeLabel(' claude sonnet 5 5 ')
    },
    {
      name: 'GPT-OSS',
      version: '120B',
      description: 'Open-weight GPT model',
      matches: byWholeLabel(' gpt oss 120b ')
    }
  ],
  'gentle-shell': []
}
