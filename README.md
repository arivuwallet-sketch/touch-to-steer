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
