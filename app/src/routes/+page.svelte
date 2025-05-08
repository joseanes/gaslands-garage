<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  // Auto-redirect to builder
  onMount(() => {
    goto('/builder');
  });
</script>

<!-- Simple loading/redirecting message -->
<div class="flex items-center justify-center h-screen">
  <div class="text-center">
    <h1 class="text-xl font-bold mb-4">
      <span class="text-amber-500">Redirecting to Gaslands Garage...</span>
    </h1>
    <div class="inline-block w-8 h-8 border-4 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
  </div>
</div>
