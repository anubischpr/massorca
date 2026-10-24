// Why: MassOrca ships from its own fork; update checks, downloads and support must not send
// people to upstream Orca builds, which carry a different signing key and identity.
export const MASSORCA_GITHUB_REPO = 'anubischpr/massorca'
export const MASSORCA_REPO_URL = `https://github.com/${MASSORCA_GITHUB_REPO}`
export const MASSORCA_REPO_API = `https://api.github.com/repos/${MASSORCA_GITHUB_REPO}`
export const MASSORCA_RELEASES_URL = `${MASSORCA_REPO_URL}/releases`
// Mobile APKs are published as mobile-android-v<version> releases next to desktop releases.
export const MASSORCA_MOBILE_ANDROID_RELEASES_URL = `${MASSORCA_RELEASES_URL}?q=mobile-android`
export const MASSORCA_ISSUES_URL = `${MASSORCA_REPO_URL}/issues`
// Why: the fork has no site; GitHub renders this in-repo guide, kept on the integration branch the
// apps are built from.
export const MASSORCA_MOBILE_GUIDE_URL = `${MASSORCA_REPO_URL}/blob/custom/integration/docs/readme/massorca-mobile.md`
