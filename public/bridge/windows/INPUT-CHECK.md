# Controller response fixes

This update keeps the existing gamepad and wheel layout. It replaces the recurring synchronous foreground-game query, which could stop all bridge input for up to 700 ms every 1.2 seconds, with a persistent asynchronous helper sampling every 250 ms. The bridge reads its cache every 250 ms; window changes normally reach the phone within about 500 ms after helper startup, independently of controller input. The PowerShell query also uses its own writable process-ID variable.

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


## Game display and steering follow-up

- The gamepad LED screen now receives the live foreground title. A new or reconnected phone gets the cached title immediately; blank titles fall back to the process name. A closed connection clears the display. Failed or stale detection shows unavailable rather than the previous game.
- Detection reports the foreground Windows application, including games without a built-in profile. Alt-tab to another application updates the title. This is not a universal telemetry decoder: speed/RPM still require a supported game's telemetry feed.
- Wheel dragging caches geometry per grab, rebases when a finger crosses the hub, and does not reset steering when sensitivity or unrelated callbacks change. Full lock still respects the chosen rotation range. Immediate input reports, the configurable 60–240 Hz watchdog and 120 ms auto-centre remain in place.
- DS4 pedals now send LT/RT axes and their trigger bits only. GAS no longer also presses Cross, and BRAKE no longer also presses Square. Handbrake and nitro no longer send extra R1/Circle aliases. Legacy games requiring face-button driving must bind the canonical controls in their own input settings.

| Wheel action | Xbox output | DS4 output |
| --- | --- | --- |
| Steering | Left stick X | Left stick X |
| GAS / BRAKE | RT / LT | R2 / L2 |
| Handbrake | A | Cross |
| Nitro | LB | L1 |
| Horn | L3 | L3 |
| Gear up / down (keyboard E/Q) | RB / LB | R1 / L1 |

These are controller bindings, not guaranteed game actions: games assign their own controls. Gear-down and nitro share LB/L1; choose the game binding for the action you use. Test in your game and adjust its bindings if its defaults differ.

For the follow-up check, start a game **before** connecting the phone, switch to another game, then disconnect/reconnect. Check the LED title each time. Sweep the wheel past 180° repeatedly with a 900°/1080° range, reverse at full lock, cross the hub, and re-grab during auto-centre. Repeat while holding GAS. The screen's game-name update must not interrupt these inputs.


## 3 ms polling target

Both gamepad and wheel now default to the 333 Hz option, which schedules the background state check with a 3 ms target. Existing installations adopt it once on the next app load; subsequent manual rate selections remain saved. Existing rate buttons and Settings can still select 60/120/144/180/240 Hz.

Input changes still transmit immediately, button edges retain priority, and unchanged snapshots retain the 250 ms recovery heartbeat. No extra smoothing, input batching, steering changes, mapping changes or layout changes are introduced. A message task between timer callbacks avoids the nested-timer 4 ms minimum where supported; scheduling remains subject to browser throttling and device load. This is not a claim of measured 3 ms network or end-to-end gameplay latency. Auto-centering remains 120 ms.


## Steering release and action bindings

Wheel release is now captured at the window before other controls can stop propagation. Movement outside the wheel works when pointer capture fails, and a final touch-end clears missed pointer ownership. The 120 ms centering timer guarantees a neutral report even if animation frames stall; re-grabbing cancels both return paths. Auto-centre is enabled once for existing saved installations by this update, and can subsequently be changed in Settings.

Settings > Wheel action bindings assigns GAS, BRAKE, HANDBRAKE, NITRO, CLUTCH, gear shifts and HORN individually to a controller output. Match these to the game's own controller bindings; there is no universal nitro assignment. These settings affect wheel actions, not gamepad face-button identities. Clutch no longer applies 60% brake: its default is now X/Square. Analog RT/LT assignments preserve partial travel; face-button assignments are digital.

Install the bridge built from this commit as well as the updated app. Old bridges do not understand the custom binding field. If a game reacts to both virtual devices in Universal mode, select XInput only and bind that controller in the game. Test GAS alone, NITRO alone and HANDBRAKE alone, then GAS+NITRO; NITRO must not move either trigger unless you explicitly assigned it to a trigger. Share the game name, controller output mode and its current bindings if its actions still differ.
