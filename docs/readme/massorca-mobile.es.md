# MassOrca Mobile

[English](massorca-mobile.md)

MassOrca Mobile te permite seguir y controlar tus agentes y terminales de MassOrca desde el teléfono. Se empareja con MassOrca en tu computadora o con un servidor MassOrca.

MassOrca Mobile es una app distinta de Orca Mobile (el proyecto original). Instálala desde las releases de MassOrca que aparecen abajo, no desde la App Store, Google Play ni el sitio de Orca.

## Android

1. En el teléfono, abre las [releases de MassOrca Mobile](https://github.com/anubischpr/massorca/releases?q=mobile-android) en Chrome u otro navegador completo.
2. Abre la release más reciente y toca el archivo `.apk` en **Assets** para descargarlo.
3. Cuando termine la descarga, ábrelo desde **Descargas** del navegador o desde **Archivos → Descargas**.
4. Sigue el aviso de instalación de Android. Si Android lo pide, permite instalar apps desconocidas solo a ese navegador o a la app de Archivos, y vuelve a desactivar el permiso cuando MassOrca Mobile ya esté instalada.

Para actualizar, instala el `.apk` más nuevo de la misma forma. MassOrca Mobile también te avisa cuando hay una release más nueva, y su botón de actualizar abre esa release.

### Si la instalación no funciona

- **La descarga nunca empieza:** si el enlace se abrió dentro de otra app (Discord, Slack, la app de GitHub), elige **Abrir en el navegador** y vuelve a intentarlo.
- **Un Samsung Galaxy dice que Auto Blocker bloqueó la instalación:** abre **Ajustes → Seguridad y privacidad → Auto Blocker**, desactívalo, instala MassOrca Mobile y vuelve a activar Auto Blocker. Deja Play Protect activado.
- **Android dice que la app entra en conflicto con un paquete existente:** ya hay instalada una versión de MassOrca Mobile firmada con otra clave. Desinstálala primero y vuelve a instalar. Orca Mobile (el original) es otra app y puede quedarse instalada.

## iOS

Todavía no hay una versión de MassOrca Mobile para iPhone ni iPad. MassOrca no está en la App Store; la app de Orca que aparece ahí es Orca Mobile, una app distinta. Por ahora, usa un teléfono Android.

## Emparejar con MassOrca en tu computadora

1. En la computadora, abre MassOrca y ve a **Mobile** (el botón del teléfono en la barra lateral, o **Settings → Mobile**). Ahí aparece un código QR de emparejamiento.
2. En el teléfono, abre MassOrca Mobile y toca **Pair Desktop** (emparejar computadora). Escanea el código QR, o toca **Paste code instead** (pegar el código) y pega el código de emparejamiento de tu computadora.
3. En **Pair with this desktop?** (¿emparejar con esta computadora?), toca **Pair**. Tu computadora aparece en la lista de hosts, con sus espacios de trabajo y agentes.

## Emparejar con un servidor MassOrca

Un servidor MassOrca es una máquina Linux sin pantalla que ejecuta MassOrca en modo servidor (`serve`). La mayoría de la gente llega a su servidor a través de [Tailscale](https://tailscale.com/), una red privada entre tus propios dispositivos.

### Antes de empezar

- **El servidor ejecuta MassOrca.** Descarga en el servidor el AppImage de Linux (`MassOrca-<versión>-x86_64.AppImage`) desde las [releases de MassOrca](https://github.com/anubischpr/massorca/releases).
- **El teléfono puede llegar al servidor.** Instala Tailscale en el servidor y en el teléfono, inicia sesión con la misma cuenta en los dos y **asegúrate de que Tailscale esté activado en la app de Tailscale del teléfono** antes de emparejar. La dirección de Tailscale del servidor suele empezar con `100.`.
- **Usa una cuenta de usuario normal en el servidor,** no `root`.

### Iniciar el servidor y emparejar

Ejecuta cada comando en el servidor, uno por uno.

1. Haz ejecutable el AppImage (solo una vez):

   ```bash
   chmod +x MassOrca-<versión>-x86_64.AppImage
   ```

2. Inicia MassOrca en modo servidor con un código de emparejamiento para el teléfono. Reemplaza `<dirección-tailscale-del-servidor>` con la dirección de Tailscale del servidor:

   ```bash
   ./MassOrca-<versión>-x86_64.AppImage --appimage-extract-and-run --no-sandbox serve --pairing-address <dirección-tailscale-del-servidor> --mobile-pairing
   ```

   Si la herramienta de línea de comandos de MassOrca está instalada en el servidor, `orca-ide serve --pairing-address <dirección-tailscale-del-servidor> --mobile-pairing` hace lo mismo.

3. La terminal muestra un código QR y luego las líneas **Mobile pairing QR:** y **Pairing URL:** (el enlace de emparejamiento). En el teléfono, toca **Pair Desktop** en MassOrca Mobile y escanea el código QR, o toca **Paste code instead** y pega el enlace de emparejamiento.
4. En **Pair with this desktop?**, toca **Pair**.

El servidor sigue funcionando en esa terminal hasta que lo detengas con `Ctrl+C`. El teléfono sigue emparejado aunque el servidor se reinicie.

**Mantén en privado el enlace y el código QR de emparejamiento.** Cualquiera que los use antes que tú obtiene acceso a ese servidor. No los publiques en un chat ni en una captura de pantalla.

### Si el servidor ya funciona como servicio

Si MassOrca funciona en el servidor como un servicio de systemd, normalmente arranca sin código de emparejamiento (a menudo con `--no-pairing`), y no hay ningún comando para pedirle uno nuevo a un servidor en marcha. Agrega temporalmente un código de emparejamiento al servicio y luego déjalo como estaba. En los comandos de abajo, reemplaza `<servicio>` con el nombre del servicio.

1. Muestra el comando de inicio actual del servicio y copia su línea `ExecStart=`:

   ```bash
   systemctl cat <servicio>
   ```

2. Abre un ajuste temporal:

   ```bash
   sudo systemctl edit --runtime <servicio>
   ```

   En el editor, agrega estas líneas. En el segundo `ExecStart=`, usa el comando que copiaste, sin `--no-pairing`, y agrega `--pairing-address <dirección-tailscale-del-servidor> --mobile-pairing` al final:

   ```ini
   [Service]
   ExecStart=
   ExecStart=<el comando copiado> --pairing-address <dirección-tailscale-del-servidor> --mobile-pairing
   StandardOutput=journal
   ```

   La línea `ExecStart=` vacía borra el comando anterior. Guarda y cierra el editor.

3. Reinicia el servicio para que muestre un código de emparejamiento:

   ```bash
   sudo systemctl restart <servicio>
   ```

4. Muestra el código QR y el enlace de emparejamiento, y empareja como en los pasos 3 y 4 de arriba:

   ```bash
   journalctl -u <servicio> -o cat -n 80
   ```

5. Elimina el ajuste temporal:

   ```bash
   sudo rm /run/systemd/system/<servicio>.service.d/override.conf
   ```

6. Vuelve a cargar las definiciones de servicios:

   ```bash
   sudo systemctl daemon-reload
   ```

7. Reinicia el servicio con su configuración normal:

   ```bash
   sudo systemctl restart <servicio>
   ```

Cada reinicio detiene el servidor unos segundos, así que los chats y terminales abiertos se reconectan. Los dispositivos que ya emparejaste conservan su acceso. Si el servicio funciona con tu usuario (`systemctl --user`), usa `systemctl --user` y `journalctl --user` sin `sudo`; en ese caso el ajuste temporal está en `/run/user/<tu-id-de-usuario>/systemd/user/`.

### Si el emparejamiento falla

- **"Couldn't connect within 25s"** (no se pudo conectar en 25 s), o el **Pairing log** (registro de emparejamiento) muestra el código de cierre `1006`: el teléfono no llega al servidor. Revisa que Tailscale esté activado en el teléfono, que los dos dispositivos aparezcan conectados en Tailscale y que el servidor siga funcionando. Luego vuelve a intentarlo.
- **El código QR o el enlace no funcionan:** asegúrate de usar el código que mostró el servidor con el que estás emparejando. Un código sigue siendo válido hasta que un teléfono lo usa. Si ya se usó, reinicia el servidor (o el servicio) para obtener uno nuevo.
- **El teléfono dice que hace falta actualizar:** consulta la siguiente sección.

## Cuando el teléfono pide actualizar

El teléfono y la computadora o el servidor con el que se empareja se actualizan por separado.

- **Update MassOrca Mobile** (actualizar MassOrca Mobile): instala la release más nueva desde la [sección de Android](#android).
- **Update MassOrca on your computer** (actualizar MassOrca en tu computadora): descarga la release de escritorio más nueva desde las [releases de MassOrca](https://github.com/anubischpr/massorca/releases).
- **En un servidor MassOrca,** el mismo aviso te pide actualizar MassOrca en la computadora: descarga en el servidor el AppImage más nuevo desde las [releases de MassOrca](https://github.com/anubischpr/massorca/releases) y vuelve a iniciar `serve` (o reinicia el servicio).

Parte de la pantalla del teléfono viene de la computadora o el servidor emparejado. Si esa computadora o ese servidor tiene una versión anterior de MassOrca, su botón de actualizar puede seguir abriendo la página de descarga de Orca. En ese caso, usa los enlaces de esta página y actualiza también MassOrca en esa computadora o ese servidor.
