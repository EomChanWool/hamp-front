import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src') },
        { find: '@assets', replacement: resolve(__dirname, 'src/assets') },
        { find: '@components', replacement: resolve(__dirname, 'src/components') },
        { find: '@pages', replacement: resolve(__dirname, 'src/pages') },
      ],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      ...(env.VITE_BACKEND
        ? {
            proxy: {
              '/api': {
                target: env.VITE_BACKEND,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  }
})
