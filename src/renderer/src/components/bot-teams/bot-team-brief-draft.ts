/** Unsaved Brief Markdown per project. It lives in memory, so leaving the Brief and coming back keeps it. */
const drafts = new Map<string, string>()

export function readBriefDraft(projectId: string): string | null {
  return drafts.get(projectId) ?? null
}

/** Keeps the draft while it differs from the saved Markdown; a draft that matches it is dropped. */
export function keepBriefDraft(projectId: string, markdown: string, savedMarkdown: string): void {
  if (markdown === savedMarkdown) {
    drafts.delete(projectId)
  } else {
    drafts.set(projectId, markdown)
  }
}

export function dropBriefDraft(projectId: string): void {
  drafts.delete(projectId)
}
