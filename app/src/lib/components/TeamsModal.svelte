<script lang="ts">
  import { user } from '$lib/firebase';
  import { getUserTeams, saveTeam } from '$lib/services/user';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  
  export let showModal = false;
  export let currentDraft;
  export let importDraft;
  
  let isLoading = false;
  let userTeams = [];
  let newTeamName = '';
  
  // Load user's teams when the modal opens
  $: if (showModal && $user) {
    loadUserTeams();
  }
  
  async function loadUserTeams() {
    if (!$user) return;
    
    isLoading = true;
    const result = await getUserTeams($user.uid);
    isLoading = false;
    
    if (result.success) {
      userTeams = result.teams;
    } else {
      console.error("Failed to load teams");
    }
  }
  
  // Save current team
  async function saveCurrentTeam() {
    if (!$user || !newTeamName.trim()) return;
    
    isLoading = true;
    const result = await saveTeam($user.uid, newTeamName, currentDraft);
    isLoading = false;
    
    if (result.success) {
      newTeamName = '';
      await loadUserTeams(); // Reload teams
    } else {
      console.error("Failed to save team");
    }
  }
  
  // Load selected team
  function loadTeam(team) {
    importDraft(team.draft);
    closeModal();
  }
  
  function closeModal() {
    showModal = false;
  }
</script>

{#if showModal}
<div
  class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
  role="dialog"
  aria-modal="true"
  aria-label="My Teams"
  tabindex="-1"
  transition:fade={{ duration: 150 }}
>
  <!-- Background overlay -->
  <button
    class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
    on:click={closeModal}
    on:keydown={e => e.key === 'Escape' && closeModal()}
    aria-label="Close modal background"
  ></button>
  
  <!-- Modal content -->
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 relative z-10"
    role="document"
  >
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold text-stone-800 dark:text-white">My Teams</h3>
      <button
        class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
        on:click={closeModal}
        aria-label="Close teams modal"
      >
        <span>×</span>
        <span class="sr-only">Close</span>
      </button>
    </div>
    
    <div class="space-y-4">
      {#if !$user}
        <p class="text-center py-4 text-stone-600 dark:text-stone-300">
          Please sign in to save and load teams.
        </p>
      {:else}
        <!-- Save current team section -->
        <div class="border-b border-stone-200 dark:border-stone-700 pb-4">
          <h4 class="font-medium text-stone-800 dark:text-white mb-2">Save Current Team</h4>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Enter team name"
              bind:value={newTeamName}
              class="flex-1 px-3 py-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-gray-700 text-stone-800 dark:text-white"
            />
            <button
              class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg disabled:opacity-50"
              on:click={saveCurrentTeam}
              disabled={isLoading || !newTeamName.trim()}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        
        <!-- Teams list -->
        <div>
          <h4 class="font-medium text-stone-800 dark:text-white mb-2">Your Saved Teams</h4>
          
          {#if isLoading}
            <div class="py-4 text-center text-stone-600 dark:text-stone-300">
              Loading teams...
            </div>
          {:else if userTeams.length === 0}
            <div class="py-4 text-center text-stone-600 dark:text-stone-300">
              You haven't saved any teams yet.
            </div>
          {:else}
            <div class="space-y-2 max-h-60 overflow-y-auto">
              {#each userTeams as team}
                <div class="flex items-center justify-between p-3 bg-stone-100 dark:bg-gray-700 rounded-lg">
                  <div>
                    <div class="font-medium text-stone-800 dark:text-white">{team.teamName}</div>
                    <div class="text-sm text-stone-500 dark:text-stone-400">
                      {new Date(team.updatedAt.toDate()).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded"
                    on:click={() => loadTeam(team)}
                  >
                    Load
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}