import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// Keep CNAME alive across builds (GitHub Pages custom domain)
function keepCname() {
  return {
    name: 'keep-cname',
    closeBundle() {
      const src = resolve('docs', 'CNAME')
      if (!fs.existsSync(src)) fs.writeFileSync(src, 'casetake.picnicpeaks.com\n')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), keepCname()],
  build: {
    outDir: 'docs',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
