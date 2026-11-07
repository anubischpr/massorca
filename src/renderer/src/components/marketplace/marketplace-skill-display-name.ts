/**
 * The label a skill shows: no leading slash, hyphens and underscores as spaces, first letter capitalized.
 * Why: only the label changes; matching, installs and paths keep the real name.
 * A plugin prefix stays readable: "expo:expo-router" reads "Expo: expo router".
 */
export function skillDisplayName(name: string): string {
  const bare = name.trim().replace(/^\/+/, '')
  const colon = bare.indexOf(':')
  if (colon > 0) {
    const plugin = wordsOf(bare.slice(0, colon))
    const skill = wordsOf(bare.slice(colon + 1))
    if (plugin !== '' && skill !== '') {
      return `${capitalize(plugin)}: ${skill}`
    }
  }
  const words = wordsOf(bare)
  return words === '' ? name : capitalize(words)
}

function wordsOf(text: string): string {
  return text.replace(/[-_\s]+/g, ' ').trim()
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
