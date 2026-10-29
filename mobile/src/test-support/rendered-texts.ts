import type { ReactTestRendererJSON } from 'react-test-renderer'

/** The words a rendered tree draws, one entry per Text node. Read from the serialized tree, where a
 *  host type is a plain string, because the test renderer's instance lookup rejects a string type. */
export function renderedTexts(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | null
): string[] {
  if (node === null) {
    return []
  }
  if (Array.isArray(node)) {
    return node.flatMap(renderedTexts)
  }
  if (node.type === 'Text') {
    return [(node.children ?? []).map((child) => (typeof child === 'string' ? child : '')).join('')]
  }
  return (node.children ?? []).flatMap((child) =>
    typeof child === 'string' ? [] : renderedTexts(child)
  )
}
