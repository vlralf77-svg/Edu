import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 사이트는 /Edu/ 하위 경로로 서빙된다.
  // 로컬·Capacitor 빌드는 루트('/') 기준이므로 GH_PAGES 환경변수로 분기.
  base: process.env.GH_PAGES === 'true' ? '/Edu/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
