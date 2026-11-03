import type { BotTeamBrief } from './rpc-contract/bot-team-room-params'

type BriefLists = Pick<BotTeamBrief, 'requirements' | 'constraints' | 'decisions'>

const section = (title: string, lines: string[]): string =>
  [`## ${title}`, ...lines.map((line) => `- ${line}`)].join('\n')

/** The Markdown a project's Brief starts from before anyone saves Markdown: its three lists. */
export function briefMarkdownFromLists(brief: BriefLists): string {
  return [
    section('Requirements', brief.requirements),
    section('Constraints', brief.constraints),
    section('Decisions', brief.decisions)
  ].join('\n\n')
}

/** What the Brief editor opens with: the saved Markdown, or the lists when none is saved yet. */
export function briefEditorMarkdown(brief: BotTeamBrief): string {
  return typeof brief.markdown === 'string' ? brief.markdown : briefMarkdownFromLists(brief)
}
