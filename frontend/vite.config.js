import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = new URL(env.VITE_API_URL || "http://localhost:8000/api")
    .origin;

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("/react-router") || id.includes("/@remix-run/")) {
              return "router";
            }
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/")
            ) {
              return "react";
            }
            if (id.includes("/axios/")) return "axios";
            if (id.includes("/lucide-react/")) return "icons";

            return "vendor";
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: ["futures-equipped-fence-north.trycloudflare.com"],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
