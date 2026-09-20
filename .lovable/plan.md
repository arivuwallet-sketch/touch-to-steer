# Rebuild the mobile driving and gamepad controls

## What will change
- Replace the floating showroom view with two flat, full-screen phone layouts matching the supplied references.
- Build a G29-inspired driving screen: 900-degree multi-turn touch wheel, dual paddles, D-pad, face controls, selector dial, RPM lights, clutch/brake/accelerator, handbrake, horn, and configurable utility buttons.
- Build an Apex 5-inspired gamepad screen: asymmetric Hall-style sticks, rotary D-pad, mechanical ABXY, analog LT/RT, LB/RB, six remappable extra controls, gyro toggle, profile controls, and a compact status display.
- Keep controls reachable in landscape without scrolling and ensure multi-touch inputs can operate together.

## Steering correction
- Track continuous finger angle around the wheel center across repeated turns instead of clamping after roughly half a turn.
- Map the full visual range to 900 degrees lock-to-lock, prevent angle-wrap jumps, preserve the current position on release, and add optional spring return.
- Keep tilt steering available as an explicit mode rather than the default.

## PC behavior
- Continue sending a standard virtual Xbox controller through the existing Windows bridge for broad game compatibility.
- Add mappings for the new buttons and profiles, while clearly treating hardware-only effects such as true motor force feedback and physical trigger resistance as visual/haptic simulation on a phone.

## Verification
- Check TypeScript, confirm both layouts render in landscape, drag the wheel through multiple turns, operate sticks/triggers/buttons, and inspect browser errors.
