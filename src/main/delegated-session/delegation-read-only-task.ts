/** The text a parent wrote for a delegated task; placement reads all of it. */
export type DelegationTaskText = {
  summary: string
  title: string
  prompt: string
}

// Why: word-start stems so "review" hits "reviews"; English and Spanish, matched with accents folded.
const READ_ONLY_PATTERN = new RegExp(
  `\\b(?:${[
    'research',
    'review',
    'explor',
    'read-only',
    'compar',
    'explain',
    'investigat',
    'audit',
    'analy[sz]',
    'inspect',
    'diagnos',
    'assess',
    'summari[sz]',
    'revis',
    'explic',
    'analiz',
    'evalu',
    'resum'
  ].join('|')})`,
  'i'
)

// Why: any sign of producing or changing something outranks a read-only verb, so "review and fix" writes.
const CHANGE_PATTERN = new RegExp(
  `\\b(?:${[
    'design',
    'implement',
    'build',
    'creat',
    'prototyp',
    'mock',
    'edit',
    'fix',
    'refactor',
    'add(?:s|ed|ing)?\\b',
    // Why: a bare stem would also match "changelog".
    'chang(?:e|es|ed|ing)\\b',
    'updat',
    'modif',
    'writ',
    'rewrit',
    'generat',
    'scaffold',
    'migrat',
    'delet',
    'remov',
    'renam',
    'install',
    'commit',
    'patch',
    'disen',
    'constru',
    'crea',
    'prototip',
    'arregl',
    'corrig',
    'agreg',
    'anad',
    'cambi',
    'actualiz',
    'modific',
    'escrib',
    'gener',
    'borr',
    'elimin',
    'renombr',
    'instal'
  ].join('|')})`,
  'i'
)

/** True only when the task clearly just reads: a read-only verb and no sign of making or changing anything. */
export function isClearlyReadOnlyDelegationTask(task: DelegationTaskText): boolean {
  const text = [task.summary, task.title, task.prompt]
    .join('\n')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return READ_ONLY_PATTERN.test(text) && !CHANGE_PATTERN.test(text)
}
