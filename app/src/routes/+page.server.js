// This redirects the root (/) to the builder page
export function load({ url }) {
  // Only redirect if we're exactly at the root path
  if (url.pathname === '/') {
    return {
      status: 302,
      redirect: '/builder'
    };
  }
  
  // Otherwise continue with normal page loading
  return {};
}