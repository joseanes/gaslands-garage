<!-- app/src/routes/+layout.svelte -->
<script lang="ts">
  /*  Import the global Tailwind stylesheet once  */
  import "../app.css";
</script>

<!-- Everything in the app will be rendered here -->
<nav class="p-4 bg-gray-800 text-white">
  <a href="/" class="mr-4">Home</a>
  <a href="/builder" class="underline">Team Builder</a>
</nav>
<slot />





