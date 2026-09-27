# Internet pairing and larger controller groups

Each host PC runs its own bridge. Phones worldwide can connect to that host through a secure WebSocket tunnel. This does not stream the game screen, create online multiplayer inside a local game, or lift the game's own player limit. Share video separately when needed. There is no central account service or global matchmaking server.

## Windows host

1. Extract the latest Windows bridge ZIP. Close older bridge processes using port 8787.
2. Install Cloudflare's cloudflared from its official distribution, or run `winget install --id Cloudflare.cloudflared` and reopen PowerShell.
3. Run `./Start-Global.ps1` beside `TouchToSteer-Bridge.exe`. This creates a fresh random pairing key, binds the bridge to loopback, and opens an outbound HTTPS tunnel. No router port forwarding is needed.
4. Share the displayed tunnel hostname and pairing key privately. Anyone with this key can operate a controller on this PC. The global launcher disables remote mouse injection.
5. On each phone, open controller Settings. Enter the hostname as `wss://your-hostname.trycloudflare.com`, enter the pairing key, choose the output type, and connect. The key is not placed in the URL or saved in browser storage. Reopening Settings requires entering it again for a new connection.
6. Stop the launcher to end access. Restart to rotate the key and temporary URL. Cloudflare Quick Tunnels are for testing, not a production uptime guarantee. For a stable hostname, configure a named Cloudflare Tunnel to `http://127.0.0.1:8787` and run the bridge with the environment below.

## Capacity

The bridge accepts up to 16 independent controller sessions by default (`RIG_MAX_PLAYERS=1..16`). The Windows driver may accept fewer, and the game must support the chosen devices/player count.

- XInput/Xbox: at most four bridge XInput targets. Physical controllers or other software may occupy slots too. Universal mode also consumes one XInput slot and one DS4 device.
- DS4/HID: use this output for additional controller sessions in compatible games. It is not a workaround for a game that only accepts four XInput players. Driver creation failures are reported, not counted as successful connections.
- Each phone keeps its own target, mappings, feedback and release watchdog in both gamepad and steering mode. Disconnect frees its resources.
- Multiple host PCs independently serve their groups; the four-XInput limit is per PC, not a global user account limit.

## Manual secure host configuration

Set `RIG_PUBLIC=1`, `RIG_ACCESS_TOKEN` to 32–128 random URL-safe characters, and optionally `RIG_MAX_PLAYERS=16`. Public mode refuses to start without a valid key, binds only to 127.0.0.1, and requires the key during the WebSocket upgrade before controller allocation or game/telemetry disclosure. Expose it only through a TLS tunnel/proxy; phone clients require `wss://` for non-loopback authenticated connections. Explicit host opt-in `RIG_REMOTE_MOUSE=1` permits mouse injection; leave it off for controller-only guests.

The existing LAN workflow remains available without public mode. Never publish an unauthenticated LAN bridge. The bridge limits frames to 16 KiB and total sockets to the configured player count plus eight. Pairing errors, controller slot errors and driver failures appear in Settings. This is a shared host key, not per-player accounts or individual revocation.

The 1 ms software send target is unchanged. Internet routing, jitter, tunnel availability and driver/game frame time determine actual latency. These connections have not been certified on your Windows hardware.

Official references:
- https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput
- https://developers.cloudflare.com/tunnel/get-started/
- https://developers.cloudflare.com/network/websockets/
