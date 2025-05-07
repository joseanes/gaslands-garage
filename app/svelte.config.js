import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      // Any path that isn't found will serve this file
      fallback: 'index.html'
    }),
    // Ensures the app behaves as a SPA
    paths: {
      base: ''
    }
  }
};