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
      console.log("Modal opened with currentDraft:", currentDraft);
      
      // Get the team name directly from window.teamName if available, or from currentDraft
      if (typeof window !== 'undefined') {
        try {
          if (typeof window.teamName === 'string') {
            newTeamName = window.teamName;
            console.log("Got team name from window:", newTeamName);
          } else if (currentDraft && currentDraft.teamName) {
            newTeamName = currentDraft.teamName;
            console.log("Got team name from currentDraft:", newTeamName);
          } else {
            // Set a default team name if none exists
            newTeamName = "My Gaslands Team";
            console.log("Using default team name");
          }
        } catch (e) {
          console.error("Error getting team name:", e);
          // Set a default team name if there's an error
          newTeamName = "My Gaslands Team";
        }
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
    
    console.log("About to save team");

    // First check if a team with this name already exists
    const existingTeam = userTeams.find(team => team.teamName === newTeamName.trim());

    // If team exists, ask for confirmation before overwriting
    if (existingTeam) {
      const confirmOverwrite = confirm(`A team named "${newTeamName}" already exists. Do you want to overwrite it?`);
      if (!confirmOverwrite) {
        return; // User canceled the overwrite
      }
      
      // Set isSaving flag
      isSaving = true;
      
      // Note: We'll pass the existing team ID to saveTeam later
      console.log(`User confirmed overwrite of team "${existingTeam.teamName}" with ID: ${existingTeam.id}`);
    } else {
      isSaving = true;
    }

    try {
      let draftToSave = null;
      
      // Try to create a team with the most detailed data we can extract from the DOM
      // This is the most reliable approach that doesn't depend on any window functions
      const vehicleCards = document.querySelectorAll('.vehicle-card');
      
      if (vehicleCards && vehicleCards.length > 0) {
        console.log("Found vehicle cards in DOM:", vehicleCards.length);
        
        // Get sponsor from any select we can find
        const allSelects = document.querySelectorAll('select');
        let sponsorId = 'miyazaki'; // Default fallback
        
        // Look for sponsor selects
        for (const select of allSelects) {
          const selectedOption = select.options[select.selectedIndex];
          if (selectedOption && select.id && select.id.includes('sponsor')) {
            sponsorId = select.value;
            break;
          }
        }
        
        // Try to extract detailed vehicle information from the cards
        const vehicles = [];
        
        // Process each vehicle card to extract as much info as possible
        vehicleCards.forEach((card, index) => {
          try {
            // Basic vehicle structure
            const vehicle = {
              id: `vehicle_${index + 1}`,
              type: 'car', // Default
              weapons: [],
              upgrades: [],
              perks: [],
              name: `Vehicle ${index + 1}`
            };
            
            // Try to get vehicle type from select boxes within this card
            const typeSelects = card.querySelectorAll('select');
            for (const select of typeSelects) {
              if (select.id && select.id.toLowerCase().includes('type')) {
                vehicle.type = select.value || 'car';
                break;
              }
            }
            
            // Try to find vehicle name from inputs
            const nameInputs = card.querySelectorAll('input');
            for (const input of nameInputs) {
              if (input.placeholder && input.placeholder.toLowerCase().includes('name')) {
                vehicle.name = input.value || `Vehicle ${index + 1}`;
                break;
              }
            }
            
            // Look for weapon, upgrade, and perk lists
            const weaponElements = card.querySelectorAll('.weapon-item, [data-weapon-id]');
            if (weaponElements && weaponElements.length > 0) {
              for (const element of weaponElements) {
                // Try to extract weapon ID from data attribute or class
                const weaponId = element.dataset.weaponId || element.id;
                if (weaponId) {
                  vehicle.weapons.push(weaponId);
                }
              }
            }
            
            // Add this vehicle to our list
            vehicles.push(vehicle);
          } catch (error) {
            console.error(`Error extracting data for vehicle ${index}:`, error);
            // Add a basic vehicle as fallback
            vehicles.push({
              id: `vehicle_${index + 1}`,
              type: 'car',
              weapons: [],
              upgrades: [],
              perks: [],
              name: `Vehicle ${index + 1}`
            });
          }
        });
        
        // Get maxCans from input if available
        let maxCans = 50; // Default
        const maxCansInputs = document.querySelectorAll('input[type="number"]');
        for (const input of maxCansInputs) {
          if (input.id && input.id.toLowerCase().includes('cans')) {
            maxCans = parseInt(input.value) || 50;
            break;
          }
        }
        
        // Try to get window values as they are likely more accurate if available
        if (typeof window !== 'undefined') {
          // Use window global data if available
          if (window.vehicles && Array.isArray(window.vehicles) && window.vehicles.length > 0) {
            console.log("Found window.vehicles, using that instead of DOM extraction");
            vehicles.length = 0; // Clear the array
            window.vehicles.forEach(v => vehicles.push(JSON.parse(JSON.stringify(v))));
          }
          
          if (window.sponsorId) {
            sponsorId = window.sponsorId;
          }
          
          if (window.maxCans) {
            maxCans = window.maxCans;
          }
        }
        
        // Create the draft with the data we collected
        draftToSave = {
          sponsor: sponsorId,
          vehicles: vehicles,
          teamName: newTeamName.trim(),
          maxCans: maxCans,
          darkMode: document.documentElement.classList.contains('dark-mode')
        };
        
        console.log("Created draft with visible vehicle cards:", draftToSave);
      }
      
      // If no vehicles were found in DOM, offer to save a basic empty team
      if (!draftToSave) {
        if (confirm("Unable to detect existing vehicles. Would you like to save a basic team with a single empty vehicle?")) {
          draftToSave = {
            sponsor: "miyazaki",
            vehicles: [
              {
                id: "vehicle_1",
                type: "car",
                weapons: [],
                upgrades: [],
                perks: [],
                name: "Vehicle 1"
              }
            ],
            teamName: newTeamName.trim(),
            maxCans: 50,
            darkMode: document.documentElement.classList.contains('dark-mode')
          };
        } else {
          isSaving = false;
          return;
        }
      }
      
      // Always use the new team name
      draftToSave.teamName = newTeamName.trim();
      
      // Check that required properties exist, handling both sponsor and sponsorId
      const hasSponsor = draftToSave.sponsor || draftToSave.sponsorId;
      
      if (!hasSponsor || !Array.isArray(draftToSave.vehicles)) {
        console.error("Current draft is missing required fields:", draftToSave);
        alert("Cannot save team: Team data is incomplete (missing sponsor or vehicles)");
        isSaving = false;
        return;
      }
      
      // Make sure the draft has a sponsor property (for consistency)
      if (!draftToSave.sponsor && draftToSave.sponsorId) {
        draftToSave.sponsor = draftToSave.sponsorId;
      }
      
      // Add the team name to the draft
      draftToSave.teamName = newTeamName.trim();

      // Log info that might help identify issues
      console.log("Saving team with name:", newTeamName);
      console.log("Draft to save:", JSON.stringify(draftToSave, null, 2));

      // Pass the existing team ID if we're overwriting
      const result = await saveTeam(
        draftToSave, 
        newTeamName,
        existingTeam ? existingTeam.id : undefined
      );

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
    console.log('loadTeam called with:', team);
    console.log('teamData structure:', JSON.stringify(team.teamData, null, 2));
    
    // Just log if functions are missing, but continue anyway
    if (typeof window === 'undefined') {
      console.error('Window object not available');
    } else if (typeof window.importDraftFn !== 'function') {
      console.error('importDraftFn not available on window object, will try prop-based method');
    }
    
    // Make sure we have valid data before proceeding
    if (!team || !team.teamData) {
      console.error('Invalid team data:', team);
      alert('Unable to load team: Invalid team data');
      return;
    }
    
    // Check the team structure - handle both sponsor and sponsorId (for backwards compatibility)
    const sponsor = team.teamData.sponsor || team.teamData.sponsorId;
    
    if (!sponsor || !Array.isArray(team.teamData.vehicles)) {
      console.error('Invalid team structure:', team.teamData);
      alert('Unable to load team: Team data is missing required information');
      return;
    }
    
    // Create a normalized version of the team data with deep clone to avoid reference issues
    const normalizedTeamData = JSON.parse(JSON.stringify({
      ...team.teamData,
      sponsor: sponsor,  // Ensure we always use 'sponsor' as the property name
      teamName: team.teamName || "My Gaslands Team" // Include team name in normalized data
    }));
    
    console.log("Prepared normalized team data for import:", normalizedTeamData);
    
    // Try direct page replacement approach
    try {
      console.log("Using direct vehicle injection technique");
      
      // Simulate a user selecting a sponsor and adding vehicles
      if (typeof document !== 'undefined') {
        // 1. First close the modal to get back to the main view
        closeModal();
        
        // 2. Find the sponsor selection dropdown and set it to the team's sponsor
        setTimeout(() => {
          try {
            // Find and select the sponsor
            const sponsorSelects = document.querySelectorAll('select');
            for (const select of sponsorSelects) {
              if (select.id && select.id.toLowerCase().includes('sponsor')) {
                // Set the sponsor value
                select.value = normalizedTeamData.sponsor;
                // Trigger change event
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
                console.log("Set sponsor to:", normalizedTeamData.sponsor);
                break;
              }
            }
            
            // 3. Use the "Add Vehicle" button to add vehicles
            const buttons = document.querySelectorAll('button');
            let addVehicleButton = null;
            
            for (const button of buttons) {
              if (button.textContent && button.textContent.toLowerCase().includes('add vehicle')) {
                addVehicleButton = button;
                break;
              }
            }
            
            // Add the vehicles one by one
            if (addVehicleButton) {
              const vehicleCount = normalizedTeamData.vehicles.length;
              console.log(`Adding ${vehicleCount} vehicles...`);
              
              // Remove existing vehicles first (find and click 'Remove' buttons)
              const removeButtons = document.querySelectorAll('button');
              for (const button of removeButtons) {
                if (button.textContent && button.textContent.toLowerCase().includes('remove') && 
                    !button.textContent.toLowerCase().includes('remove weapon') &&
                    !button.textContent.toLowerCase().includes('remove upgrade') &&
                    !button.textContent.toLowerCase().includes('remove perk')) {
                  button.click();
                }
              }
              
              // Add new vehicles and also set up a custom event to provide full vehicle details
              for (let i = 0; i < vehicleCount; i++) {
                addVehicleButton.click();
              }
              
              console.log("Team loaded with basic structure");
              
              // Create and dispatch a custom event with the full team data
              // This allows any listener to pick up the complete team data
              try {
                const teamDataEvent = new CustomEvent('gaslands-load-team-data', {
                  detail: normalizedTeamData,
                  bubbles: true
                });
                document.dispatchEvent(teamDataEvent);
                console.log("Dispatched team data event with full details");
              } catch (e) {
                console.error("Failed to dispatch team data event:", e);
              }
              
              // Find the team name input and set it
              setTimeout(() => {
                const teamNameInputs = document.querySelectorAll('input');
                for (const input of teamNameInputs) {
                  if (input.id && input.id.toLowerCase().includes('team')) {
                    input.value = normalizedTeamData.teamName || "My Gaslands Team";
                    const event = new Event('input', { bubbles: true });
                    input.dispatchEvent(event);
                    break;
                  }
                }
                
                // Dispatch window event as fallback - do this in a timeout
                // to avoid any jQuery event conflicts
                if (typeof window !== 'undefined') {
                  try {
                    // Use a timeout to ensure this runs in a clean JS event cycle
                    // This helps avoid jQuery conflicts
                    setTimeout(() => {
                      try {
                        const event = new CustomEvent('gaslands-team-loaded', {
                          detail: normalizedTeamData,
                          bubbles: false // Avoid bubbling to prevent jQuery interference
                        });
                        window.dispatchEvent(event);
                        console.log("Dispatched window team loaded event");
                      } catch (innerError) {
                        console.error("Error in delayed event dispatch:", innerError);
                      }
                    }, 10);
                  } catch (e) {
                    console.error("Failed to dispatch window event:", e);
                  }
                }
              }, 200);
            } else {
              console.error("Could not find Add Vehicle button");
              
              // Fallback - just try the prop method
              importDraft(normalizedTeamData);
            }
          } catch (e) {
            console.error("Error during direct vehicle injection:", e);
            
            // Final fallback - use the prop-based approach
            closeModal();
            setTimeout(() => {
              importDraft(normalizedTeamData);
            }, 100);
          }
        }, 100);
      } else {
        // If document is not available, fall back to prop method
        importDraft(normalizedTeamData);
        closeModal();
      }
    } catch (error) {
      console.error("Error importing team:", error);
      alert("Error loading team. Please try again.");
      closeModal();
    }
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
    class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
    role="document"
    style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: var(--modal-bg-color, white); padding: 1.5rem;"
    data-modal-content="true"
  >
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-bold text-stone-800 dark:text-white modal-heading">My Teams</h3>
      <button
        class="py-0.25 px-2 h-[2rem] flex items-center justify-center rounded transition-colors text-sm amber-button"
        on:click={closeModal}
        aria-label="Close teams modal"
      >
        <span>Close</span>
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
              class="flex-1 px-4 py-0.25 border-2 border-stone-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-stone-800 dark:text-white modal-input"
              style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
            />
            <button
              class="px-4 py-1.5 amber-button rounded-md disabled:opacity-50 flex items-center shadow-md text-sm"
              on:click={saveCurrentTeam}
              disabled={isSaving || !newTeamName.trim()}
              style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
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
                      class="px-4 py-1.5 amber-button rounded-md shadow-md transition-colors flex-1 sm:flex-none text-sm"
                      on:click={() => loadTeam(team)}
                      style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
                    >
                      Load
                    </button>
                    <button
                      class="px-4 py-1.5 red-button rounded-md shadow-md transition-colors flex items-center flex-1 sm:flex-none justify-center text-sm"
                      on:click={() => removeTeam(team.id)}
                      disabled={deletingTeamId === team.id}
                      style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
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