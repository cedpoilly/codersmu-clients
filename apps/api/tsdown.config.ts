import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  shims: false,
  sourcemap: false,
})
