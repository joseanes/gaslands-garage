<!-- app/src/routes/+layout.svelte -->
<script lang="ts">
  /*  Import the global Tailwind stylesheet once  */
  import "../app.css";
  import "../dark-mode.css";
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Check for dark mode preference in localStorage
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    }
  });
</script>

<!-- Everything in the app will be rendered here -->
<slot />

