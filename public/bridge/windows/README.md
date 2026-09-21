# TouchToSteer Windows Bridge

This is the end-user package for TouchToSteer.

## What the user needs

Windows 10/11 on a supported x64 PC. No Node.js, npm, Git, Git Bash, Visual Studio, or C++ build tools are required to run the packaged bridge.

The first launch may ask for Windows administrator permission to install the bundled ViGEmBus virtual-controller driver. After the driver setup finishes, the bridge restarts itself.

## Start

1. Double-click `TouchToSteer-Bridge.exe`.
2. If Windows asks for administrator permission for the virtual-controller driver, allow it.
3. Keep the bridge running.
4. Put the phone and PC on the same Wi-Fi network.
5. Open the TouchToSteer controller on the phone and connect to the `ws://<PC-IP>:8787` address shown by the bridge.
6. Choose XInput/Xbox 360 or DS4 in the phone Settings panel.

## Troubleshooting

- Allow TouchToSteer through Windows Defender Firewall on Private networks.
- If the controller does not appear, close the bridge and start it again after the driver installer finishes.
- The driver is only needed on Windows because the virtual XInput/DS4 controller is provided by the Windows driver layer.
- The bridge still accepts the same optional environment variables used by the developer version, including `RIG_PORT` and telemetry-port overrides.

## Telemetry

The packaged bridge contains the same native telemetry parsers as the web app bridge: Forza Data Out, EA F1/Codemasters UDP, DiRT UDP, Project CARS 2/Automobilista 2/KartKraft UDP, and OutGauge.
