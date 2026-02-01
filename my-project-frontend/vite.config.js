import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,           // 允許外部連線
    allowedHosts: 'all',  // 允許所有 domain（包含 Railway）
  },
})
