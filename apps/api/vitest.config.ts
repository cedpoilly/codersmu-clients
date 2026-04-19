import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
const { version } = require('./package.json') as { version: string }

export default defineConfig({
  resolve: {
    alias: {
      '@codersmu/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  define: {
    __API_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: 'node',
  },
})
