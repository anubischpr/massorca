import type { MenuItemConstructorOptions } from 'electron'
import { PRODUCT_DISPLAY_NAME } from '../../shared/product-identity'
import { translateMain } from '../i18n/main-i18n'

// Why: Electron's role labels default to app.name, which stays 'Orca' for the Keychain.
// About and Hide carry the display name instead; the roles keep their native behaviour.
export function createAboutAppMenuItem(): MenuItemConstructorOptions {
  return {
    role: 'about',
    label: translateMain('menu.aboutApp', `About ${PRODUCT_DISPLAY_NAME}`, {
      appName: PRODUCT_DISPLAY_NAME
    })
  }
}

export function createHideAppMenuItem(): MenuItemConstructorOptions {
  return {
    role: 'hide',
    label: translateMain('menu.hideApp', `Hide ${PRODUCT_DISPLAY_NAME}`, {
      appName: PRODUCT_DISPLAY_NAME
    })
  }
}
