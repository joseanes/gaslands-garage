<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  // Redirect to builder page on mount
  onMount(() => {
    goto('/builder');
  });
</script>

<div class="loading">
  Loading Gaslands Garage...
</div>

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.25rem;
    color: #666;
  }
</style>
