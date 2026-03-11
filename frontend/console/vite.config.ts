import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devPort = Number(env.VITE_DEV_PORT || '3001')
  const proxyTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: {
      port: devPort,
      proxy: {
        '/v1': { target: proxyTarget, changeOrigin: true },
        '/internal': { target: proxyTarget, changeOrigin: true },
        '/api': { target: proxyTarget, changeOrigin: true }
      }
    },
    preview: {
      port: 4173
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return
            }

            if (
              id.includes('/echarts/') ||
              id.includes('/zrender/') ||
              id.includes('echarts-for-react')
            ) {
              return 'vendor-echarts'
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/')
            ) {
              return 'vendor-react'
            }

            if (id.includes('/@tanstack/react-query')) {
              return 'vendor-query'
            }

            if (id.includes('/@radix-ui/')) {
              return 'vendor-radix'
            }

            if (
              id.includes('/react-hook-form/') ||
              id.includes('/zod/') ||
              id.includes('/@hookform/resolvers/')
            ) {
              return 'vendor-forms'
            }
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './vitest.setup.ts',
      css: true,
      exclude: ['e2e/**', 'node_modules/**']
    }
  }
})
