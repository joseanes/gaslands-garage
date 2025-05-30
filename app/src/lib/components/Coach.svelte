<script>
    import { fade } from 'svelte/transition';
    import Tooltip from './Tooltip.svelte';
    
    // Props
    export let vehicles = [];
    export let vehicleTypes = [];
    export let weapons = [];
    export let upgrades = [];
    export let perks = [];
    export let vehicleRules = []; // Add vehicleRules prop
    export let currentSponsor = null;
    export let totalCans = 0;
    export let maxCans = 50;

    // Core calculation functions
    function calculateMaxHull(vehicle) {
        if (!vehicle) return 0;
        
        const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
        if (!vehicleType) return 0;

        let maxHull = vehicleType.maxHull || 0;

        // Add hull points from upgrades
        if (vehicle.upgrades) {
            for (const upgradeId of vehicle.upgrades) {
                const upgrade = upgrades.find(u => u.id === upgradeId);
                if (upgrade && upgrade.hull) {
                    maxHull += upgrade.hull;
                } else if (upgradeId === 'armor') {
                    maxHull += 1;
                }
            }
        }

        return maxHull;
    }

    // Helper function to find base weapon ID from instance ID
    function findBaseWeaponId(weaponInstanceId) {
        const parts = weaponInstanceId.split('_');
        
        // Handle case with no underscores
        if (parts.length === 1) {
            return weaponInstanceId;
        }
        
        // Try increasingly longer potential base IDs until we find a match
        for (let i = parts.length - 1; i >= 1; i--) {
            const potentialBaseId = parts.slice(0, i).join('_');
            const match = weapons.find(w => w.id === potentialBaseId);
            if (match) {
                return potentialBaseId;
            }
        }
        
        // If no match found, use the default approach (all but last part)
        return parts.slice(0, -1).join('_');
    }

    function calculateTotalAttackDice(vehicle) {
        if (!vehicle || !vehicle.weapons || !vehicle.weapons.length) return 0;

        let totalAttackDice = 0;

        for (const weaponInstanceId of vehicle.weapons) {
            const baseWeaponId = findBaseWeaponId(weaponInstanceId);
            const weaponObj = weapons.find(w => w.id === baseWeaponId);
            if (weaponObj && weaponObj.attackDice) {
                totalAttackDice += weaponObj.attackDice;
            }
        }

        return totalAttackDice;
    }
    
    function calculateHandling(vehicle) {
        if (!vehicle) return 0;
        
        const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
        if (!vehicleType) return 0;

        let handling = vehicleType.handling || 4; // Default to 4 if not specified

        if (vehicle.upgrades) {
            for (const upgradeId of vehicle.upgrades) {
                const upgradeObj = upgrades.find(u => u.id === upgradeId);
                if (upgradeObj?.handling) {
                    handling += upgradeObj.handling;
                } else if (upgradeObj?.handlingModifier) {
                    handling += upgradeObj.handlingModifier;
                }
            }
        }

        return handling;
    }

    // Calculate aggregate metrics
    function getTotalAttackDice() {
        return vehicles.reduce((sum, vehicle) => sum + calculateTotalAttackDice(vehicle), 0);
    }
    
    function getTotalHull() {
        return vehicles.reduce((sum, vehicle) => sum + calculateMaxHull(vehicle), 0);
    }
    
    function getCombatEffectivenessIndex() {
        if (!vehicles || !vehicles.length || !totalCans) return 0;
        return Math.round((getTotalAttackDice() / totalCans) * 100) / 100;
    }
    
    function getSurvivabilityRating() {
        if (!vehicles || !vehicles.length || !totalCans) return 0;
        return Math.round((getTotalHull() / totalCans) * 100) / 100;
    }
    
    function getMobilityScore() {
        if (!vehicles || !vehicles.length) return 0;
        
        let totalGear = 0;
        let totalHandling = 0;
        
        for (const vehicle of vehicles) {
            const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
            totalGear += vehicleType?.maxGear || 0;
            totalHandling += calculateHandling(vehicle);
        }
        
        const avgGear = totalGear / vehicles.length;
        const avgHandling = totalHandling / vehicles.length;
        
        return Math.round((avgGear * 0.6 + avgHandling * 0.4) * 10) / 10;
    }
    
    function getSlotEfficiency() {
        if (!vehicles || !vehicles.length) return 0;
        
        let usedSlots = 0;
        let vehicleBaseSlots = 0; // Base slots from vehicle types
        let slotModifiers = 0;   // Modifiers from upgrades with negative slots
        
        for (const vehicle of vehicles) {
            const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
            if (!vehicleType) continue;
            
            // Track base vehicle slots
            const baseSlots = vehicleType.buildSlots || 0;
            vehicleBaseSlots += baseSlots;
            
            let vehicleUsedSlots = 0;
            let vehicleSlotModifiers = 0;
            
            // Add weapon slots
            if (vehicle.weapons) {
                for (const weaponId of vehicle.weapons) {
                    const baseWeaponId = findBaseWeaponId(weaponId);
                        
                    if (['handgun', 'molotov', 'grenades', 'ram', 'oil_slick', 'smokescreen'].includes(baseWeaponId)) {
                        continue;
                    }
                    
                    const weaponObj = weapons.find(w => w.id === baseWeaponId);
                    if (weaponObj && weaponObj.slots) {
                        vehicleUsedSlots += weaponObj.slots;
                    }
                }
            }
            
            // Process upgrade slots
            if (vehicle.upgrades) {
                for (const upgradeId of vehicle.upgrades) {
                    if (['grenades'].includes(upgradeId)) {
                        continue;
                    }
                    
                    const upgradeObj = upgrades.find(u => u.id === upgradeId);
                    if (upgradeObj && upgradeObj.slots) {
                        // If slots are negative, it's a modifier that increases total slots
                        if (upgradeObj.slots < 0) {
                            vehicleSlotModifiers += Math.abs(upgradeObj.slots);
                        } else {
                            // Positive slots count as used
                            vehicleUsedSlots += upgradeObj.slots;
                        }
                    }
                }
            }
            
            usedSlots += vehicleUsedSlots;
            slotModifiers += vehicleSlotModifiers;
        }
        
        // Total available slots = base slots + slot modifiers from upgrades
        const totalSlots = vehicleBaseSlots + slotModifiers;
        
        return totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
    }
    
    // Weapon analysis
    function getWeaponRanges() {
        const ranges = { short: 0, medium: 0, long: 0, double: 0, template: 0, dropped: 0, burst: 0 };
        
        if (!vehicles || !vehicles.length) return ranges;
        
        for (const vehicle of vehicles) {
            if (!vehicle.weapons) continue;
            
            for (const weaponId of vehicle.weapons) {
                const baseWeaponId = findBaseWeaponId(weaponId);
                const weaponObj = weapons.find(w => w.id === baseWeaponId);
                
                if (weaponObj) {
                    if (weaponObj.range?.includes('Template')) {
                        ranges.template++;
                    } else if (weaponObj.range?.includes('Dropped')) {
                        ranges.dropped++;
                    } else if (weaponObj.range?.includes('Burst')) {
                        ranges.burst++;
                    } else if (weaponObj.range?.includes('Short')) {
                        ranges.short++;
                    } else if (weaponObj.range?.includes('Medium')) {
                        ranges.medium++;
                    } else if (weaponObj.range?.includes('Long')) {
                        ranges.long++;
                    } else if (weaponObj.range?.includes('Double')) {
                        ranges.double++;
                    }
                }
            }
        }
        
        return ranges;
    }
    
    function getElectricalBalance() {
        let electrical = 0;
        let nonElectrical = 0;
        
        if (!vehicles || !vehicles.length) return { electrical, nonElectrical };
        
        for (const vehicle of vehicles) {
            if (!vehicle.weapons) continue;
            
            for (const weaponId of vehicle.weapons) {
                const baseWeaponId = findBaseWeaponId(weaponId);
                const weaponObj = weapons.find(w => w.id === baseWeaponId);
                
                if (weaponObj) {
                    if (weaponObj.electrical) {
                        electrical++;
                    } else {
                        nonElectrical++;
                    }
                }
            }
        }
        
        return { electrical, nonElectrical };
    }
    
    // Weight classes
    function getVehicleWeight(vehicle) {
        if (!vehicle) return "Middleweight";
        const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
        return vehicleType?.weight || "Middleweight";
    }
    
    function getWeightDistribution() {
        // Use weight class names instead of numbers
        const weights = { 
            "Lightweight": 0, 
            "Middleweight": 0, 
            "Heavyweight": 0, 
            "Massive": 0,
            "Other": 0
        };
        
        if (!vehicles || !vehicles.length) return weights;
        
        for (const vehicle of vehicles) {
            const weight = getVehicleWeight(vehicle);
            
            // Handle string weights directly
            if (typeof weight === 'string') {
                if (weights[weight] !== undefined) {
                    weights[weight]++;
                } else {
                    weights["Other"]++;
                }
            } 
            // Fallback for legacy numeric weights
            else if (typeof weight === 'number') {
                // Map the old number values to the string weight classes
                if (weight === 0) weights["Lightweight"]++;
                else if (weight === 1) weights["Middleweight"]++;
                else if (weight === 2) weights["Heavyweight"]++;
                else if (weight === 3) weights["Massive"]++;
                else weights["Other"]++;
            }
        }
        
        return weights;
    }
    
    // Special abilities
    function getSpecialRules() {
        const specialRules = new Map(); // Use Map to store id -> ruleName pairs
        
        if (!vehicles || !vehicles.length) return [];
        
        for (const vehicle of vehicles) {
            const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
            if (vehicleType?.specialRules) {
                vehicleType.specialRules.split(',').forEach(ruleId => {
                    const trimmedId = ruleId.trim();
                    // Find the rule details to get the human-readable name
                    const ruleDetails = vehicleRules.find(r => r.id === trimmedId);
                    if (ruleDetails) {
                        specialRules.set(trimmedId, ruleDetails.ruleName);
                    } else {
                        // Fallback to the ID if no rule found
                        specialRules.set(trimmedId, trimmedId);
                    }
                });
            }
        }
        
        // Return just the human-readable names
        return Array.from(specialRules.values());
    }
    
    // Coach suggestions
    function getSuggestions() {
        const suggestions = [];
        
        if (!vehicles || !vehicles.length) return suggestions;
        
        // Combat suggestions
        const combatIndex = getCombatEffectivenessIndex();
        if (combatIndex < 0.25) {
            suggestions.push("Your team has low attack power. Consider adding more weapons or weapons with higher attack dice.");
        }
        
        // Range suggestions
        const ranges = getWeaponRanges();
        const totalWeapons = Object.values(ranges).reduce((a, b) => a + b, 0);
        
        if (totalWeapons > 0) {
            // Only suggest long-range weapons if team has neither long-range nor double-range weapons
            if (ranges.long === 0 && ranges.double === 0) {
                suggestions.push("Your team lacks long-range weapons. Consider adding a harpoon or rockets for range advantage.");
            }
            
            if (ranges.dropped === 0 && ranges.template === 0) {
                suggestions.push("Consider adding area effect weapons (dropped or template) for better crowd control.");
            }
        }
        
        // Weight suggestions
        const weights = getWeightDistribution();
        if (weights["Lightweight"] + weights["Middleweight"] === 0) {
            suggestions.push("Your team lacks lighter vehicles. Consider adding at least one lightweight vehicle for objectives.");
        }
        if (weights["Heavyweight"] + weights["Massive"] === 0) {
            suggestions.push("Your team has no heavyweight vehicles, which may be vulnerable in collisions.");
        }
        
        // Electrical balance
        const { electrical, nonElectrical } = getElectricalBalance();
        if (currentSponsor?.electrical && electrical === 0) {
            suggestions.push(`${currentSponsor.name} favors electrical weapons, but you have none in your team.`);
        }
        
        // Slot efficiency
        const slotEfficiency = getSlotEfficiency();
        if (slotEfficiency < 70) {
            suggestions.push(`Your build slot usage is only ${slotEfficiency}%. Consider adding more upgrades or weapons.`);
        }
        
        // Max cans usage
        const canEfficiency = Math.round((totalCans / maxCans) * 100);
        if (canEfficiency < 90) {
            suggestions.push(`You're only using ${canEfficiency}% of your available cans. Consider upgrading your vehicles.`);
        }
        
        // Balance suggestions
        if (vehicles.length > 0) {
            const mostExpensiveVehicle = vehicles.reduce((max, vehicle) => {
                const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
                const cost = vehicleType?.baseCost || 0;
                return cost > max.cost ? { vehicle, cost } : max;
            }, { vehicle: null, cost: 0 });
            
            if (mostExpensiveVehicle.cost > totalCans * 0.5) {
                suggestions.push("You have a very expensive flagship vehicle. Consider balancing your investment across more vehicles.");
            }
        }
        
        return suggestions;
    }
    
    // Automatically refresh metrics when props change
    $: refreshTime = Date.now();
</script>

<div class="mt-6 bg-stone-100 dark:bg-gray-700 p-4 rounded-lg" in:fade={{ duration: 200 }}>
    <div class="flex flex-wrap justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-stone-800 dark:text-white">Gaslands Coach</h3>
        <div class="flex items-center space-x-2">
            <div class="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 py-1 px-3 rounded-full">
                {totalCans} / {maxCans} cans ({Math.round((totalCans / maxCans) * 100)}%)
            </div>
        </div>
    </div>
    
    <!-- Main Metrics Dashboard -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
            <div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Combat Effectiveness</div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400">
                <Tooltip 
                    text={getCombatEffectivenessIndex().toFixed(2)}
                    content="<strong>Combat Effectiveness</strong><p>Measures attack power per can spent. Higher is better.</p><p>Improve by adding weapons with more attack dice or removing inefficient weapons.</p><p>Aim for: 0.5+ (decent) or 0.7+ (excellent)</p>"
                />
                <span class="text-xs text-stone-500 dark:text-gray-400">dice/can</span>
            </div>
        </div>
        
        <div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
            <div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Survivability</div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400">
                <Tooltip 
                    text={getSurvivabilityRating().toFixed(2)}
                    content="<strong>Survivability</strong><p>Measures hull points per can spent. Higher is better.</p><p>Improve by adding armor upgrades or choosing vehicles with better hull-to-cost ratio.</p><p>Aim for: 0.6+ (decent) or 0.8+ (excellent)</p>"
                />
                <span class="text-xs text-stone-500 dark:text-gray-400">hull/can</span>
            </div>
        </div>
        
        <div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
            <div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Mobility Score</div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400">
                <Tooltip 
                    text={getMobilityScore().toFixed(1)}
                    content="<strong>Mobility Score</strong><p>Combines max gear and handling stats. Higher is better.</p><p>Improve by adding handling upgrades or choosing faster vehicles.</p><p>Aim for: 6+ (decent) or 8+ (excellent)</p>"
                />
                <span class="text-xs text-stone-500 dark:text-gray-400">/10</span>
            </div>
        </div>
        
        <div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
            <div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Slot Efficiency</div>
            <div class="text-xl font-bold text-amber-600 dark:text-amber-400">
                <Tooltip 
                    text={getSlotEfficiency() + '%'}
                    content="<strong>Slot Efficiency</strong><p>Percentage of available weapon/upgrade slots used. Higher is better.</p><p>Upgrade slots are modified by certain upgrades that provide additional slots (shown with negative slot values).</p><p>Improve by filling empty slots with weapons or upgrades.</p><p>Aim for: 70%+ (decent) or 90%+ (excellent)</p>"
                />
            </div>
        </div>
    </div>
    
    <!-- Detailed Analysis Sections -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Combat Analysis -->
        <div class="bg-stone-200 dark:bg-gray-600 p-4 rounded-lg">
            <h4 class="text-sm font-bold text-stone-800 dark:text-white mb-3 pb-2 border-b border-stone-300 dark:border-gray-500">Combat Analysis</h4>
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Attack Dice</div>
                    <div class="mt-1 flex items-center">
                        <span class="font-bold">{getTotalAttackDice()}</span>
                        <span class="ml-2 text-xs text-stone-500 dark:text-gray-400">total</span>
                    </div>
                </div>
                
                <div>
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Weapons</div>
                    <div class="mt-1 flex items-center">
                        <span class="font-bold">{vehicles.reduce((total, v) => total + (v.weapons?.length || 0), 0)}</span>
                        <span class="ml-2 text-xs text-stone-500 dark:text-gray-400">total</span>
                    </div>
                </div>
                
                {#if getElectricalBalance().electrical > 0 || getElectricalBalance().nonElectrical > 0}
                    <div>
                        <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Electrical</div>
                        <div class="mt-1 flex items-center">
                            <span class="font-bold">{getElectricalBalance().electrical}</span>
                            <span class="ml-2 text-xs text-stone-500 dark:text-gray-400">weapons</span>
                        </div>
                    </div>
                    
                    <div>
                        <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Standard</div>
                        <div class="mt-1 flex items-center">
                            <span class="font-bold">{getElectricalBalance().nonElectrical}</span>
                            <span class="ml-2 text-xs text-stone-500 dark:text-gray-400">weapons</span>
                        </div>
                    </div>
                {/if}
            </div>
            
            <!-- Weapon Range Distribution -->
            {#if Object.values(getWeaponRanges()).reduce((a, b) => a + b, 0) > 0}
                <div class="mt-4">
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold mb-2">Range Distribution</div>
                    <div class="flex flex-wrap gap-2">
                        {#if getWeaponRanges().short > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Short: {getWeaponRanges().short}
                            </div>
                        {/if}
                        {#if getWeaponRanges().medium > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Medium: {getWeaponRanges().medium}
                            </div>
                        {/if}
                        {#if getWeaponRanges().long > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Long: {getWeaponRanges().long}
                            </div>
                        {/if}
                        {#if getWeaponRanges().double > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Double: {getWeaponRanges().double}
                            </div>
                        {/if}
                        {#if getWeaponRanges().burst > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Burst: {getWeaponRanges().burst}
                            </div>
                        {/if}
                        {#if getWeaponRanges().template > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Template: {getWeaponRanges().template}
                            </div>
                        {/if}
                        {#if getWeaponRanges().dropped > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Dropped: {getWeaponRanges().dropped}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
        
        <!-- Survivability Analysis -->
        <div class="bg-stone-200 dark:bg-gray-600 p-4 rounded-lg">
            <h4 class="text-sm font-bold text-stone-800 dark:text-white mb-3 pb-2 border-b border-stone-300 dark:border-gray-500">Survivability Analysis</h4>
            
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Total Hull</div>
                    <div class="mt-1 flex items-center">
                        <span class="font-bold">{getTotalHull()}</span>
                        <span class="ml-2 text-xs text-stone-500 dark:text-gray-400">points</span>
                    </div>
                </div>
                
                <div>
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Avg. Handling</div>
                    <div class="mt-1 flex items-center">
                        <span class="font-bold">
                            {vehicles.length ? (vehicles.reduce((sum, v) => sum + calculateHandling(v), 0) / vehicles.length).toFixed(1) : 0}
                        </span>
                    </div>
                </div>
                
                <div>
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Total Vehicles</div>
                    <div class="mt-1 flex items-center">
                        <span class="font-bold">{vehicles.length}</span>
                    </div>
                </div>
                
                <div>
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold">Avg. Gear</div>
                    <div class="mt-1 flex items-center">
                        <span class="font-bold">
                            {vehicles.length ? (vehicles.reduce((sum, v) => {
                                const vehicleType = vehicleTypes.find(vt => vt.id === v.type);
                                return sum + (vehicleType?.maxGear || 0);
                            }, 0) / vehicles.length).toFixed(1) : 0}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Weight Class Distribution -->
            {#if getWeightDistribution()["Lightweight"] > 0 || 
                getWeightDistribution()["Middleweight"] > 0 || 
                getWeightDistribution()["Heavyweight"] > 0 || 
                getWeightDistribution()["Massive"] > 0 ||
                getWeightDistribution()["Other"] > 0}
                <div class="mt-4">
                    <div class="text-xs text-stone-600 dark:text-gray-300 font-semibold mb-2">Weight Classes</div>
                    <div class="flex flex-wrap gap-2">
                        {#if getWeightDistribution()["Lightweight"] > 0}
                            <div class="py-1 px-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                                Lightweight: {getWeightDistribution()["Lightweight"]}
                            </div>
                        {/if}
                        {#if getWeightDistribution()["Middleweight"] > 0}
                            <div class="py-1 px-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                                Middleweight: {getWeightDistribution()["Middleweight"]}
                            </div>
                        {/if}
                        {#if getWeightDistribution()["Heavyweight"] > 0}
                            <div class="py-1 px-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-xs">
                                Heavyweight: {getWeightDistribution()["Heavyweight"]}
                            </div>
                        {/if}
                        {#if getWeightDistribution()["Massive"] > 0}
                            <div class="py-1 px-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs">
                                Massive: {getWeightDistribution()["Massive"]}
                            </div>
                        {/if}
                        {#if getWeightDistribution()["Other"] > 0}
                            <div class="py-1 px-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs">
                                Other: {getWeightDistribution()["Other"]}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    </div>
    
    <!-- Special Rules Section -->
    {#if getSpecialRules().length > 0}
        <div class="bg-stone-200 dark:bg-gray-600 p-4 rounded-lg mb-6">
            <h4 class="text-sm font-bold text-stone-800 dark:text-white mb-3">Special Abilities</h4>
            <div class="flex flex-wrap gap-2">
                {#each getSpecialRules() as rule}
                    <div class="py-1 px-2 bg-stone-300 dark:bg-gray-500 text-stone-800 dark:text-white rounded text-xs">
                        {rule}
                    </div>
                {/each}
            </div>
        </div>
    {/if}
    
    <!-- Coach Suggestions -->
    {#if getSuggestions().length > 0}
        <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <h4 class="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Coach Suggestions
            </h4>
            <ul class="space-y-2">
                {#each getSuggestions() as suggestion}
                    <li class="text-sm text-amber-700 dark:text-amber-300 flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {suggestion}
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>