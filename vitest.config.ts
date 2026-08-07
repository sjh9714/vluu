import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  test: {
    // 순수 로직만 테스트한다. DOM이 필요한 건 Playwright가 실제 브라우저에서 본다.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
