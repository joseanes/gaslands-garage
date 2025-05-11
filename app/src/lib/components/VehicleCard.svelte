<script lang="ts">
    import { nanoid } from 'nanoid';
    import { createEventDispatcher } from 'svelte';
    import BuildHeader from './BuildHeader.svelte';

    const dispatch = createEventDispatcher();
    
    // Props
    export let vehicle: {
        id: string;
        type: string;
        name: string;
        weapons: string[];
        weaponFacings?: Record<string, string>;
        upgrades: string[];
        perks: string[];
    };
    export let vehicleTypes;
    export let weapons;
    export let upgrades;
    export let perks;
    export let vehicleRules;
    export let collapsed: boolean = false;
    export let playMode: boolean = false;
    export let validationReport = null;
    export let hazardCount: number = 0;
    export let filteredWeapons = [];
    export let filteredUpgrades = [];
    export let filteredPerks = [];
    export let usedBuildSlots: number = 0;

    // Local state for hazard tokens that can be immediately updated
    let localHazardCount = hazardCount;
    $: localHazardCount = hazardCount; // Update local count when prop changes

    // Functions for vehicle state modification
    // These will dispatch events to the parent component
    function removeVehicle() {
        dispatch('remove', { id: vehicle.id });
    }

    function cloneVehicle() {
        dispatch('clone', { id: vehicle.id });
    }
    
    function toggleCollapse() {
        dispatch('toggleCollapse', { id: vehicle.id });
    }
    
    function addWeapon(weaponId, facing = 'front') {
        dispatch('addWeapon', { vehicleId: vehicle.id, weaponId, facing });
    }
    
    function removeWeapon(index) {
        dispatch('removeWeapon', { vehicleId: vehicle.id, weaponIndex: index });
    }
    
    function addUpgrade(upgradeId) {
        dispatch('addUpgrade', { vehicleId: vehicle.id, upgradeId });
    }
    
    function removeUpgrade(index) {
        dispatch('removeUpgrade', { vehicleId: vehicle.id, upgradeIndex: index });
    }
    
    function addPerk(perkId) {
        dispatch('addPerk', { vehicleId: vehicle.id, perkId });
    }
    
    function removePerk(index) {
        dispatch('removePerk', { vehicleId: vehicle.id, perkIndex: index });
    }
    
    function incrementHazard() {
        localHazardCount += 1; // Immediately update local UI
        dispatch('incrementHazard', { vehicleId: vehicle.id });
    }

    function decrementHazard() {
        if (localHazardCount > 0) {
            localHazardCount -= 1; // Immediately update local UI
            dispatch('decrementHazard', { vehicleId: vehicle.id });
        }
    }
    
    // Helper functions
    // We now use the usedBuildSlots prop from the parent component

    function calculateUsedBuildSlots(vehicle) {
        let totalSlots = 0;

        // Calculate slots used by weapons
        for (const weaponInstanceId of vehicle.weapons) {
            const baseWeaponId = weaponInstanceId.split('_')[0];
            const weaponObj = weapons.find(w => w.id === baseWeaponId);
            if (weaponObj) {
                // Special case: Some weapons don't use build slots in Gaslands Refueled
                if (['handgun', 'molotov', 'grenades', 'ram', 'oil_slick', 'smokescreen'].includes(baseWeaponId)) {
                    // These weapons don't consume build slots
                    continue;
                }
                totalSlots += weaponObj.buildSlots || weaponObj.slots || 1;
            }
        }

        // Calculate slots used by upgrades
        for (const upgradeId of vehicle.upgrades) {
            const upgradeObj = upgrades.find(u => u.id === upgradeId);
            if (upgradeObj) {
                // Special case: Some upgrades don't use build slots in Gaslands Refueled
                if (['grenades'].includes(upgradeId)) {
                    // These upgrades don't consume build slots
                    continue;
                }
                totalSlots += upgradeObj.buildSlots || upgradeObj.slots || 1;
            }
        }

        return totalSlots;
    }

    function calculateMaxHull(): number {
        const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
        if (!vehicleType) return 0;

        let maxHull = vehicleType.maxHull;

        // Add hull points from upgrades
        for (const upgradeId of vehicle.upgrades) {
            // Check for Armor Plating, which adds +1 hull
            if (upgradeId === 'armor') {
                maxHull += 1;
            }
            // Add any other upgrades that affect hull here
        }

        // Add hull points from perks (if any)
        for (const perkId of vehicle.perks) {
            // Add any perks that affect hull here
            // For example: if (perkId === 'fortified' || perkId === 'tank_commander') maxHull += 1;
        }

        return maxHull;
    }
    
    function calculateTotalAttackDice(): number {
        if (!vehicle || !vehicle.weapons || vehicle.weapons.length === 0) return 0;

        let totalAttackDice = 0;

        // Calculate total attack dice from all weapons
        for (const weaponInstanceId of vehicle.weapons) {
            const baseWeaponId = weaponInstanceId.split('_')[0];
            const weaponObj = weapons.find(w => w.id === baseWeaponId);
            if (weaponObj && weaponObj.attackDice) {
                totalAttackDice += weaponObj.attackDice;
            }
        }

        return totalAttackDice;
    }
    
    function getVehicleRuleDetails(ruleName: string) {
        return vehicleRules.find(rule => rule.ruleName === ruleName);
    }
</script>

<div class="bg-stone-200 dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-2 no-card-padding" style="border-color: {vehicleTypes.find(vt => vt.id === vehicle.type)?.color || '#f59e0b'}">
    <div class="px-4 py-3 bg-stone-100 dark:bg-gray-800 flex flex-wrap justify-between items-center">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4 flex-grow">
            <div class="form-group mb-0 flex-grow">
                <label for="vehicle-type-{vehicle.id}" class="form-label uppercase">Vehicle Type</label>
                <div class="form-field">
                    <select 
                        id="vehicle-type-{vehicle.id}" 
                        class="form-select"
                        bind:value={vehicle.type}
                        disabled={playMode}
                        class:opacity-50={playMode}
                        class:cursor-not-allowed={playMode}
                    >
                        {#each vehicleTypes.slice().sort((a, b) => a.name.localeCompare(b.name)) as vt}
                            <option value={vt.id}>{vt.name}</option>
                        {/each}
                    </select>
                </div>
            </div>
            
            <div class="form-group mb-0 flex-grow">
                <label for="vehicle-name-{vehicle.id}" class="form-label uppercase">Vehicle Name</label>
                <div class="form-field">
                    <input 
                        type="text" 
                        id="vehicle-name-{vehicle.id}"
                        bind:value={vehicle.name}
                        class="form-input"
                        placeholder="Vehicle name"
                    />
                </div>
            </div>
        </div>
        <div class="mt-6">
            <BuildHeader
                vehicleCost={validationReport?.cans || 0}
                usedBuildSlots={usedBuildSlots}
                maxBuildSlots={vehicleTypes.find(vt => vt.id === vehicle.type)?.buildSlots || 2}
            />
        </div>
        <div class="flex items-center gap-2 self-start mt-2">
            <!-- Clone Vehicle Button -->
            <button
                class="p-2 h-8 flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600 rounded-full transition-colors"
                on:click={cloneVehicle}
                aria-label="Clone vehicle"
                disabled={playMode}
                class:opacity-50={playMode}
                class:cursor-not-allowed={playMode}
            >
                <span>+ Clone</span>
                <span class="sr-only">Clone vehicle</span>
            </button>

            <button
                class="p-2 h-8 flex items-center justify-center bg-amber-500 text-white hover:bg-amber-600 rounded-md transition-colors"
                on:click={toggleCollapse}
                aria-label={collapsed ? "Expand vehicle" : "Collapse vehicle"}
            >
                <span>{collapsed ? "+ Expand" : "- Collapse"}</span>
            </button>

            <!-- Delete / Remove Vehicle Button-->
            <button
                class="p-2 h-8 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-md transition-colors"
                on:click={removeVehicle}
                aria-label="Remove vehicle"
            >
                <span>× Remove</span>
            </button>
        </div>
    </div>
    
    <!-- Collapsed view - Only shown when collapsed -->
    {#if collapsed}
        <div class="p-4 flex items-center justify-between bg-stone-100 dark:bg-gray-800">
            <div class="flex items-center gap-4">
                <div class="vehicle-type-icon vehicle-type-{vehicle.type}" title="{vehicleTypes.find(vt => vt.id === vehicle.type)?.name || 'Unknown'}"></div>
                <div class="font-medium">
                    {vehicle.weapons.length} weapons | {vehicle.upgrades.length} upgrades
                </div>
                <BuildHeader
                    vehicleCost={validationReport?.cans || 0}
                    usedBuildSlots={usedBuildSlots}
                    maxBuildSlots={vehicleTypes.find(vt => vt.id === vehicle.type)?.buildSlots || 2}
                />
            </div>
            <div class="weight-class-indicator weight-{vehicleTypes.find(vt => vt.id === vehicle.type)?.weight || 1}">
                {vehicleTypes.find(vt => vt.id === vehicle.type)?.weight === 1 ? 'Light' : 
                vehicleTypes.find(vt => vt.id === vehicle.type)?.weight === 2 ? 'Medium' : 
                vehicleTypes.find(vt => vt.id === vehicle.type)?.weight === 3 ? 'Heavy' : 'Massive'}
            </div>
        </div>
    {/if}
    
    <!-- Vehicle details - Hidden when collapsed -->
    <div class="p-8" class:hidden={collapsed}>
        
        <!-- Interactive dashboard elements - Always visible in Play Mode -->
        <div class="interactive-dashboard bg-stone-50 dark:bg-gray-700 border border-stone-300 dark:border-gray-600 rounded-lg p-4 mb-6" class:hidden={!playMode}>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="hull-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600">
                    <div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">
                        Hull Points
                        {#if calculateMaxHull() > (vehicleTypes.find(vt => vt.id === vehicle.type)?.maxHull || 0)}
                            <span class="text-green-500 text-xs">(+{calculateMaxHull() - (vehicleTypes.find(vt => vt.id === vehicle.type)?.maxHull || 0)})</span>
                        {/if}
                    </div>
                    <div class="flex flex-wrap gap-1">
                        {#each Array(calculateMaxHull()) as _, i}
                            <div class="hull-checkbox">
                                <input type="checkbox" id="hull-{vehicle.id}-{i}" class="hull-checkbox-input" />
                                <label for="hull-{vehicle.id}-{i}" class="hull-checkbox-label"></label>
                            </div>
                        {/each}
                    </div>
                </div>
                
                <div class="gear-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600">
                    <div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">Current Gear</div>
                    <div class="gear-slider">
                        <input 
                            type="range" 
                            min="1" 
                            max="{vehicleTypes.find(vt => vt.id === vehicle.type)?.maxGear || 6}" 
                            value="1" 
                            class="gear-range w-full h-7 appearance-none bg-stone-200 dark:bg-gray-600 rounded-full" 
                        />
                        <div class="gear-markers flex justify-between px-2 mt-1">
                            {#each Array((vehicleTypes.find(vt => vt.id === vehicle.type)?.maxGear || 6)) as _, i}
                                <span class="gear-number text-xs font-bold">{i+1}</span>
                            {/each}
                        </div>
                    </div>
                </div>
                
                <div class="crew-hazard-row flex gap-4 col-span-1 md:col-span-2">
                    <div class="crew-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600 flex-1">
                        <div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">Crew: {vehicleTypes.find(vt => vt.id === vehicle.type)?.crew || 1}</div>
                        <div class="flex flex-wrap gap-1">
                            {#each Array(vehicleTypes.find(vt => vt.id === vehicle.type)?.crew || 1) as _, i}
                                <div class="crew-checkbox">
                                    <input type="checkbox" id="crew-{vehicle.id}-{i}" class="crew-checkbox-input" />
                                    <label for="crew-{vehicle.id}-{i}" class="crew-checkbox-label"></label>
                                </div>
                            {/each}
                        </div>
                    </div>
                    
                    <div class="hazard-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600 flex-1">
                        <div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">Hazard Tokens</div>
                        <div class="hazard-counter flex items-center justify-center gap-3">
                            <button 
                                class="counter-btn counter-minus w-8 h-8 bg-stone-200 dark:bg-gray-600 hover:bg-stone-300 dark:hover:bg-gray-500 rounded-full flex items-center justify-center font-bold text-xl"
                                on:click={decrementHazard}
                            >-</button>
                            <span class="counter-value text-2xl font-bold">{localHazardCount}</span>
                            <button 
                                class="counter-btn counter-plus w-8 h-8 bg-stone-200 dark:bg-gray-600 hover:bg-stone-300 dark:hover:bg-gray-500 rounded-full flex items-center justify-center font-bold text-xl"
                                on:click={incrementHazard}
                            >+</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Play Mode Loadout summary -->
        {#if playMode}
            <div class="loadout-summary mt-4 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600 p-3">
                <div class="mb-2">
                    {#each vehicle.weapons as weaponId, i}
                        {@const baseWeaponId = weaponId.split('_')[0]}
                        {@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
                        {@const facing = vehicle.weaponFacings?.[weaponId] || 'front'}
                        <div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
                            <span class="font-bold text-stone-700 dark:text-gray-300">{weaponObj?.name || weaponId}</span>
                            <span class="text-xs text-stone-500 dark:text-gray-400 ml-2">({facing})</span>
                            {#if weaponObj?.specialRules}
                                <div class="text-xs text-stone-500 dark:text-gray-400">{weaponObj.specialRules}</div>
                            {/if}
                        </div>
                    {/each}
                    
                    {#each vehicle.upgrades as upgradeId}
                        {@const upgrade = upgrades.find(u => u.id === upgradeId)}
                        <div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
                            <span class="font-bold text-stone-700 dark:text-gray-300">{upgrade?.name || upgradeId}</span>
                            {#if upgrade?.specialRules}
                                <div class="text-xs text-stone-500 dark:text-gray-400">{upgrade.specialRules}</div>
                            {/if}
                        </div>
                    {/each}
                    
                    {#each vehicle.perks as perkId}
                        {@const perk = perks.find(p => p.id === perkId)}
                        <div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
                            <span class="font-bold text-stone-700 dark:text-gray-300">{perk?.name || perkId}</span>
                            {#if perk?.text}
                                <div class="text-xs text-stone-500 dark:text-gray-400">{perk.text}</div>
                            {/if}
                        </div>
                    {/each}

                    <!-- Special rules in Play Mode -->
                    {#if vehicleTypes.find(vt => vt.id === vehicle.type)?.specialRules}
                        {@const vType = vehicleTypes.find(vt => vt.id === vehicle.type)}
                        {@const specialRules = vType?.specialRules?.split(',') || []}

                        {#each specialRules as ruleName}
                            {@const ruleDetails = getVehicleRuleDetails(ruleName.trim())}
                            <div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
                                <span class="font-bold text-stone-700 dark:text-gray-300">{ruleName.trim()}</span>
                                {#if ruleDetails}
                                    <div class="text-xs text-stone-500 dark:text-gray-400">{@html ruleDetails.rule}</div>
                                {:else}
                                    <div class="text-xs text-stone-500 dark:text-gray-400 italic">Unknown rule.</div>
                                {/if}
                            </div>
                        {/each}
                    {/if}
                    
                    {#if vehicle.weapons.length === 0 && vehicle.upgrades.length === 0 && vehicle.perks.length === 0 && !vehicleTypes.find(vt => vt.id === vehicle.type)?.specialRules}
                        <div class="text-sm text-stone-500 dark:text-gray-400 italic">No weapons, upgrades, perks, or special rules</div>
                    {/if}
                </div>
            </div>
        {/if}
        
        <!-- Weapons section - Hidden in Play Mode -->
        <div class="mb-4" class:hidden={playMode}>
            <h3 class="text-sm font-bold text-stone-800 dark:text-gray-200 mb-1 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
                <span class="bg-stone-300 dark:bg-gray-600 px-2 py-0.5 rounded-t mr-2 text-xs uppercase">Weapons</span>
            </h3>
            
            {#if vehicle.weapons.length === 0}
                <p class="text-stone-500 dark:text-gray-400 text-sm italic px-2">No weapons installed.</p>
            {:else}
                <ul class="space-y-1 mb-3 border border-stone-300 dark:border-gray-600 rounded overflow-hidden divide-y divide-stone-300 dark:divide-gray-600">
                    {#each vehicle.weapons as weaponId, i}
                        {@const baseWeaponId = weaponId.split('_')[0]}
                        {@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
                        {@const facing = vehicle.weaponFacings?.[weaponId] || 'front'}
                        <li class="bg-stone-50 dark:bg-gray-700 px-3 py-2 m-0">
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <b><span class="text-stone-700 dark:text-gray-200 font-bold">
                                        {weaponObj?.name || weaponId}
                                        {#if weaponObj?.advanced}
                                            <span class="ml-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">(Advanced)</span>
                                        {/if}
                                    </span></b>
                                    <!-- Remove button -->
                                    <button
                                        class="p-1 h-6 px-2 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded transition-colors ml-2 flex-shrink-0 text-xs"
                                        on:click={() => removeWeapon(i)}
                                        aria-label="Remove weapon"
                                    >
                                        <span>× Remove</span>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Weapon facing controls -->
                            <div class="mt-2 flex items-center">
                                <span class="text-stone-600 dark:text-gray-300 text-xs font-semibold uppercase mr-2">Facing:</span>
                                <div class="flex flex-wrap gap-1">
                                    <select 
                                        bind:value={vehicle.weaponFacings[weaponId]} 
                                        class="text-xs p-1 border border-stone-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-stone-800 dark:text-gray-200"
                                        disabled={weaponObj?.facing === 'fixed' || weaponObj?.crewFired || playMode}
                                    >
                                        <option value="front">Front</option>
                                        <option value="side">Side</option>
                                        <option value="rear">Rear</option>
                                        <option value="any" disabled={!weaponObj?.crewFired}>360°</option>
                                    </select>
                                    
                                    {#if weaponObj?.specialRules}
                                        <span class="ml-2 text-xs text-stone-500 dark:text-gray-400">{weaponObj.specialRules}</span>
                                    {/if}
                                </div>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
            
            <div class="relative">
                <label for="add-weapon-{vehicle.id}" class="sr-only">Add a weapon</label>
                <select
                    id="add-weapon-{vehicle.id}"
                    class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    on:change={e => {
                        const target = e.target as HTMLSelectElement;
                        const weaponId = target.value;
                        if (weaponId) {
                            const facingSelect = document.getElementById(`facing-select-${vehicle.id}`);
                            const facing = facingSelect ? (facingSelect as HTMLSelectElement).value : 'front';
                            addWeapon(weaponId, facing);
                            target.value = ""; // Reset selection
                        }
                    }}
                    disabled={!filteredWeapons.some(w => (w.buildSlots || 1) === 0) && usedBuildSlots >= (vehicleTypes.find(vt => vt.id === vehicle.type)?.buildSlots || 2)}
                >
                    <option value="" disabled selected>+ Add weapon</option>
                    {#each filteredWeapons as w}
                        <option value={w.id} disabled={(w.buildSlots || 1) > 0 && usedBuildSlots + (w.buildSlots || 1) > (vehicleTypes.find(vt => vt.id === vehicle.type)?.buildSlots || 2)}>
                            {w.name}
                            {(w.buildSlots || 1) === 0 ? " (Free)" : ""}
                        </option>
                    {/each}
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
            

        </div>
        
        <!-- Upgrades section - Hidden in Play Mode -->
        <div class="mb-4 mt-6" class:hidden={playMode}>
            <h3 class="text-sm font-bold text-stone-800 dark:text-gray-200 mb-1 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
                <span class="bg-stone-300 dark:bg-gray-600 px-2 py-0.5 rounded-t mr-2 text-xs uppercase">Upgrades</span>
            </h3>
            
            {#if vehicle.upgrades.length === 0}
                <p class="text-stone-500 text-sm italic px-2">No upgrades installed.</p>
            {:else}
                <ul class="space-y-1 mb-3 border border-stone-300 rounded overflow-hidden divide-y divide-stone-300">
                    {#each vehicle.upgrades as upgradeId, i}
                        {@const upgrade = upgrades.find(u => u.id === upgradeId)}
                        <li class="flex items-center justify-between bg-stone-50 px-3 py-2">
                            <div class="flex-1">
                                <b><span class="text-stone-700 dark:text-gray-200 font-bold block">
                                    {upgrade?.name || upgradeId}
                                    {#if upgrade?.advanced}
                                        <span class="ml-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">(Advanced)</span>
                                    {/if}
                                </span></b>
                                <span class="text-stone-500 dark:text-gray-400 text-xs">{upgrade?.specialRules || ""}</span>
                            </div>
                            <button
                                class="p-1 h-6 px-2 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded transition-colors ml-2 flex-shrink-0 text-xs"
                                on:click={() => removeUpgrade(i)}
                                aria-label="Remove upgrade"
                            >
                                <span>× Remove</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}
            
            <div class="relative">
                <label for="add-upgrade-{vehicle.id}" class="sr-only">Add an upgrade</label>
                <select
                    id="add-upgrade-{vehicle.id}"
                    class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    on:change={e => {
                        const target = e.target as HTMLSelectElement;
                        const upgradeId = target.value;
                        if (upgradeId) {
                            addUpgrade(upgradeId);
                            target.value = ""; // Reset selection
                        }
                    }}
                    disabled={!filteredUpgrades.some(u => (u.buildSlots || 1) === 0) && usedBuildSlots >= (vehicleTypes.find(vt => vt.id === vehicle.type)?.buildSlots || 2)}
                >
                    <option value="" disabled selected>+ Add upgrade</option>
                    {#each filteredUpgrades.slice().sort((a, b) => a.name.localeCompare(b.name)) as u}
                        <option value={u.id} disabled={(u.buildSlots || 1) > 0 && usedBuildSlots + (u.buildSlots || 1) > (vehicleTypes.find(vt => vt.id === vehicle.type)?.buildSlots || 2)}>
                            {u.name}
                            {(u.buildSlots || 1) === 0 ? " (Free)" : ""}
                        </option>
                    {/each}
                </select>
            </div>
        </div>
        
        <!-- Perks section - Hidden in Play Mode -->
        <div class="mb-4 mt-6" class:hidden={playMode}>
            <h3 class="text-sm font-bold text-stone-800 dark:text-gray-200 mb-1 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
                <span class="bg-stone-300 dark:bg-gray-600 px-2 py-0.5 rounded-t mr-2 text-xs uppercase">Perks</span>
            </h3>
            
            {#if vehicle.perks.length === 0}
                <p class="text-stone-500 dark:text-gray-400 text-sm italic px-2">No perks selected.</p>
            {:else}
                <ul class="space-y-1 mb-3 border border-stone-300 dark:border-gray-600 rounded overflow-hidden divide-y divide-stone-300 dark:divide-gray-600">
                    {#each vehicle.perks as perkId, i}
                        {@const perk = perks.find(p => p.id === perkId)}
                        <li class="flex items-center justify-between bg-stone-50 dark:bg-gray-700 px-3 py-2">
                            <div class="flex-1">
                                <b><span class="text-stone-700 dark:text-gray-200 font-bold block">{perk?.name || perkId}</span></b>
                                <span class="text-stone-500 dark:text-gray-400 text-xs">{perk?.text || ""}</span>
                            </div>
                            <button
                                class="p-1 h-6 px-2 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded transition-colors ml-2 flex-shrink-0 text-xs"
                                on:click={() => removePerk(i)}
                                aria-label="Remove perk"
                            >
                                <span>× Remove</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}

            <!-- Special Rules Section - Only in Edit Mode -->
            {#if vehicleTypes.find(vt => vt.id === vehicle.type)?.specialRules}
                {@const vType = vehicleTypes.find(vt => vt.id === vehicle.type)}
                {@const specialRules = vType?.specialRules?.split(',') || []}
                <div class="mt-4">
                    <h3 class="text-sm font-bold text-stone-800 dark:text-gray-200 mb-1 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
                        <span class="bg-stone-300 dark:bg-gray-600 px-2 py-0.5 rounded-t mr-2 text-xs uppercase">Special Rules</span>
                    </h3>

                    {#if specialRules.length === 0}
                        <p class="text-stone-500 dark:text-gray-400 text-sm italic px-2">No special rules.</p>
                    {:else}
                        <ul class="space-y-1 mb-3 border border-stone-300 dark:border-gray-600 rounded overflow-hidden divide-y divide-stone-300 dark:divide-gray-600">
                            {#each specialRules as ruleName}
                                {@const ruleDetails = getVehicleRuleDetails(ruleName.trim())}
                                <li class="bg-stone-50 dark:bg-gray-700 px-3 py-2">
                                    <div class="flex-1">
                                        <b><span class="text-stone-700 dark:text-gray-200 font-bold block">{ruleName.trim()}</span></b>
                                        {#if ruleDetails}
                                            <div class="text-stone-500 dark:text-gray-400 text-sm mt-1">{@html ruleDetails.rule}</div>
                                        {:else}
                                            <div class="text-stone-500 dark:text-gray-400 text-sm italic mt-1">Rule details not found.</div>
                                        {/if}
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            {/if}
            
            <div class="relative">
                <label for="add-perk-{vehicle.id}" class="sr-only">Add a perk</label>
                <select
                    id="add-perk-{vehicle.id}"
                    class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    on:change={e => {
                        const target = e.target as HTMLSelectElement;
                        const perkId = target.value;
                        if (perkId) {
                            addPerk(perkId);
                            target.value = ""; // Reset selection
                        }
                    }}
                >
                    <option value="" disabled selected>+ Add perk</option>
                    {#each filteredPerks.slice().sort((a, b) => a.name.localeCompare(b.name)) as p}
                        <option value={p.id}>{p.name}</option>
                    {/each}
                </select>
            </div>
        </div>
        
        <!-- Validation errors section -->
        {#if validationReport && validationReport.errors.length > 0}
            <div class="mt-4 p-3 bg-red-100 dark:bg-red-900 rounded-md border border-red-300 dark:border-red-700">
                <h4 class="text-sm font-bold text-red-800 dark:text-red-200 mb-2">Validation Errors:</h4>
                <ul class="list-disc pl-5 text-sm text-red-700 dark:text-red-300">
                    {#each validationReport.errors as error}
                        <li>{error}</li>
                    {/each}
                </ul>
            </div>
        {/if}
        
        <!-- Validation warnings section -->
        {#if validationReport && validationReport.warnings.length > 0}
            <div class="mt-4 p-3 bg-amber-100 dark:bg-amber-900 rounded-md border border-amber-300 dark:border-amber-700">
                <h4 class="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">Warnings:</h4>
                <ul class="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">
                    {#each validationReport.warnings as warning}
                        <li>{warning}</li>
                    {/each}
                </ul>
            </div>
        {/if}
    </div>
</div>