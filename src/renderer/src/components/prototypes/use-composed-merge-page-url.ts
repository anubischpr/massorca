import { useEffect, useState } from 'react'

/**
 * The composed merge page as a blob document, with the section to show as its fragment. A srcdoc page
 * reloads on every change; a fragment change within the same document only scrolls, so a click on a
 * section lands on it without a reload. The frame stays sandboxed with no script.
 */
export function useComposedMergePageUrl(html: string | null, anchor: string | null): string | null {
  const [pageUrl, setPageUrl] = useState<string | null>(null)
  useEffect(() => {
    if (html === null) {
      setPageUrl(null)
      return
    }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    setPageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [html])
  if (pageUrl === null) {
    return null
  }
  return anchor === null ? pageUrl : `${pageUrl}#${anchor}`
}
