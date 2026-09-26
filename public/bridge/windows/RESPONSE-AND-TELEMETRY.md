# Response and telemetry

Update the app and Windows bridge together.

- RPM is decoded from supported game telemetry, never from throttle position or audio. Missing telemetry blanks the gauges after 500 ms. Asphalt currently has no RPM decoder in this bridge.
- OutGauge includes actual RPM but no redline. Its numeric RPM remains live while the dial says SCALE UNAVAILABLE instead of assuming a 10,000 RPM engine.
- ForceFlex applies radial response curves after the deadzone. Direction, circular travel, centre zero and maximum travel are preserved at every weight. The gf names are software presets, not measured physical force.
- ForceAdapt retains tap-for-full input and drag-to-feather control. All six travel profiles reach zero and full output. Browser pressure is not used: non-pressure touch hardware can report a constant 0.5. Vibration cues do not create physical trigger resistance.
- Steering tension in Settings is a static response curve. Zero preserves the previous curve; higher values soften response near the centre while retaining full lock. It does not add smoothing, delayed reports or countersteering. The existing 120 ms return and fallback release remain. Local wheel vibration respects the master vibration switch.

These effects operate within touchscreen/browser capabilities. Physical wheel torque or motorized trigger resistance requires suitable hardware and its driver. The existing 3 ms scheduler is retained; it is not a measured end-to-end latency guarantee.

Reference: https://www.w3.org/TR/pointerevents/#dom-pointerevent-pressure
