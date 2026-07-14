import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      // multi-page: เกมหลัก + หน้าตอบ QR + ภารกิจ AR บนมือถือ
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        answer: fileURLToPath(new URL('./answer.html', import.meta.url)),
        ar: fileURLToPath(new URL('./ar.html', import.meta.url)),
      },
    },
  },
  server: {
    host: true, // ให้เข้าถึงจากแท็บเล็ตในวง LAN เดียวกันได้
    // vite 5.4.12+ บล็อก Host แปลกปลอม — ต้อง allow โดเมนที่เข้าผ่าน cloudflare tunnel
    // ไม่งั้นเปิดผ่านโดเมนจะขึ้น "Blocked request. This host is not allowed."
    allowedHosts: ['boardgame.itac-huahincity.com'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
