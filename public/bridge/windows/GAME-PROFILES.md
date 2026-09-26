# Automatic game profiles

Requires this version of both the web/mobile app and Windows bridge. Settings warns when a connected bridge is too old to support profile mappings. The existing controller layout, touch input handling, 3 ms scheduling target and 120 ms wheel return are retained.

The bridge reports the actual foreground window/process. The app selects one profile for **both** wheel and gamepad outputs. On a profile change it releases held controls before applying new assignments. Opening a browser tab named after a game does not select that game's profile. Title changes inside a recognized executable do not cancel gestures. Unknown game executables use standard mappings; any adjustments saved in Settings are stored for that executable and restored when it returns. UWP host applications use an exact known game title or a title-specific custom key.

## Included profiles

| Profile | Wheel GAS | Wheel brake/drift | Wheel handbrake | Wheel nitro | Gamepad |
| --- | --- | --- | --- | --- | --- |
| Asphalt Legends, automatic acceleration (default) | No output: game accelerates | LT/L2 | X/Square | A/Cross | A/Cross nitro; X/Square or LT/L2 drift; RT disabled to avoid GAS triggering nitro |
| Asphalt Legends, manual acceleration | RT/R2 | LT/L2 | X/Square | A/Cross | Standard buttons/triggers; enable manual acceleration in the game |
| Need for Speed Heat | RT/R2 | LT/L2 | X/Square | A/Cross | Standard native controls |
| Other games | Standard or saved per-game override | Standard or saved override | Standard or saved override | Standard or saved override | Standard or saved override |

Asphalt unsupported wheel actions (clutch, gears, horn) are disabled rather than causing unrelated actions. Select **Manual** under Settings > Asphalt acceleration only if manual acceleration is enabled inside the game. A process name does not expose the game's acceleration/TouchDrive setting. Turn TouchDrive off inside Asphalt to have direct steering rather than route selection. Nothing here edits game files or Steam Input bindings.

In Settings, Automatic game profiles is on by default. Wheel action bindings and Gamepad bindings save overrides for the current game. Restore detected game's profile removes that game's overrides. Disable Automatic game profiles to use global manual bindings. Gamepad button labels remain physical button labels; the LED screen and Settings show the active profile.

## Evidence and scope

- SpecialEffect's first-hand Windows control demonstration documents Asphalt's controller A boost, X drift, and automatic acceleration: https://gameaccess.info/asphalt-9-legends-1-3-button-racing/
- SpecialEffect's controller tests document alternate RT/RB nitro and LT/LB drift inputs, and Xbox/PlayStation equivalents (Android platform; not a claim of universal PC settings): https://gameaccess.info/xac-compatible-android-games/
- Gameloft's manual-drive article is **Nintendo/Joy-Con specific** and is not used to translate Xbox face-button letters: https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/4025-how-do-i-play-with-the-manual-drive-control-scheme/
- EA's PC/Xbox manual supplies the NFS Heat controls: https://www.ea.com/able/resources/need-for-speed/need-for-speed-heat/pc/text-manual

The Asphalt auto-acceleration default addresses the reported GAS-triggering-nitro configuration. Its manual-acceleration variant must match the game's selected scheme. These profiles have automated transport/report tests, not on-device gameplay certification. No system can infer arbitrary game or Steam Input remaps solely from a process name. Keyboard-only games, emulators, modified layouts and titles with no verified preset need a saved mapping or their own input configuration. Unknown games are never labeled verified or silently assigned Asphalt's bindings.
