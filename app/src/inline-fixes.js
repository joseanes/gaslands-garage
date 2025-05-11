// Add this script to fix input heights across the app
// This runs after DOM is loaded to enforce height constraints

document.addEventListener('DOMContentLoaded', () => {
  // Apply fixed height to all inputs
  const applyHeightFixes = () => {
    // Fix all inputs, selects and buttons
    document.querySelectorAll('input, select, button').forEach(el => {
      el.style.height = '32px';
      el.style.minHeight = '32px';
      el.style.maxHeight = '32px';
    });
    
    // Fix team name and cans specifically
    document.querySelectorAll('input[aria-label="Team Name"], input[aria-label="Maximum Cans"]').forEach(el => {
      el.style.height = '32px';
      el.style.minHeight = '32px';
      el.style.maxHeight = '32px';
      el.style.paddingTop = '0.25rem';
      el.style.paddingBottom = '0.25rem';
      el.style.fontSize = '1rem';
    });
  };
  
  // Apply fixes on load
  applyHeightFixes();
  
  // Apply again after a small delay (for dynamic content)
  setTimeout(applyHeightFixes, 500);
  
  // Apply whenever modals are opened
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        applyHeightFixes();
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
});