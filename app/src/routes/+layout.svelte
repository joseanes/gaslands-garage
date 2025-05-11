<!-- app/src/routes/+layout.svelte -->
<script lang="ts">
  /*  Import the global Tailwind stylesheet once  */
  import "../app.css";
  import "../dark-mode.css";
  import "../form-styles.css";
  import "../dark-override.css"; /* This must be imported last to override other styles */
  import "../inline-fixes.js"; /* JavaScript fixes for element heights */
  /* Print styles now included directly in this file */
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
  let showHelpMenu = false;
  let showTeamsModal = false;
  let showAboutModal = false;
  let showAboutGaslandsModal = false;
  let showChangeLogModal = false;
  let showUpcomingFeaturesModal = false;
  let showContributorsModal = false;
  
  // Hook for My Teams functionality
  function openTeamsModal() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/builder')) {
      // Directly open the Teams modal in the layout
      showTeamsModal = true;
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
      document.documentElement.classList.add('dark');
    }

    // You could potentially load ad preferences here too
    // const adsDisabled = localStorage.getItem('adsDisabled') === 'true';
    // showAds = !adsDisabled;

    const handleClickOutside = (event) => {
      // Handle Share menu clicks outside
      const shareMenuButton = document.querySelector('.share-menu-trigger');
      const shareMenu = document.querySelector('.share-menu-dropdown');

      if (showShareMenu &&
        shareMenuButton &&
        shareMenu &&
        !shareMenuButton.contains(event.target) &&
        !shareMenu.contains(event.target)) {
        showShareMenu = false;
      }

      // Handle Help menu clicks outside
      const helpMenuButton = document.querySelector('.help-menu-trigger');
      const helpMenu = document.querySelector('.help-menu-dropdown');

      if (showHelpMenu &&
        helpMenuButton &&
        helpMenu &&
        !helpMenuButton.contains(event.target) &&
        !helpMenu.contains(event.target)) {
        showHelpMenu = false;
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
  
  // Help menu functions
  function openAbout() {
    showAboutModal = true;
  }

  function openAboutGaslands() {
    showAboutGaslandsModal = true;
  }

  function openChangeLog() {
    showChangeLogModal = true;
  }

  function openUpcomingFeatures() {
    showUpcomingFeaturesModal = true;
  }

  function openContributors() {
    showContributorsModal = true;
  }
</script>

<!-- Main layout with ad space -->
<div class="app-container min-h-screen flex flex-col">
  <!-- Top Navigation Bar -->
  <header class="w-full print:hidden">
    <nav class="menu-bar print:hidden">
      <div class="menu-container">
        <div class="flex flex-col">
          <span class="logo">
            <span class="logo-highlight">Gaslands</span> Garage
          </span>
          <span class="logo-sponsor">
            by <a href="https://funboardgames.etsy.com/" target="_blank" rel="noopener noreferrer" class="etsy-link">Fun Board Games</a>
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-end" style="gap: 10px;">
          <button
            type="button"
            class="menu-item flex items-center share-menu-trigger"
            on:click={() => showShareMenu = !showShareMenu}
            aria-haspopup="true"
            aria-expanded={showShareMenu}
            style="height: auto !important; min-height: auto !important;"
          >
            Teams
            <svg class="ml-1 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
            </svg>
          </button>
          
          {#if showShareMenu}
          <div
            class="absolute left-0 w-44 bg-black border-2 border-amber-500 shadow-xl rounded-lg overflow-hidden z-20 py-2 share-menu-dropdown"
            style="box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); background-color: #000000 !important; top: 40px;"
            transition:fade={{ duration: 150 }}
          >
            <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { openTeamsModal(); showShareMenu = false; }}>
              Save/Load Team
            </button>
            <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { printTeam(); showShareMenu = false; }}>
              Print Team
            </button>
            <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { copyDraft(); showShareMenu = false; }}>
              Copy to Clipboard
            </button>
            <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { shareLink(); showShareMenu = false; }}>
              Share Link
            </button>
            <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { generateQRCode(); showShareMenu = false; }}>
              Generate QR Code
            </button>
            <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { importBuild(); showShareMenu = false; }}>
              Import Build
            </button>
          </div>
          {/if}
          <button type="button" class="menu-item" on:click={openSettings} style="height: auto !important; min-height: auto !important;">Settings</button>
          <div class="relative inline-block ml-1">
            <button
              type="button"
              class="menu-item flex items-center help-menu-trigger"
              on:click={() => showHelpMenu = !showHelpMenu}
              aria-haspopup="true"
              aria-expanded={showHelpMenu}
              style="height: auto !important; min-height: auto !important;"
            >
              Help
              <svg class="ml-1 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>

            {#if showHelpMenu}
            <div
              class="absolute right-0 w-56 bg-black border-2 border-amber-500 shadow-xl rounded-lg overflow-hidden z-20 py-2 help-menu-dropdown"
              style="box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); background-color: #000000 !important; top: 40px;"
              transition:fade={{ duration: 150 }}
            >
              <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { openAbout(); showHelpMenu = false; }}>
                About Gaslands Garage
              </button>
              <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { openAboutGaslands(); showHelpMenu = false; }}>
                About Gaslands
              </button>
              <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { openChangeLog(); showHelpMenu = false; }}>
                Change Log
              </button>
              <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { openUpcomingFeatures(); showHelpMenu = false; }}>
                Upcoming Features
              </button>
              <button type="button" class="menu-item w-full text-left px-4 py-2 text-white hover:bg-amber-600" on:click={() => { openContributors(); showHelpMenu = false; }}>
                Contributors
              </button>
            </div>
            {/if}
          </div>
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
</div>

<!-- About Modal -->
{#if showAboutModal}
  <div
    class="fixed inset-0 bg-black z-50"
    role="dialog"
    aria-modal="true"
    aria-label="About Gaslands Garage"
    tabindex="-1"
    transition:fade={{ duration: 150 }}
  >
    <!-- Background overlay -->
    <button
      class="absolute inset-0 w-full h-full border-0 cursor-pointer"
      on:click={() => showAboutModal = false}
      on:keydown={e => e.key === 'Escape' && (showAboutModal = false)}
      aria-label="Close modal background"
    ></button>
    
    <!-- Modal content -->
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
      role="document"
      style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: var(--modal-bg-color, white); padding: 1.5rem;"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-stone-800 dark:text-white modal-heading">About Gaslands Garage</h3>
        <button
          class="py-0.25 px-2 h-[2rem] flex items-center justify-center rounded transition-colors text-sm amber-button"
          on:click={() => showAboutModal = false}
          aria-label="Close about modal"
        >
          <span>Close</span>
        </button>
      </div>
      
      <div class="space-y-6 text-stone-700 dark:text-gray-200 modal-text">
        <p>
          Gaslands Garage is a free tool for building and managing your Gaslands teams. The app includes all the official rules, vehicle types, weapons, upgrades, and sponsor perks.
        </p>
        
        <div class="px-4">
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

          <p class="italic text-stone-600 dark:text-gray-400 mt-2">
            This work is licensed under a <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Creative Commons Attribution-NonCommercial 4.0 International License</a>. You are free to share and adapt this work for non-commercial purposes, provided you give appropriate credit.
          </p>

          <p class="text-stone-600 dark:text-gray-400 mt-2">
            This project is open source! Check out the <a href="https://github.com/joseanes/gaslands-garage" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">GitHub repository</a> to contribute or report issues.
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
            </div>
            
            <!-- Friends of Gaslands Banner -->
            <div class="mt-10 p-4 bg-amber-100 dark:bg-amber-900 rounded-lg text-center">
              <h2 class="text-lg font-bold text-amber-800 dark:text-amber-100">Friends of Gaslands</h2>
              <div class="flex justify-center my-4">
                <img src="/images/friend-of-gaslands.webp" alt="Friend of Gaslands Logo" class="h-24" />
              </div>
              <p class="text-amber-700 dark:text-amber-200 mt-2">
                This is an unofficial fan-made tool. Gaslands is © 2017 Mike Hutchinson.
              </p>
              <p class="text-amber-600 dark:text-amber-300 mt-1 text-sm">
                <a href="https://gaslands.com" target="_blank" rel="noopener noreferrer" class="underline hover:text-amber-800 dark:hover:text-amber-100">Visit the official Gaslands website</a>
              </p>
              <div class="mt-3 flex justify-center">
                <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer">
                  <img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/png/by-nc.png" alt="Creative Commons BY-NC License" class="h-8" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Change Log Modal -->
{#if showChangeLogModal}
  <div
    class="fixed inset-0 bg-black z-50"
    role="dialog"
    aria-modal="true"
    aria-label="Change Log"
    tabindex="-1"
    transition:fade={{ duration: 150 }}
  >
    <!-- Background overlay -->
    <button
      class="absolute inset-0 w-full h-full border-0 cursor-pointer"
      on:click={() => showChangeLogModal = false}
      on:keydown={e => e.key === 'Escape' && (showChangeLogModal = false)}
      aria-label="Close modal background"
    ></button>

    <!-- Modal content -->
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
      role="document"
      style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: var(--modal-bg-color, white); padding: 1.5rem;"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-stone-800 dark:text-white modal-heading">Change Log</h3>
        <button
          class="py-0.25 px-2 h-[2rem] flex items-center justify-center rounded transition-colors text-sm amber-button"
          on:click={() => showChangeLogModal = false}
          aria-label="Close change log modal"
        >
          <span>Close</span>
        </button>
      </div>

      <div class="space-y-6 text-stone-700 dark:text-gray-200 modal-text">
        <p>
          Below is a history of major updates and improvements to Gaslands Garage.
        </p>

        <div class="space-y-4 px-4">
          <!-- Change log entries will go here -->
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Upcoming Features Modal -->
{#if showUpcomingFeaturesModal}
  <div
    class="fixed inset-0 bg-black z-50"
    role="dialog"
    aria-modal="true"
    aria-label="Upcoming Features"
    tabindex="-1"
    transition:fade={{ duration: 150 }}
  >
    <!-- Background overlay -->
    <button
      class="absolute inset-0 w-full h-full border-0 cursor-pointer"
      on:click={() => showUpcomingFeaturesModal = false}
      on:keydown={e => e.key === 'Escape' && (showUpcomingFeaturesModal = false)}
      aria-label="Close modal background"
    ></button>

    <!-- Modal content -->
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
      role="document"
      style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: var(--modal-bg-color, white); padding: 1.5rem;"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-stone-800 dark:text-white modal-heading">Upcoming Features</h3>
        <button
          class="py-0.25 px-2 h-[2rem] flex items-center justify-center rounded transition-colors text-sm amber-button"
          on:click={() => showUpcomingFeaturesModal = false}
          aria-label="Close upcoming features modal"
        >
          <span>Close</span>
        </button>
      </div>

      <div class="space-y-6 text-stone-700 dark:text-gray-200 modal-text">
        <p>
          Here's what we're working on for future updates to Gaslands Garage:
        </p>
        <ul class="px-4 space-y-2">
          <li>Printing Options</li>
          <li>Apple Login</li>
          <li>Where to purchase accessories</li>
        </ul>

        <div class="space-y-4">
          <!-- Upcoming features list will go here -->
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Contributors Modal -->
{#if showContributorsModal}
  <div
    class="fixed inset-0 bg-black z-50"
    role="dialog"
    aria-modal="true"
    aria-label="Contributors"
    tabindex="-1"
    transition:fade={{ duration: 150 }}
  >
    <!-- Background overlay -->
    <button
      class="absolute inset-0 w-full h-full border-0 cursor-pointer"
      on:click={() => showContributorsModal = false}
      on:keydown={e => e.key === 'Escape' && (showContributorsModal = false)}
      aria-label="Close modal background"
    ></button>

    <!-- Modal content -->
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
      role="document"
      style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: var(--modal-bg-color, white); padding: 1.5rem;"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-stone-800 dark:text-white modal-heading">Contributors</h3>
        <button
          class="py-0.25 px-2 h-[2rem] flex items-center justify-center rounded transition-colors text-sm amber-button"
          on:click={() => showContributorsModal = false}
          aria-label="Close contributors modal"
        >
          <span>Close</span>
        </button>
      </div>

      <div class="space-y-6 text-stone-700 dark:text-gray-200 modal-text">
        <p>
          Gaslands Garage is made possible by the following contributors:
        </p>
        <ul class="px-4 space-y-2">
          <li>Jose Anes, Project creator and <a href="https://FunBoardGames.Etsy.com">Gaslands Purveyor at FunBoardGames.</a></li>
          <li>Luca Vince Caltabiano from <a href="https://www.youtube.com/c/gaslandstv">Gaslands TV</a> for the video content</li>
        </ul>

        <div class="space-y-4">
          <!-- Contributors list will go here -->
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- About Gaslands Modal -->
{#if showAboutGaslandsModal}
  <div
    class="fixed inset-0 bg-black z-50"
    role="dialog"
    aria-modal="true"
    aria-label="About Gaslands"
    tabindex="-1"
    transition:fade={{ duration: 150 }}
  >
    <!-- Background overlay -->
    <button
      class="absolute inset-0 w-full h-full border-0 cursor-pointer"
      on:click={() => showAboutGaslandsModal = false}
      on:keydown={e => e.key === 'Escape' && (showAboutGaslandsModal = false)}
      aria-label="Close modal background"
    ></button>

    <!-- Modal content -->
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
      role="document"
      style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: var(--modal-bg-color, white); padding: 1.5rem;"
    >
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold text-stone-800 dark:text-white modal-heading">About Gaslands</h3>
        <button
          class="py-0.25 px-2 h-[2rem] flex items-center justify-center rounded transition-colors text-sm amber-button"
          on:click={() => showAboutGaslandsModal = false}
          aria-label="Close about gaslands modal"
        >
          <span>Close</span>
        </button>
      </div>

      <div class="space-y-6 text-stone-700 dark:text-gray-200 modal-text">
        <p>
          Gaslands is a tabletop game of post-apocalyptic vehicular combat. Using converted Hot Wheels or Matchbox cars, it simulates a televised bloodsport where drivers compete in a variety of deadly scenarios.  Gaslands puts players in control of custom battle cars, buggies, trucks, and other vehicles armed with machine guns, rockets, flamethrowers and more. Players are encourage to modify readily available Hotwheels or Matchbox vehicles with bits and paint to make them look like a post-apocalyptical combat vehicle.  The game is set in a dystopian future where Earth has been devastated and Mars has been colonized by the wealthy elite. The poor left behind on Earth compete in televised death races for a chance to win citizenship on Mars.
        The game was created by Mike Hutchinson and published by Osprey Games.    To learn more about Gaslands, visit the <a href="https://gaslands.com" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">official Gaslands website</a>.
          
        
        


        <div class="border-t border-stone-200 dark:border-gray-700 pt-4 mt-4 px-4">
          <h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">What You Need to Start Playing:</h4>
          <ul class="list-disc pl-5 space-y-2">
            <li><a href="https://amzn.to/4m7OQYa" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Rulebook</a> - The Gaslands Refuelled rulebook contains all the rules and scenarios</li>
            <li><a href="https://creatoriq.cc/434pUIp" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Dice</a> - Special dice designed for the game</li>
            <li><a href="https://amzn.to/4kaUcA2" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Regular 6-Sided Dice</a> - For resolving various game mechanics</li>
            <li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Templates</a> - Movement templates for driving your vehicles</li>
            <li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Vehicles</a> - Hotwheels or Matchbox cars that you can modify</li>
          </ul>
        </div>


        <div class="border-t border-stone-200 dark:border-gray-700 pt-4 mt-4 px-4">
          <h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">Recommended Resources:</h4>
          <div class="bg-stone-100 dark:bg-gray-700 p-4 rounded-lg">
            <div class="flex items-center gap-3 mb-2">
              <div>
                <center><iframe width="560" height="315" src="https://www.youtube.com/embed/CL66NMhWwHo?si=KltcYCh9RbCqU2HQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                <p class="text-sm">
                  Gaslands TV features game tutorials, battle reports, and showcases of custom Gaslands vehicles. A must-watch resource for beginners and experienced players alike.
                </p></center>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Teams Modal -->
{#if showTeamsModal && typeof window !== 'undefined' && window.location.pathname.includes('/builder')}
  <!-- Log for debugging -->
  {@const draftValue = window.currentDraftFn ? window.currentDraftFn() : null}
  {@const _ = console.log('Opening Teams Modal with draft:', draftValue)}

  <TeamsModal
    bind:showModal={showTeamsModal}
    currentDraft={draftValue}
    importDraft={(draft) => {
      if (typeof window !== 'undefined' && window.importDraftFn && draft) {
        window.importDraftFn(draft);
        console.log('Importing draft in TeamsModal:', draft);
      }
    }}
  />
{/if}

<style>
:root {
  --modal-bg-color: white;
}

.dark, :global(.dark-mode) {
  --modal-bg-color: #1f2937; /* Matches dark:bg-gray-800 */
}

/* Menu styles */
.menu-bar {
  background-color: #000000;
  color: white;
  padding: 8px 0;
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.menu-container {
  max-width: 896px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 0;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-weight: bold;
  font-size: 1.25rem;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.logo-highlight {
  color: #f59e0b;
}

.logo-sponsor {
  font-size: 0.65rem;
  color: #cccccc;
  letter-spacing: 0.02em;
  line-height: 1;
  margin-top: -2px;
}

.etsy-link {
  color: #f59e0b;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.etsy-link:hover {
  color: #fcd34d;
  text-decoration: underline;
}

.menu-item {
  color: white;
  background: transparent;
  border: none;
  padding: 5px 10px;
  margin: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  border-radius: 4px;
}

.menu-item:hover {
  color: #fcd34d;
  background-color: rgba(255, 255, 255, 0.1);
}

/* Print Styles */
@media print {
  /* Important overrides to ensure content is visible */
  @page {
    size: auto;
    margin: 10mm;
  }

  /* Reset all elements to default display */
  body * {
    display: none !important;
  }

  /* Show only the selected format */
  .print-views {
    display: block !important;
    position: static !important;
    left: auto !important;
    visibility: visible !important;
  }

  .print-view {
    display: none !important;
  }

  /* Only show the selected format */
  .print-view[data-format=classic] {
    display: block !important;
  }

  /* Format-specific display rules */
  body[data-print-format=classic] .print-view[data-format=classic],
  body[data-print-format=compact] .print-view[data-format=compact],
  body[data-print-format=dashboard] .print-view[data-format=dashboard],
  body[data-print-format=roster] .print-view[data-format=roster] {
    display: block !important;
  }

  /* Make all content inside the selected view visible */
  body[data-print-format=classic] .print-view[data-format=classic] *,
  body[data-print-format=compact] .print-view[data-format=compact] *,
  body[data-print-format=dashboard] .print-view[data-format=dashboard] *,
  body[data-print-format=roster] .print-view[data-format=roster] * {
    display: revert !important;
    visibility: visible !important;
    color: black !important;
    background-color: white !important;
    opacity: 1 !important;
  }

  /* Exception for backgrounds and colors */
  .card, .vehicle-card {
    background-color: white !important;
    border: 1px solid black !important;
    box-shadow: none !important;
    page-break-inside: avoid !important;
  }

  /* Badge specific colors */
  .vehicle-type-badge {
    color: white !important;
    background-color: #333 !important;
  }

  .card-cost {
    background-color: black !important;
    color: white !important;
  }

  /* Reset dark mode for printing - ALWAYS use light mode */
  html,
  body {
    background-color: white !important;
    color: black !important;
  }
}
</style>