# MassOrca rose branding

`massorca-rose.svg` is the source of truth for the MassOrca rose icon: one fill (`#FF2E88`), a 512 viewBox, and transparent cut-outs. Edit the SVG, then regenerate every raster from the repository root:

```bash
node config/scripts/generate-massorca-icons.mjs
```

The script rasterizes the SVG paths itself and writes with the repo's `pngjs` dependency, so no native SVG renderer is needed.

## Outputs

| File                                         | Used by                                                            | Format                                             |
| -------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `resources/build/icon.ico`                   | Windows installer and app icon                                     | Multi-size PNG ICO, 16 to 256, transparent         |
| `resources/build/icon.icns`                  | macOS app icon, and Linux hicolor PNGs derived by electron-builder | ICNS, transparent                                  |
| `resources/build/icon.png`                   | Desktop fallback, 1024                                             | Transparent                                        |
| `resources/icon.png`                         | Tray and the classic entry in the settings icon selector, 256      | Transparent                                        |
| `mobile/assets/icon.png`                     | Expo `icon`: iOS app icon and Android legacy icon                  | Opaque RGB, #111111 background                     |
| `mobile/assets/adaptive-icon.png`            | Android adaptive foreground                                        | Transparent, rose inside the 66% safe-zone circle  |
| `mobile/assets/adaptive-icon-monochrome.png` | Android themed (monochrome) icon                                   | White silhouette, transparent                      |
| `mobile/assets/splash-icon.png`              | Splash screen, 400x255                                             | Transparent, sits on the #111111 splash background |
| `mobile/assets/notification-icon.png`        | Android notification small icon (`app.config.js`)                  | 96px white silhouette                              |

## Constraints

- `mobile/assets/icon.png` must stay opaque: iOS app icons cannot carry an alpha channel, so it is written as RGB. Its #111111 background matches the splash background.
- Android adaptive background is `#00000000` (transparent). Launchers draw the rose over the wallpaper with no shape mask, because the rose is the whole icon. Set `android.adaptiveIcon.backgroundColor` back to a solid color if a masked tile is wanted.
- Desktop display name is MassOrca: `productName`, window titles, menu labels, the About panel, shortcuts, the installer caption and the Linux desktop entry. Install identity is unchanged, so an installed Orca upgrades in place: `appId` (and so the NSIS registry key), the Windows install folder and `Orca.exe` (`win.executableName`), the macOS bundle `Orca.app` with `CFBundleName` kept as `Orca` for the Keychain item, the Linux `orca-ide` binary and packages, the `orca://` scheme, and the production profile `<appData>/orca`, which `configure-process.ts` pins explicitly.
- Release artifact file names (`orca-windows-setup.exe`, `orca-linux.AppImage`, `orca-macos-*.dmg`) are unchanged. The in-app updater and the release workflows match them by name.
- `resources/icon-source/generate.sh` (macOS Icon Composer) still produces the previous logo. Do not run it for these assets, or it will overwrite the rose.
