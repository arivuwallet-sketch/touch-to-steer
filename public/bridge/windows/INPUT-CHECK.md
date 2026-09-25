# Controller response fixes

This update keeps the existing gamepad and wheel layout. It replaces the recurring synchronous foreground-game query, which could stop all bridge input for up to 700 ms every 1.2 seconds, with an asynchronous query that cannot overlap itself. The PowerShell query also uses its own writable process-ID variable.

Other fixes:

- Turbo owns and cancels its pending pulse: releasing during its off phase cannot press the button again later.
- Held buttons remain held until their owning pointer(s) release. Pointer loss, focus loss, mode changes and disconnects cancel gestures and pending pulses.
- Partial LT/RT values are no longer overridden by separate digital trigger aliases. DS4 digital trigger bits are derived from the same analog report.
- The handbrake no longer drops from fully pressed to zero on the first tiny movement.
- Touch wheel return starts immediately and finishes in 120 ms instead of 520–760 ms. The existing Auto-centre setting is honored.
- Keyboard controls send on keydown and keyup; OS key-repeat is ignored. Keyboard and touch inputs have separate ownership.
- Analog socket backlog is bounded more tightly. Native update errors are retried instead of being marked successful.
- A connected socket is shown as ready only after the bridge confirms a virtual controller. After 1.5 seconds without input reports, the bridge neutralizes the controller; this timeout is a disconnect safeguard, not an input delay.

## Install and check

1. Close the old bridge completely. Download and run the bridge built from the new commit. A browser refresh alone cannot update a previously downloaded EXE.
2. Refresh/reopen the controller app so it loads the updated controls. Connect to the new bridge. Begin with **XInput** output to inspect one virtual controller. Universal intentionally exposes both Xbox and DS4 targets.
3. Press Win+R, enter `joy.cpl`, choose **Controller (Xbox 360 For Windows)**, then **Properties > Test**.
4. With Turbo OFF, hold each face button, D-pad direction, shoulder, VIEW, MENU and M1–M4 for two seconds. The corresponding indicator should remain steady until release. Test diagonals and A+LB+RT together.
5. Move each stick through its full range and release. Double-tap sticks for L3/R3. Slowly drag LT and RT to check partial travel, then hold both. The legacy joy.cpl view can combine Xbox triggers onto one axis; use the XInput script below to verify both independently.
6. Switch to wheel mode. Check steering in both directions, GAS, BRAKE, handbrake, nitro and horn. Check simultaneous steering+GAS and GAS+BRAKE, then release. Test Auto-centre both ON and OFF.
7. Turn Turbo ON and release A during a pulse. It must stay released. Disconnect, change mode, hide the app and reconnect: no control should remain stuck.
8. Repeat in **DS4** mode on **Wireless Controller** in joy.cpl. Confirm both trigger axes and trigger buttons respond. HOME/Guide/PS behavior and its visibility depend on the Windows/game interface; standard XInput does not expose the Guide bit.

### Read real Windows XInput reports

The included PowerShell script opens joy.cpl and guides a phone user through observed presses, holds and releases. Run from an extracted source folder:

```powershell
powershell -NoProfile -File .\public\bridge\windows\Test-Controller.ps1 -Mode Pad
powershell -NoProfile -File .\public\bridge\windows\Test-Controller.ps1 -Mode Wheel
```

In the extracted Windows release ZIP, the script is beside the EXE: use `powershell -NoProfile -File .\Test-Controller.ps1 -Mode Pad` (or `-Mode Wheel`).

If multiple XInput controllers are connected, select the TouchToSteer slot with `-ControllerIndex 0` (or 1–3). `-ListOnly` lists available slots. The script writes `TouchToSteer-Input-Check.json` in the current folder; share it if a control fails. It requires Windows and a live virtual controller; it does not fabricate results or test DS4.

### Keyboard mappings

Keep the controller webpage focused to use keyboard controls. Inputs are suspended while Settings is open or while typing in a form. On the same PC, joy.cpl can remain visible beside the focused app; focusing joy.cpl itself releases webpage keys. The guided script is intended for phone input.

| Keys | Gamepad mode | Wheel mode |
| --- | --- | --- |
| Arrow keys | D-pad | Left/right steering, up GAS, down BRAKE |
| W A S D | Left stick | GAS, left, BRAKE, right |
| I J K L | Right stick | — |
| Z X C V | A B X Y | A B X Y aliases |
| Q / E | LB / RB | Gear down / up |
| Left Shift / Left Ctrl | LT / RT | Clutch / nitro |
| Space | A | Handbrake |
| Enter / Backspace / Home | MENU / VIEW / HOME | Same aliases |
| 1–6 | M1–M6 aliases | Same aliases |
| H / R | — | Horn / reset |

M1–M6 map to existing standard controller buttons, not extra hardware buttons. Touchscreen pressure and vibration cannot reproduce the physical springs, motors or polling hardware of a Flydigi Apex 5. The configured send rate is not a measured end-to-end latency guarantee.

## Validation scope

`npm run test:controller` checks production report mapping, real React pointer/key handlers, turbo timing, transport sequencing, a real loopback WebSocket session with a simulated native driver, and unchanged layout markup. `npm run typecheck` and `npm run build` verify the app. The Windows build checks native helper compilation, packaged bridge startup and the diagnostic script's XInput interop compilation.

These automated checks do not establish physical input latency, Wi-Fi performance, game polling behavior, or successful joy.cpl operation on a particular PC. The on-device checks above cover those remaining integration steps.
