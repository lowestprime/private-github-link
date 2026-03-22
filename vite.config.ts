import { sentryTanstackStart } from "@sentry/tanstackstart-react";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const selfHosted = process.env.SELF_HOSTED === "true";

const config = defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	build: {
		rollupOptions: {
			external: ["fsevents"],
		},
		sourcemap: false,
	},
	optimizeDeps: {
		exclude: ["fsevents"],
	},
	ssr: {
		noExternal: [],
	},
	plugins: [
		devtools(),
		nitro(),
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		sentryTanstackStart({
			org: "na-dg0",
			project: "private-github-link",
			authToken: process.env.SENTRY_AUTH_TOKEN,
		}),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
	],
	nitro: {
		preset: selfHosted ? "node-server" : "aws-lambda",
		...(selfHosted
			? {}
			: {
					awsLambda: {
						streaming: true,
					},
				}),
		scanDirs: ["server"],
	},
});

export default config;