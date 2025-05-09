<!-- app/src/routes/+layout.svelte -->
<script lang="ts">
  /*  Import the global Tailwind stylesheet once  */
  import "../app.css";
  import "../dark-mode.css";
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import AdUnit from '$lib/components/AdUnit.svelte';
  import Auth from '$lib/components/Auth.svelte';
  import TeamsModal from '$lib/components/TeamsModal.svelte';
  import { user } from '$lib/firebase';
  
  // Ad configuration variables
  let showAds = false; // Removed ads for now
  
  // Menu state
  let showShareMenu = false;
  let showTeamsModal = false;
  let showAboutModal = false;
  
  // Hook for My Teams functionality
  function openTeamsModal() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's teams modal function
      if (typeof window.openTeamsModalFn === 'function') {
        window.openTeamsModalFn();
      }
    } else {
      alert('Team management requires the builder page. Please use on the builder page.');
    }
  }
  
  // Add click outside handler for the share menu
  onMount(() => {
    // Check for dark mode preference in localStorage
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    }
    
    // You could potentially load ad preferences here too
    // const adsDisabled = localStorage.getItem('adsDisabled') === 'true';
    // showAds = !adsDisabled;
    
    const handleClickOutside = (event) => {
      const shareMenuButton = document.querySelector('.share-menu-trigger');
      const shareMenu = document.querySelector('.share-menu-dropdown');
      
      if (showShareMenu && 
        shareMenuButton && 
        shareMenu && 
        !shareMenuButton.contains(event.target) && 
        !shareMenu.contains(event.target)) {
        showShareMenu = false;
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
  
  // Menu actions
  // Menu actions for non-builder routes
  // These functions check if we're on the builder page before performing actions
  function copyDraft() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's copyDraft function
      if (typeof window.copyDraftFn === 'function') {
        window.copyDraftFn();
      }
    } else {
      alert('This feature requires team data. Please use on the builder page.');
    }
  }
  
  function shareLink() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's shareLink function
      if (typeof window.shareLinkFn === 'function') {
        window.shareLinkFn();
      }
    } else {
      alert('This feature requires team data. Please use on the builder page.');
    }
  }
  
  function generateQRCode() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's generateQRCode function
      if (typeof window.generateQRCodeFn === 'function') {
        window.generateQRCodeFn();
      }
    } else {
      alert('This feature requires team data. Please use on the builder page.');
    }
  }
  
  function importBuild() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's importBuild function
      if (typeof window.importBuildFn === 'function') {
        window.importBuildFn();
      }
    } else {
      alert('This feature requires team data. Please use on the builder page.');
    }
  }
  
  function printTeam() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's printTeam function
      if (typeof window.printTeamFn === 'function') {
        window.printTeamFn();
      }
    } else {
      alert('This feature requires team data. Please use on the builder page.');
    }
  }
  
  function openSettings() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Forward to builder's openSettings function
      if (typeof window.openSettingsFn === 'function') {
        window.openSettingsFn();
      }
    } else {
      alert('This feature requires team data. Please use on the builder page.');
    }
  }
  
  function openAbout() {
    showAboutModal = true;
  }
</script>

<!-- Main layout with ad space -->
<div class="app-container min-h-screen flex flex-col">
  <!-- Top Navigation Bar -->
  <header class="w-full print:hidden">
    <nav class="menu-bar print:hidden">
      <div class="menu-container">
        <span class="logo">
          <span class="logo-highlight">Gaslands</span> Garage
        </span>
        
        <div class="flex flex-wrap items-center" style="gap: 16px;">
          <button 
            type="button" 
            class="menu-item flex items-center share-menu-trigger" 
            on:click={() => showShareMenu = !showShareMenu}
            aria-haspopup="true"
            aria-expanded={showShareMenu}
          >
            Share Team
            <svg class="ml-1 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
          </button>
          
          {#if showShareMenu}
          <div 
            class="fixed md:absolute inset-0 md:inset-auto md:left-0 md:mt-3 w-full md:w-96 bg-black/90 md:bg-black border-0 md:border-2 border-amber-500 shadow-xl rounded-lg overflow-hidden z-20 py-6 md:py-4 share-menu-dropdown" 
            style="box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);"
            transition:fade={{ duration: 150 }}
          >
            <div class="max-w-md mx-auto px-6 md:px-4">
              <h3 class="text-white text-xl font-bold mb-4 flex items-center justify-between">
                Share Your Team
                <button 
                  class="text-gray-400 hover:text-white md:hidden" 
                  on:click={() => showShareMenu = false}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </h3>
              
              <div class="space-y-3">
                <div class="sharing-option bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  <button type="button" class="w-full p-3 flex items-center text-left" on:click={() => { copyDraft(); showShareMenu = false; }}>
                    <div class="share-icon text-xl bg-amber-600 h-10 w-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <span>📋</span>
                    </div>
                    <div class="share-details">
                      <h4 class="text-white font-medium">Copy Team Code</h4>
                      <p class="text-gray-400 text-sm">Copy an encoded version to your clipboard</p>
                    </div>
                  </button>
                </div>
                
                <div class="sharing-option bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  <button type="button" class="w-full p-3 flex items-center text-left" on:click={() => { shareLink(); showShareMenu = false; }}>
                    <div class="share-icon text-xl bg-blue-600 h-10 w-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <span>🔗</span>
                    </div>
                    <div class="share-details">
                      <h4 class="text-white font-medium">Share Link</h4>
                      <p class="text-gray-400 text-sm">Update URL with shareable link</p>
                    </div>
                  </button>
                </div>
                
                <div class="sharing-option bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  <button type="button" class="w-full p-3 flex items-center text-left" on:click={() => { generateQRCode(); showShareMenu = false; }}>
                    <div class="share-icon text-xl bg-green-600 h-10 w-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <span>📱</span>
                    </div>
                    <div class="share-details">
                      <h4 class="text-white font-medium">Generate QR Code</h4>
                      <p class="text-gray-400 text-sm">Create a QR code for easy sharing</p>
                    </div>
                  </button>
                </div>
                
                <div class="sharing-option bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  <button type="button" class="w-full p-3 flex items-center text-left" on:click={() => { importBuild(); showShareMenu = false; }}>
                    <div class="share-icon text-xl bg-purple-600 h-10 w-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <span>📥</span>
                    </div>
                    <div class="share-details">
                      <h4 class="text-white font-medium">Import Build</h4>
                      <p class="text-gray-400 text-sm">Load a team from a code</p>
                    </div>
                  </button>
                </div>
                
                <div class="sharing-option bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  <button type="button" class="w-full p-3 flex items-center text-left" on:click={() => { printTeam(); showShareMenu = false; }}>
                    <div class="share-icon text-xl bg-red-600 h-10 w-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <span>🖨️</span>
                    </div>
                    <div class="share-details">
                      <h4 class="text-white font-medium">Print Team</h4>
                      <p class="text-gray-400 text-sm">Print vehicle dashboards for gameplay</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/if}
          <button type="button" class="menu-item" on:click={printTeam}>Print Team</button>
          {#if $user}
          <button type="button" class="menu-item" on:click={openTeamsModal}>My Teams</button>
          {/if}
          <button type="button" class="menu-item" on:click={openSettings}>Settings</button>
          <button type="button" class="menu-item" on:click={openAbout}>About</button>
          <Auth />
        </div>
      </div>
    </nav>
  </header>
  
  <!-- Ad banner slot removed -->

  <!-- Content area without sidebar ad -->
  <div class="flex-1">
    <!-- Main content area (full width) -->
    <main class="w-full max-w-7xl mx-auto">
      <slot />
    </main>
  </div>
  
  <!-- Teams Modal is handled by the builder page now -->
  
  <!-- About Modal -->
  {#if showAboutModal}
    <div
      class="fixed inset-0 bg-black/90 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="About Gaslands Garage"
      tabindex="-1"
      transition:fade={{ duration: 150 }}
    >
      <!-- Background overlay -->
      <button
        class="absolute inset-0 w-full h-full border-0 dark:bg-gray-800  cursor-pointer"
        on:click={() => showAboutModal = false}
        on:keydown={e => e.key === 'Escape' && (showAboutModal = false)}
        aria-label="Close modal background"
      ></button>
      
      <!-- Modal content -->
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-10 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
        role="document"
        style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
      >
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-stone-800 dark:text-white">About Gaslands Garage</h3>
          <button
            class="text-stone-400 hover:text-stone-600 dark:text-gray-300 dark:hover:text-white transition-colors"
            on:click={() => showAboutModal = false}
            aria-label="Close about modal"
          >
            <span class="text-2xl">×</span>
            <span class="sr-only">Close</span>
          </button>
        </div>
        
        <div class="space-y-6 text-stone-700 dark:text-gray-200">
          <p>
            Gaslands Garage is a free tool for building and managing your Gaslands teams. The app includes all the official rules, vehicle types, weapons, upgrades, and sponsor perks.
          </p>
          
          <div>
            <h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">Features:</h4>
            <ul class="list-disc pl-6 space-y-2">
              <li>Build teams with any combination of vehicles, weapons, and upgrades</li>
              <li>Validation ensures your team follows Gaslands rules</li>
              <li>Save teams to your account for easy access</li>
              <li>Share your builds with QR codes</li>
              <li>Print vehicle cards for your games</li>
              <li>Dark mode support</li>
            </ul>
          </div>
          
          <div class="border-t border-stone-200 dark:border-gray-700 pt-4 mt-4">
            <p class="italic text-stone-600 dark:text-gray-400">
              This is an unofficial fan-made tool. The Gaslands game is © 2017 Mike Hutchinson and this application is done under the Friends of Gaslands program. The Application Copyright © 2025 Anes & Rincon LLC d.b.a. FunBoardGames.Etsy.com.
            </p>
            
            <div class="mt-4">
              <h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">Gaslands Garage</h4>
              <p class="mb-2">The ultimate team builder for Gaslands tabletop game</p>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <h5 class="font-semibold">Create</h5>
                  <p class="text-sm">Design your perfect Gaslands team with all weapons, upgrades, and sponsor perks.</p>
                </div>
                <div>
                  <h5 class="font-semibold">Share</h5>
                  <p class="text-sm">Generate QR codes, links, or export your team to share with friends.</p>
                </div>
                <div>
                  <h5 class="font-semibold">Print</h5>
                  <p class="text-sm">Print vehicle cards for your games with all the information you need.</p>
                </div>
                    <!-- Friends of Gaslands Banner -->
    <div class="mt-10 p-4 bg-amber-100 dark:bg-amber-900 rounded-lg text-center">
      <h2 class="text-lg font-bold text-amber-800 dark:text-amber-100">Friends of Gaslands</h2>
      <p class="text-amber-700 dark:text-amber-200 mt-2">
        This is an unofficial fan-made tool. Gaslands is © 2017 Mike Hutchinson.
      </p>
      <p class="text-amber-600 dark:text-amber-300 mt-1 text-sm">
        <a href="https://gaslands.com" target="_blank" rel="noopener noreferrer" class="underline hover:text-amber-800 dark:hover:text-amber-100">Visit the official Gaslands website</a>
      </p>
    </div>
              </div>
            </div>
            <p class="mt-4">
              <a href="https://gaslands.com" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 underline">Visit the official Gaslands website</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
/* Menu styles */
.menu-bar {
  background-color: #000000;
  color: white;
  padding: 12px 0;
  margin-bottom: 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.menu-container {
  max-width: 896px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 16px;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-weight: bold;
  font-size: 1.125rem;
  padding: 0.5rem 0;
}

.logo-highlight {
  color: #f59e0b;
}

.menu-item {
  color: white;
  background: transparent;
  border: none;
  padding: 8px 12px;
  margin: 0;
  cursor: pointer;
  font: inherit;
  border-radius: 4px;
}

.menu-item:hover {
  color: #fcd34d;
  background-color: rgba(255, 255, 255, 0.1);
}
</style>

