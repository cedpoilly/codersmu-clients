import { createRequire } from 'node:module'

import { defineConfig } from 'tsdown'

const require = createRequire(import.meta.url)
const { version } = require('./package.json') as { version: string }

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  shims: false,
  sourcemap: false,
  define: {
    __API_VERSION__: JSON.stringify(version),
  },
})
