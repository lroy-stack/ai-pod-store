import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

// Build one widget at a time — set via WIDGET env var
// Usage: WIDGET=product-grid npx vite build
const widget = process.env.WIDGET || 'product-grid'

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist/uis',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, `uis/${widget}/index.html`),
    },
  },
})
