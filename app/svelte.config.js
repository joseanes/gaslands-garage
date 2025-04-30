import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      // 👇 any path that isn’t found in S3 will serve this file
      fallback: 'index.html'
    })
  }
};


