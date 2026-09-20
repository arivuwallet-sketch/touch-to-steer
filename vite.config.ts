// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * TanStack Devtools injects data-tsd-source attributes into JSX during development.
 * React Three Fiber renders custom JSX elements as THREE objects, so those DOM-only
 * source attributes must be removed from the R3F scene files before Fiber receives them.
 *
 * This keeps the source inspector available elsewhere while preventing the R3F
 * "Cannot set data-tsd-source" runtime crash.
 */
const stripR3FSourceMarkers = () => ({
  name: "strip-r3f-source-markers",
  enforce: "post",
  transform(code: string, id: string) {
    if (!/[\\/]src[\\/]components[\\/]rig3d[\\/].+\\.(tsx|jsx)$/.test(id)) {
      return null;
    }

    const stripped = code.replace(
      /\sdata-tsd-source=(["'])[^"']*\1/g,
      "",
    );

    return stripped === code ? null : { code: stripped, map: null };
  },
});

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts.
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stripR3FSourceMarkers()],
  },
});
