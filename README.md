# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS


## End-user Windows bridge

Normal users do **not** need Node.js, npm, Git Bash, Visual Studio, or C++ build tools. The repository builds a portable `TouchToSteer-Bridge.exe` automatically on pushes to `main` and publishes the current Windows build as the `bridge-latest` GitHub release.

Run the EXE on the Windows gaming PC. On first run it can launch the bundled official ViGEmBus installer, then restart the bridge. The bridge prints the local `ws://<PC-IP>:8787` address to use from the phone.

## Universal controller compatibility

TouchToSteer can expose **Universal · XInput + DirectInput** mode. The bridge creates a synchronized Xbox 360/XInput target for modern XInput games and a DualShock/HID target for older DirectInput-style games. This is intended to cover a wider range of Windows games without changing the phone controls.

Windows will show the two virtual targets separately in `joy.cpl` in Universal mode. Use **XInput / Xbox 360** when a game specifically requires a single `Controller (XBOX 360 For Windows)` device.

GTA San Andreas classic is a legacy compatibility case: its controller behavior differs across PC releases, and the classic/older releases use DirectInput-style paths while later digital releases have differing XInput support. TouchToSteer's Universal mode supplies both device classes; game-specific compatibility software can still be necessary for titles with their own incompatible controller implementation.

