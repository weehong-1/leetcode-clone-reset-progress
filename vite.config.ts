import { devtools } from "@tanstack/devtools-vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";

// This config lives at the repo root, so `import.meta.dirname` is the repo root.
// The frontend itself lives in `client/`, which we set as the Vite root below.
const rootDir = import.meta.dirname;

// https://vitejs.dev/config/
export default defineConfig({
	root: path.resolve(rootDir, "client"),
	plugins: [
		// Must be the first plugin so it can inject `data-tsd-source`
		// attributes for the devtools Source Inspector ("open in editor").
		// Production exclusion is handled by our `isProduction` + lazy-load
		// wrapper, so the plugin's own build-time removal is disabled.
		devtools({ removeDevtoolsOnBuild: false }),
		react(),
		tailwindcss(),
		// Paths are relative to the Vite root (`client/`).
		TanStackRouterVite({
			routesDirectory: "./src/routes",
			generatedRouteTree: "./src/routeTree.gen.ts",
		}),
		viteStaticCopy({
			targets: [
				{
					src: normalizePath(
						path.resolve(rootDir, "client/src/assets/locales")
					),
					// Relative dest lands inside `outDir`; copying the `locales`
					// directory yields `dist/locales/...` for i18next-http-backend.
					dest: ".",
				},
			],
		}),
	],
	resolve: {
		alias: {
			"@": normalizePath(path.resolve(rootDir, "client/src")),
			"@shared": normalizePath(path.resolve(rootDir, "shared/src")),
		},
	},
	build: {
		// Relative to root (`client/`) -> emits to repo-root `dist/` (Dockerfile).
		outDir: "../dist",
		// Required: Vite will not empty an outDir located outside the root.
		emptyOutDir: true,
	},
	publicDir: "public",
	optimizeDeps: {
		// Pre-bundle the editor so Monaco's deep ESM imports don't trigger a
		// slow first dev load / full reload.
		include: ["@monaco-editor/react"],
	},
	server: {
		host: true,
		strictPort: true,
		// Forward API calls to the Express backend so the frontend stays
		// origin-agnostic (`/api/...`) in dev and in the Docker prod build.
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
			},
		},
	},
	test: {
		// Two projects: the React frontend (jsdom) and the Express backend
		// (node). `extends: true` inherits the plugins + path aliases above.
		projects: [
			{
				extends: true,
				test: {
					name: "client",
					root: path.resolve(rootDir, "client"),
					environment: "jsdom",
					// Relative to the project root (`client/`).
					setupFiles: ["./vitest.setup.ts"],
					css: true,
				},
			},
			{
				// No `extends`: the backend tests need neither the React/router
				// plugins nor jsdom, and inheriting the router plugin would make it
				// hunt for routes under `server/`.
				test: {
					name: "server",
					root: path.resolve(rootDir, "server"),
					environment: "node",
				},
			},
		],
	},
});
