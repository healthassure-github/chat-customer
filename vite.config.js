import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      name: "HaChatCustomer",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
      cssFileName: "styles",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "firebase",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/database",
        "firebase/storage",
      ],
    },
  },
});
