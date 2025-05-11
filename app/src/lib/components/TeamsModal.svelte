<script lang="ts">
  import { user } from '$lib/firebase';
  import { getUserTeams, saveTeam, deleteTeam } from '$lib/services/team';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Auth from './Auth.svelte';

  export let showModal = false;
  export let currentDraft;
  export let importDraft;
  
  let isLoading = false;
  let isSaving = false;
  let deletingTeamId = null;
  let userTeams = [];
  let newTeamName = '';
  
  // Load user's teams when the modal opens
  $: if (showModal && $user) {
    loadUserTeams();
  }

  // Watch for modal opening to set default values
  let previousModalState = false;
  $: {
    if (showModal && !previousModalState) {
      // Modal was just opened
      if (currentDraft && currentDraft.teamName) {
        newTeamName = currentDraft.teamName;
      }
    }
    previousModalState = showModal;
  }
  
  async function loadUserTeams() {
    if (!$user) {
      console.log("No user logged in, unable to load teams");
      return;
    }

    isLoading = true;
    console.log("Loading teams for user:", $user.uid);
    const result = await getUserTeams();
    isLoading = false;

    if (result.success) {
      userTeams = result.teams;
      console.log(`Successfully loaded ${result.teams.length} teams`);
    } else {
      console.error("Failed to load teams:", result.error);
    }
  }
  
  // Save current team
  async function saveCurrentTeam() {
    if (!$user || !newTeamName.trim()) return;

    // First check if a team with this name already exists
    const existingTeam = userTeams.find(team => team.teamName === newTeamName.trim());

    // If team exists, ask for confirmation before overwriting
    if (existingTeam) {
      const confirmOverwrite = confirm(`A team named "${newTeamName}" already exists. Do you want to overwrite it?`);
      if (!confirmOverwrite) {
        return; // User canceled the overwrite
      }

      // If user confirmed, delete the existing team first
      isSaving = true;
      try {
        const deleteResult = await deleteTeam(existingTeam.id);
        if (!deleteResult.success) {
          console.error("Failed to delete existing team:", deleteResult.error);
          alert(`Failed to overwrite team: ${deleteResult.error}`);
          isSaving = false;
          return;
        }
      } catch (error) {
        console.error("Exception deleting existing team:", error);
        alert(`Error overwriting team: ${error instanceof Error ? error.message : "Unknown error"}`);
        isSaving = false;
        return;
      }
    } else {
      isSaving = true;
    }

    try {
      // Log info that might help identify issues
      console.log("Saving team with name:", newTeamName);
      console.log("Current draft type:", typeof currentDraft);
      console.log("Current draft has vehicles:",
        currentDraft && Array.isArray(currentDraft.vehicles) ?
        currentDraft.vehicles.length : "N/A");

      const result = await saveTeam(currentDraft, newTeamName);

      if (result.success) {
        // Keep the name field populated with the team name for convenience
        // since the user may want to create multiple saves with different names
        await loadUserTeams(); // Reload teams
        alert(existingTeam ? "Team updated successfully!" : "Team saved successfully!");
      } else {
        console.error("Failed to save team:", result.error);
        alert(`Failed to save team: ${result.error}`);
      }
    } catch (error) {
      console.error("Exception in saveCurrentTeam:", error);
      alert(`Error saving team: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      isSaving = false;
    }
  }
  
  // Load selected team
  function loadTeam(team) {
    importDraft(team.teamData);
    closeModal();
  }
  
  // Delete team
  async function removeTeam(teamId) {
    if (!confirm('Are you sure you want to delete this team?')) return;
    
    deletingTeamId = teamId;
    const result = await deleteTeam(teamId);
    deletingTeamId = null;
    
    if (result.success) {
      await loadUserTeams(); // Reload teams
    } else {
      console.error("Failed to delete team");
      alert('Failed to delete team. Please try again.');
    }
  }
  
  function closeModal() {
    showModal = false;
  }
</script>

{#if showModal}
<div
  class="fixed inset-0 bg-black z-50"
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
    class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6 md:p-8 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
    role="document"
    style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: white;"
  >
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-bold text-stone-800 dark:text-white modal-heading">My Teams</h3>
      <button
        class="text-stone-400 hover:text-stone-600 dark:text-gray-300 dark:hover:text-white transition-colors"
        on:click={closeModal}
        aria-label="Close teams modal"
      >
        <span class="text-2xl">×</span>
        <span class="sr-only">Close</span>
      </button>
    </div>
    
    <div class="space-y-6">
      {#if !$user}
        <div class="text-center py-6 space-y-4">
          <p class="text-stone-600 dark:text-gray-300 modal-text">
            Please sign in to save and load teams.
          </p>
          <div class="flex justify-center">
            <Auth />
          </div>
        </div>
      {:else}
        <!-- Save current team section -->
        <div class="border-b border-stone-200 dark:border-amber-900 pb-6">
          <h4 class="font-medium text-stone-800 dark:text-white text-lg mb-4 modal-heading">Save Current Team</h4>
          <div class="flex gap-3">
            <input
              type="text"
              placeholder="Enter team name"
              bind:value={newTeamName}
              class="flex-1 px-4 py-3 border-2 border-stone-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-stone-800 dark:text-white modal-input"
            />
            <button
              class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md disabled:opacity-50 flex items-center shadow-md text-sm"
              on:click={saveCurrentTeam}
              disabled={isSaving || !newTeamName.trim()}
            >
              {#if isSaving}
                <div class="animate-spin mr-2 h-4 w-4 border-b-2 border-white rounded-full"></div>
                Saving...
              {:else}
                Save
              {/if}
            </button>
          </div>
        </div>
        
        <!-- Teams list -->
        <div>
          <h4 class="font-medium text-stone-800 dark:text-white text-lg mb-4 modal-heading">Your Saved Teams</h4>
          
          {#if isLoading}
            <div class="py-6 text-center text-stone-600 dark:text-gray-300">
              <div class="flex justify-center">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
              </div>
              <p class="mt-3">Loading teams...</p>
            </div>
          {:else if userTeams.length === 0}
            <div class="py-6 text-center text-stone-600 dark:text-gray-300">
              You haven't saved any teams yet.
            </div>
          {:else}
            <div class="space-y-3 max-h-72 overflow-y-auto pr-2">
              {#each userTeams as team}
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-100 dark:bg-gray-700 rounded-lg border border-stone-200 dark:border-gray-600">
                  <div class="mb-3 sm:mb-0">
                    <div class="font-medium text-stone-800 dark:text-white text-lg">{team.teamName}</div>
                    <div class="text-sm text-stone-500 dark:text-gray-400">
                      {new Date(team.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div class="flex space-x-3">
                    <button
                      class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-md transition-colors flex-1 sm:flex-none text-sm"
                      on:click={() => loadTeam(team)}
                    >
                      Load
                    </button>
                    <button
                      class="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md shadow-md transition-colors flex items-center flex-1 sm:flex-none justify-center text-sm"
                      on:click={() => removeTeam(team.id)}
                      disabled={deletingTeamId === team.id}
                    >
                      {#if deletingTeamId === team.id}
                        <div class="animate-spin mr-2 h-4 w-4 border-b-2 border-white rounded-full"></div>
                        Deleting...
                      {:else}
                        Delete
                      {/if}
                    </button>
                  </div>
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