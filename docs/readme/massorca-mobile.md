# MassOrca Mobile

MassOrca Mobile lets you follow and drive your MassOrca agents and terminals from your phone. It pairs with MassOrca on your computer, or with a MassOrca server.

MassOrca Mobile is a separate app from upstream Orca Mobile. Install it from the MassOrca releases below, not from the App Store, Google Play or the upstream Orca site.

## Android

1. On your phone, open the [MassOrca Mobile releases](https://github.com/anubischpr/massorca/releases?q=mobile-android) in Chrome or another full browser.
2. Open the newest release and tap the `.apk` file under **Assets** to download it.
3. When the download finishes, open it from your browser's **Downloads** or from **Files → Downloads**.
4. Follow Android's install prompt. If Android asks, allow only that browser or the Files app to install unknown apps, and turn the permission off again after MassOrca Mobile is installed.

To update, install the newer `.apk` the same way. MassOrca Mobile also tells you when a newer release is available, and its update button opens that release.

### If the install does not work

- **The download never starts:** if the link opened inside another app (Discord, Slack, the GitHub app), choose **Open in browser**, then try again.
- **Samsung Galaxy says Auto Blocker stopped the install:** open **Settings → Security and privacy → Auto Blocker**, turn it off, install MassOrca Mobile, then turn Auto Blocker back on. Leave Play Protect on.
- **Android says the app conflicts with an existing package:** a MassOrca Mobile build signed with a different key is already installed. Uninstall it first, then install again. Upstream Orca Mobile is a separate app and can stay installed.

## iOS

There is no MassOrca Mobile build for iPhone or iPad yet. MassOrca is not on the App Store; the Orca app listed there is upstream Orca Mobile, a different app. Use an Android phone for now.

## Pair your phone

1. On your computer, open MassOrca and go to **Mobile** (the phone button in the sidebar, or **Settings → Mobile**). It shows a pairing QR code.
2. On your phone, open MassOrca Mobile, choose **Pair with desktop** and scan the QR code. If the camera is not available, copy the pairing code on your computer and paste it on your phone instead.
3. Confirm on your phone. Your computer appears in the host list, with its workspaces and agents.

If MassOrca runs on a server without a screen, ask whoever runs that server for its pairing QR code or pairing code, then follow step 2.

## When the phone says an update is needed

Your phone and the computer or server it pairs with are updated separately.

- **Update MassOrca Mobile:** install the newest release from the [Android section](#android).
- **Update MassOrca on your computer:** download the newest desktop release from [MassOrca releases](https://github.com/anubischpr/massorca/releases).

Part of the phone's screen comes from the paired computer or server. If that computer or server runs an older MassOrca, its update button may still open upstream Orca's download page. Use the links on this page instead, and update MassOrca on that computer or server too.
