import { defineConfig } from "vite";
import { VitePluginNode } from "vite-plugin-node";

export default defineConfig({
  plugins: [
    ...VitePluginNode({
      adapter: (app: any, req, res) => {
        app(req, res);
      },
      appPath: "./internal/server.ts",
    }),
  ],
});
