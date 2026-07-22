import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'analyze' &&
      visualizer({
        brotliSize: true,
        filename: 'dist/bundle-stats.html',
        gzipSize: true,
        template: 'treemap',
      }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/analytics'],
          scene: ['@react-three/drei', '@react-three/fiber', 'three'],
        },
      },
    },
  },
}));
