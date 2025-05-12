
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    // List of dependencies to exclude from SSR processing
    noExternal: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore']
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
  }
  // CSS processing is configured in postcss.config.js
});

