<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AdUnit from '$lib/components/AdUnit.svelte';
  
  // We'll no longer auto-redirect
  onMount(() => {
    // You can still add any initialization code here
  });
  
  function goToBuilder() {
    goto('/builder');
  }
</script>

<svelte:head>
  <title>Gaslands Garage - Build Your Team</title>
  <meta name="description" content="Build your Gaslands team with the Gaslands Garage app. Create, share and optimize your wasteland crew!" />
</svelte:head>

<nav class="py-2 px-4 flex justify-between items-center">
  <div class="text-xl font-bold">
    <span class="text-amber-500">Gaslands</span> Garage
  </div>
  <div>
    <button 
      class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-md transition-colors"
      on:click={goToBuilder}
    >
      Open Builder
    </button>
  </div>
</nav>

<div class="py-8 md:py-12 px-4">
  <div class="text-center max-w-2xl mx-auto">
    <h1 class="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 text-stone-800">
      Gaslands Garage
    </h1>
    <p class="text-lg md:text-xl mb-8 text-stone-600">
      The ultimate team builder for Gaslands tabletop game
    </p>
    <button 
      class="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-lg transition-colors text-lg"
      on:click={goToBuilder}
    >
      Build Your Team
    </button>
  </div>
  
  <div class="mt-12 md:mt-16 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
    <div class="bg-white p-6 rounded-lg shadow-md text-center">
      <h2 class="text-xl font-bold mb-3 text-stone-800">Create</h2>
      <p class="text-stone-600">
        Design your perfect Gaslands team with all weapons, upgrades, and sponsor perks.
      </p>
    </div>
    <div class="bg-white p-6 rounded-lg shadow-md text-center">
      <h2 class="text-xl font-bold mb-3 text-stone-800">Share</h2>
      <p class="text-stone-600">
        Generate QR codes, links, or export your team to share with friends.
      </p>
    </div>
    <div class="bg-white p-6 rounded-lg shadow-md text-center">
      <h2 class="text-xl font-bold mb-3 text-stone-800">Print</h2>
      <p class="text-stone-600">
        Print vehicle cards for your games with all the information you need.
      </p>
    </div>
  </div>
  
  <div class="mt-12 md:mt-16 max-w-5xl mx-auto bg-white p-6 rounded-lg shadow-md">
    <h2 class="text-2xl font-bold mb-4 text-stone-800">About Gaslands Garage</h2>
    <p class="text-stone-600 mb-4">
      Gaslands Garage is a free tool for building and managing your Gaslands teams. 
      The app includes all the official rules, vehicle types, weapons, upgrades, and sponsor perks.
    </p>
    <p class="text-stone-600 mb-4">
      Features:
    </p>
    <ul class="list-disc pl-6 mb-4 text-stone-600">
      <li>Build teams with any combination of vehicles, weapons, and upgrades</li>
      <li>Validation ensures your team follows Gaslands rules</li>
      <li>Save teams to your account for easy access</li>
      <li>Share your builds with QR codes</li>
      <li>Print vehicle cards for your games</li>
      <li>Dark mode support</li>
    </ul>
    <div class="text-center mt-8">
      <button 
        class="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-lg transition-colors text-lg"
        on:click={goToBuilder}
      >
        Start Building
      </button>
    </div>
  </div>
  
  <!-- Possible section for mobile ads -->
  <div class="md:hidden mt-8 mx-auto">
    <AdUnit type="mobile" width="100%" height="250px" />
  </div>
</div>

<style>
  /* Add any specific home page styles here */
</style>
