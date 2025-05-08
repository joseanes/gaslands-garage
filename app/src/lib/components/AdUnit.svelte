<script lang="ts">
  export let type: 'sidebar' | 'banner' | 'mobile' = 'sidebar';
  export let adCode: string = '';  // This would be actual ad code from your provider
  export let width: string = 'auto';
  export let height: string = 'auto';
  export let placeholder: boolean = true;  // Show placeholder when real ad not available
  
  // Ad customization options
  export let bgColor: string = 'bg-gray-100 dark:bg-gray-900';
  export let borderColor: string = 'border-gray-200 dark:border-gray-700';
</script>

{#if adCode}
  <!-- Real ad container -->
  <div class="ad-container {bgColor} rounded-lg overflow-hidden shadow-sm border {borderColor} mb-4" 
       style="width: {width}; height: {height};">
    <!-- This is where the real ad code would be injected -->
    {@html adCode}
  </div>
{:else if placeholder}
  <!-- Placeholder ad for development -->
  <div class="ad-placeholder {bgColor} rounded-lg overflow-hidden shadow-sm border {borderColor} mb-4"
       style="width: {width}; height: {height};">
    <div class="w-full h-full flex flex-col items-center justify-center p-4 text-center">
      {#if type === 'sidebar'}
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">ADVERTISEMENT</p>
        <div class="border border-dashed border-gray-300 dark:border-gray-600 rounded w-full flex-1 flex items-center justify-center">
          <span class="text-sm text-gray-400">Ad Space ({width}x{height})</span>
        </div>
        <p class="text-gray-400 text-xs mt-2">Support Gaslands Garage</p>
      {:else if type === 'banner'}
        <div class="flex items-center justify-center h-full">
          <span class="text-sm text-gray-400">Banner Ad • {width}x{height}</span>
        </div>
      {:else}
        <div class="flex items-center justify-center h-full">
          <span class="text-sm text-gray-400">Mobile Ad • {width}x{height}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* These styles ensure ads don't break layout */
  .ad-container, .ad-placeholder {
    max-width: 100%;
    overflow: hidden;
  }
  
  /* Style for real ad iframe if your ad provider uses them */
  .ad-container :global(iframe) {
    width: 100%;
    height: 100%;
    border: 0;
  }
</style>