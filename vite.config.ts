import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/client",
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (
            normalizedId.includes("/three/examples/jsm/postprocessing/") ||
            normalizedId.includes("/three/examples/jsm/shaders/")
          ) {
            return "three-postprocessing";
          }
          if (normalizedId.includes("/three/examples/jsm/controls/")) {
            return "three-controls";
          }
          if (normalizedId.includes("/three/")) {
            return "three-core";
          }
        },
      },
    },
  },
});
