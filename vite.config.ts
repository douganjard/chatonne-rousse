import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

function manualChunks(id: string) {
  if (id.includes('/node_modules/firebase/')) return 'firebase';
  if (
    id.includes('/node_modules/@react-three/drei/') ||
    id.includes('/node_modules/@react-three/fiber/') ||
    id.includes('/node_modules/three/')
  ) {
    return 'scene';
  }
}

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
        manualChunks,
      },
    },
  },
}));
