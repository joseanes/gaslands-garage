<!-- app/src/routes/+layout.svelte -->
<script lang="ts">
  /*  Import the global Tailwind stylesheet once  */
  import "../app.css";
  import "../dark-mode.css";
  import { onMount } from 'svelte';
  import AdUnit from '$lib/components/AdUnit.svelte';
  
  // Ad configuration variables
  let showAds = true; // Could be controlled by user preference or subscription status
  
  onMount(() => {
    // Check for dark mode preference in localStorage
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    }
    
    // You could potentially load ad preferences here too
    // const adsDisabled = localStorage.getItem('adsDisabled') === 'true';
    // showAds = !adsDisabled;
  });
</script>

<!-- Main layout with ad space -->
<div class="app-container min-h-screen flex flex-col">
  <!-- Top Navigation Bar -->
  <header class="top-nav w-full bg-black text-white print:hidden">
    <div class="max-w-7xl mx-auto">
      <!-- Navigation will be included directly in each page -->
    </div>
  </header>
  
  <!-- Ad banner slot (for future placement of banner ads) -->
  {#if showAds}
  <div class="ad-banner w-full bg-gray-100 dark:bg-gray-900 hidden md:block print:hidden">
    <div class="max-w-7xl mx-auto py-2 px-4">
      <AdUnit type="banner" width="100%" height="90px" />
    </div>
  </div>
  {/if}

  <!-- Content area with sidebar ad -->
  <div class="flex-1 flex flex-col md:flex-row">
    <!-- Main content area (3/4 width on larger screens) -->
    <main class="flex-1 w-full md:w-3/4">
      <slot />
    </main>

    <!-- Ad sidebar (1/4 width on larger screens) -->
    {#if showAds}
    <aside class="w-full md:w-1/4 bg-gray-100 dark:bg-gray-900 p-4 print:hidden">
      <div class="sticky top-24">
        <!-- Main sidebar ad -->
        <AdUnit type="sidebar" width="100%" height="600px" />
        
        <!-- Additional smaller ad units could be placed here -->
        <AdUnit type="sidebar" width="100%" height="250px" />
      </div>
    </aside>
    {/if}
  </div>
</div>

