
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [sveltekit(), tailwind()],
  ssr: {
    // List of dependencies to exclude from SSR processing
    noExternal: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore']
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
  }
});

