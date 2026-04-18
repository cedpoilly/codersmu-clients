import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@codersmu/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
})
