# MassOrca Mobile

[Español](massorca-mobile.es.md)

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

## Pair with MassOrca on your computer

1. On your computer, open MassOrca and go to **Mobile** (the phone button in the sidebar, or **Settings → Mobile**). It shows a pairing QR code.
2. On your phone, open MassOrca Mobile and tap **Pair Desktop**. Scan the QR code, or tap **Paste code instead** and paste the pairing code from your computer.
3. On **Pair with this desktop?**, tap **Pair**. Your computer appears in the host list, with its workspaces and agents.

## Pair with a MassOrca server

A MassOrca server is a Linux machine without a screen that runs MassOrca in server mode (`serve`). Most people reach their server over [Tailscale](https://tailscale.com/), a private network between your own devices.

### Before you start

- **The server runs MassOrca.** Download the Linux AppImage (`MassOrca-<version>-x86_64.AppImage`) from the [MassOrca releases](https://github.com/anubischpr/massorca/releases) onto the server.
- **The phone can reach the server.** Install Tailscale on the server and on the phone, sign both in to the same account, and **make sure Tailscale is switched on in the phone's Tailscale app** before you pair. The server's Tailscale address usually starts with `100.`.
- **Use a normal user account on the server,** not `root`.

### Start the server and pair

Run each command on the server, one at a time.

1. Make the AppImage runnable (only once):

   ```bash
   chmod +x MassOrca-<version>-x86_64.AppImage
   ```

2. Start MassOrca in server mode with a mobile pairing code. Replace `<server-tailscale-address>` with the server's Tailscale address:

   ```bash
   ./MassOrca-<version>-x86_64.AppImage --appimage-extract-and-run --no-sandbox serve --pairing-address <server-tailscale-address> --mobile-pairing
   ```

   If MassOrca's command-line tool is installed on the server, `orca-ide serve --pairing-address <server-tailscale-address> --mobile-pairing` does the same.

3. The terminal prints a QR code, then **Mobile pairing QR:** and a **Pairing URL:** line. On your phone, tap **Pair Desktop** in MassOrca Mobile and scan the QR code, or tap **Paste code instead** and paste the pairing URL.
4. On **Pair with this desktop?**, tap **Pair**.

The server keeps running in that terminal until you stop it with `Ctrl+C`. Your phone stays paired after the server restarts.

**Keep the pairing URL and QR code private.** Anyone who uses them before you do gets access to that server. Do not post them in a chat or a screenshot.

### If the server already runs as a service

If MassOrca runs on the server as a systemd service, it usually starts without a pairing code (often with `--no-pairing`), and there is no command to ask a running server for a new one. Add a pairing code to the service temporarily, then put it back. In the commands below, replace `<service>` with the service's name.

1. Show the service's current start command, and copy its `ExecStart=` line:

   ```bash
   systemctl cat <service>
   ```

2. Open a temporary override:

   ```bash
   sudo systemctl edit --runtime <service>
   ```

   In the editor, add these lines. For the second `ExecStart=`, use the command you copied, without `--no-pairing`, and add `--pairing-address <server-tailscale-address> --mobile-pairing` at the end:

   ```ini
   [Service]
   ExecStart=
   ExecStart=<the copied command> --pairing-address <server-tailscale-address> --mobile-pairing
   StandardOutput=journal
   ```

   The empty `ExecStart=` line clears the old command. Save and close the editor.

3. Restart the service so it prints a pairing code:

   ```bash
   sudo systemctl restart <service>
   ```

4. Show the pairing QR code and URL, then pair as in steps 3 and 4 above:

   ```bash
   journalctl -u <service> -o cat -n 80
   ```

5. Remove the temporary override:

   ```bash
   sudo rm /run/systemd/system/<service>.service.d/override.conf
   ```

6. Reload the service definitions:

   ```bash
   sudo systemctl daemon-reload
   ```

7. Restart the service with its normal settings:

   ```bash
   sudo systemctl restart <service>
   ```

Each restart briefly stops the server, so open chats and terminals reconnect. Devices you already paired keep their access. If the service runs under your user (`systemctl --user`), use `systemctl --user` and `journalctl --user` without `sudo`, and the override lives under `/run/user/<your-user-id>/systemd/user/` instead.

### If pairing fails

- **"Couldn't connect within 25s"**, or the **Pairing log** shows close code `1006`: the phone cannot reach the server. Check that Tailscale is switched on in the phone, that both devices show as connected in Tailscale, and that the server is still running. Then try again.
- **The QR code or URL does not work:** make sure you used the code printed by the server you are pairing with. A code stays valid until a phone uses it. If it was already used, restart the server (or the service) to get a new one.
- **The phone says an update is needed:** see the next section.

## When the phone says an update is needed

Your phone and the computer or server it pairs with are updated separately.

- **Update MassOrca Mobile:** install the newest release from the [Android section](#android).
- **Update MassOrca on your computer:** download the newest desktop release from [MassOrca releases](https://github.com/anubischpr/massorca/releases).
- **On a MassOrca server,** the same wall asks you to update MassOrca on the computer: download the newest AppImage from [MassOrca releases](https://github.com/anubischpr/massorca/releases) onto the server and start `serve` again (or restart the service).

Part of the phone's screen comes from the paired computer or server. If that computer or server runs an older MassOrca, its update button may still open upstream Orca's download page. Use the links on this page instead, and update MassOrca on that computer or server too.
