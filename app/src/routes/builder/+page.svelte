<!-- Updated from the content provided by the user - Refactored with VehicleCard component -->
<script lang="ts">
	import { nanoid } from 'nanoid';
	import { validateDraft } from '$lib/validate';
	import type { Draft, Validation } from '$lib/validate/model';
	import { encodeDraft, decodeDraft } from '$lib/draft/io';
	import { goto } from '$app/navigation';
	import { draftToDataURL } from '$lib/draft/qr';
	import Auth from '$lib/components/Auth.svelte';
import SettingsMenu from '$lib/components/SettingsMenu.svelte';
	import VehicleCard from '$lib/components/VehicleCard.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	// Using new print approach - fixed import to avoid module collision with the function name
	import { printTeam as printServiceFunc } from '$lib/components/printing/PrintService-new';
	import { user } from '$lib/firebase';
import { getUserSettings, saveUserSettings, DEFAULT_SETTINGS } from '$lib/services/settings';
import { saveTeam, getUserTeams } from '$lib/services/team';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import '../../print.css';

	/* ---------- server data ---------- */
	export let data: {
		sponsors: import('$lib/rules/types').Sponsor[];
		vehicleTypes: import('$lib/rules/types').Vehicle[];
		weapons: import('$lib/rules/types').Weapon[];
		upgrades: import('$lib/rules/types').Upgrade[];
		perks: import('$lib/rules/types').Perk[];
		vehicleRules: import('$lib/rules/types').VehicleRule[];
	};
	const { sponsors, vehicleTypes, weapons, upgrades, perks, vehicleRules } = data;
  
	console.log('vehicleTypes', vehicleTypes);
  
	/* ---------- settings ---------- */
	let includeAdvanced = true;
	let enableSponsorships = true;
	let darkMode = false;
	let printStyle = 'classic';
	let hasRules = false; // Whether user has acknowledged having the Gaslands Refuelled rules
		let showExperimentalFeatures = false; // Whether to show experimental features
		let receiveUpdates = false; // Whether user wants to receive updates and marketing emails
	let showOnPlayersMap = false; // Whether to show on the Gaslands Players map
	let allowContactFromPlayers = false; // Whether other players can contact for game setup
	let location = ''; // User's location for the players map
	let showEquipmentDescriptions = true; // Whether to show equipment descriptions in printouts
	let showPerkDescriptions = true; // Whether to show perk descriptions in printouts

	// Rules acknowledgment modal state
	let showRulesAcknowledgmentModal = false;
	let rulesModalAction = ''; // To track which action triggered the rules modal

	// Load settings on mount
	onMount(async () => {
		// Only try to load settings if user is authenticated
		if ($user) {
			const { success, settings } = await getUserSettings();
			if (success && settings) {
				includeAdvanced = settings.includeAdvanced;
				enableSponsorships = settings.enableSponsorships;
				darkMode = settings.darkMode;
				printStyle = settings.printStyle || 'classic';
				hasRules = settings.hasRules ?? DEFAULT_SETTINGS.hasRules;
				showEquipmentDescriptions = settings.showEquipmentDescriptions ?? DEFAULT_SETTINGS.showEquipmentDescriptions;
				showPerkDescriptions = settings.showPerkDescriptions ?? DEFAULT_SETTINGS.showPerkDescriptions;
			}
		} else {
			// Use default settings when not authenticated
			includeAdvanced = DEFAULT_SETTINGS.includeAdvanced;
			enableSponsorships = DEFAULT_SETTINGS.enableSponsorships;
			darkMode = DEFAULT_SETTINGS.darkMode;
			printStyle = DEFAULT_SETTINGS.printStyle || 'classic';
			hasRules = DEFAULT_SETTINGS.hasRules;
			showEquipmentDescriptions = DEFAULT_SETTINGS.showEquipmentDescriptions;
			showPerkDescriptions = DEFAULT_SETTINGS.showPerkDescriptions;
		}
	});

	// Filter vehicle types based on includeAdvanced setting
	$: filteredVehicleTypes = includeAdvanced 
		? vehicleTypes 
		: vehicleTypes.filter(v => !v.advanced);
	// Sort all data alphabetically
	$: sortedSponsors = [...sponsors].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedVehicleTypes = [...filteredVehicleTypes].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedWeapons = [...weapons].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedUpgrades = [...upgrades].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedPerks = [...perks].sort((a, b) => a.name.localeCompare(b.name));

	/* ---------- UI state ---------- */
	// Find "No Sponsor" ID or use first sponsor as fallback
	let sponsorId: string = sponsors.find(s => s.id === 'no_sponsor')?.id ?? sponsors[0]?.id ?? '';
	let validation: Validation = { cans: 0, errors: [], vehicleReports: [] };
	type Veh = { 
		id: string; 
		type: string; 
		name: string; 
		weapons: string[]; 
		weaponFacings?: Record<string, string>;
		upgrades: string[]; 
		perks: string[] 
	};
	let vehicles: Veh[] = [];
	// Track hazard tokens for each vehicle
	let vehicleHazards: Record<string, number> = {};



	function calculateUsedBuildSlots(vehicle) {
		let totalSlots = 0;
		
		// Calculate slots used by weapons
		for (const weaponInstanceId of vehicle.weapons) {
			const lastUnderscoreIndex = weaponInstanceId.lastIndexOf('_');
				const baseWeaponId = lastUnderscoreIndex !== -1 ? 
					weaponInstanceId.substring(0, lastUnderscoreIndex) : 
					weaponInstanceId;
			const weaponObj = weapons.find(w => w.id === baseWeaponId);
			if (weaponObj) {
				// Special case: Some weapons don't use build slots in Gaslands Refueled
				if (['handgun', 'molotov', 'grenades', 'ram', 'oil_slick', 'smokescreen'].includes(baseWeaponId)) {
					// These weapons don't consume build slots
					continue;
				}
                    // Just use the slots field directly
                    totalSlots += weaponObj.slots;
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
                    // Just use the slots field directly
                    totalSlots += upgradeObj.slots;
			}
		}
		
		return totalSlots;
	}

	function addVehicle(type = 'car') {
		console.log('addVehicle called');
		// Make sure we have a valid vehicle type
		const vt = vehicleTypes.find((v) => v.id === type);
		if (!vt) {
			console.error("No valid vehicle type found", type, vehicleTypes);

			// Car type not found, look for a fallback
			const carType = vehicleTypes.find(v => v.id === 'car');

			// If car type is available, use it
			if (carType) {
				return addVehicle('car');
			}

			// Otherwise, try to use the first available vehicle type
			if (vehicleTypes.length > 0) {
				return addVehicle(vehicleTypes[0].id);
			}
			return; // Can't add a vehicle without a type
		}
		
		const newVehicleId = nanoid(6);
		
		// Create the new vehicle
		const newVehicle = {
			id: newVehicleId,
			type: vt.id,
			name: `New ${vt.name}`,
			weapons: [],
			weaponFacings: {},
			upgrades: [],
			perks: []
		};
		
		// Add to vehicles list - ensure reactivity by creating a new array
		vehicles = [...vehicles, newVehicle];
		console.log('vehicles', vehicles);
		
		// For immediate UI feedback, manually update the validation
		// Create a basic vehicle report with just the base cost
		if (validation && validation.vehicleReports) {
			const newVehicleReport = {
				vehicleId: newVehicleId,
				cans: vt.baseCost || 0,
				errors: []
			};
			
			// Update the validation object
			validation.vehicleReports = [...validation.vehicleReports, newVehicleReport];
			validation.cans += newVehicleReport.cans;
			
			// Ensure reactivity by forcing the update
			validation = { ...validation };
		}
		
		// Log the current state to verify
		console.log("Added new vehicle", newVehicle);
		console.log("Current vehicles", vehicles.length);
		
		// Also trigger a full validation
		forceValidation();
	}

	function removeVehicle(id: string) {
		// Find vehicle report to subtract its cost from total
		const vehicleReport = validation.vehicleReports.find(r => r.vehicleId === id);
		const vehicleCost = vehicleReport ? vehicleReport.cans : 0;

		// Remove the vehicle
		vehicles = vehicles.filter((v) => v.id !== id);

		// Update validation report
		validation.vehicleReports = validation.vehicleReports.filter(r => r.vehicleId !== id);
		validation.cans -= vehicleCost;

		// Ensure validation object is reactive
		validation = { ...validation };

		// Handle collapse state
		collapsedVehicles.delete(id);
		collapsedVehicles = collapsedVehicles; // Trigger reactivity

		// Force full validation to ensure consistency
		forceValidation();
	}

	function cloneVehicle(id: string) {
		const sourceVehicle = vehicles.find(v => v.id === id);
		if (!sourceVehicle) return;

		// Generate new IDs for the cloned vehicle and its weapons
		const clonedVehicleId = nanoid(6);
		const clonedWeaponFacings: Record<string, string> = {};

		// Clone the weapons with new instance IDs
		const clonedWeapons = sourceVehicle.weapons.map(weaponId => {
			// Extract the base weapon ID - keeping all parts except the last one (the unique identifier)
			const baseWeaponId = weaponId.includes('_')
              ? weaponId.split('_')[0]
              : weaponId;
			const newWeaponId = `${baseWeaponId}_${nanoid(4)}`;

			// Copy the facing for this weapon
			if (sourceVehicle.weaponFacings && sourceVehicle.weaponFacings[weaponId]) {
				clonedWeaponFacings[newWeaponId] = sourceVehicle.weaponFacings[weaponId];
			}

			return newWeaponId;
		});

		// Create the cloned vehicle
		const clonedVehicle = {
			id: clonedVehicleId,
			type: sourceVehicle.type,
			name: `${sourceVehicle.name} (Clone)`,
			weapons: clonedWeapons,
			weaponFacings: clonedWeaponFacings,
			upgrades: [...sourceVehicle.upgrades],
			perks: [...sourceVehicle.perks]
		};

		// Add the cloned vehicle to the vehicles array
		vehicles = [...vehicles, clonedVehicle];
		
		// For immediate UI feedback, manually update the validation
		// Find the source vehicle report to copy its values
		if (validation && validation.vehicleReports) {
			const sourceReport = validation.vehicleReports.find(r => r.vehicleId === sourceVehicle.id);
			if (sourceReport) {
				const clonedReport = {
					vehicleId: clonedVehicleId,
					cans: sourceReport.cans,
					errors: [...sourceReport.errors]
				};
				
				// Update the validation object
				validation.vehicleReports = [...validation.vehicleReports, clonedReport];
				validation.cans += clonedReport.cans;
			}
		}
		
		// Also trigger a full validation
		forceValidation();
	}
	
	function toggleVehicleCollapse(id: string) {
		if (collapsedVehicles.has(id)) {
			collapsedVehicles.delete(id);
		} else {
			collapsedVehicles.add(id);
		}
		collapsedVehicles = collapsedVehicles; // Trigger reactivity
	}

	function addWeapon(vehicleId: string, weaponId: string, facing?: string) {
		const weaponObj = weapons.find(w => w.id === weaponId);
		if (!weaponObj) return; // Don't add if weapon not found

		// Check if adding this weapon would exceed the vehicle's build slots
		const vehicle = vehicles.find(v => v.id === vehicleId);
		if (!vehicle) return; // Don't add if vehicle not found

		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return; // Don't add if vehicle type not found

		// Validate electrical weapons - only allow if sponsor supports them
		if (weaponObj.electrical && !(currentSponsor?.electrical)) {
			console.warn(`Cannot add electrical weapon ${weaponObj.name} - current sponsor doesn't support electrical weapons`);
			return; // Do not add the weapon if it's electrical but sponsor doesn't support it
		}

		// Update vehicle report for immediate UI feedback
		const vehicleReport = validation.vehicleReports.find(r => r.vehicleId === vehicleId);
		if (vehicleReport) {
			// Subtract vehicle's current cost, then add it back after weapon is added
			validation.cans -= vehicleReport.cans;
		}
		
		const currentBuildSlots = calculateUsedBuildSlots(vehicle);
		const weaponSlots = weaponObj.slots;
		
		// Skip buildSlot validation for free weapons
		const isSpecialFreeWeapon = ['handgun', 'molotov', 'grenades', 'ram', 'oil_slick', 'smokescreen'].includes(weaponObj.id) || weaponSlots === 0;
		
		// Validate build slots unless it's a free weapon or the vehicle has 0 build slots (unlimited)
		if (!isSpecialFreeWeapon && vehicleType.buildSlots > 0 && currentBuildSlots + weaponSlots > vehicleType.buildSlots) {
			console.warn(`Cannot add weapon ${weaponObj.name} - exceeds build slot limit`);
			return; // Do not add the weapon if it would exceed build slots
		}
		
		// Apply weapon facing rules:
		// 1. Crew Fired weapons are always 360° (any)
		// 2. Dropped weapons (range includes 'Dropped') are rear or side only (default to rear)
		// 3. Fixed facing weapons use their specified facing
		// 4. Otherwise use provided facing or default to front
		let actualFacing = 'front';

		if (weaponObj.specialRules && weaponObj.specialRules.toUpperCase().includes("CREW FIRED")) {
			actualFacing = 'any'; // Crew fired weapons are always 360°
		} else if (weaponObj.dropped || (weaponObj.range && weaponObj.range.includes('Dropped'))) {
			actualFacing = 'rear'; // Dropped weapons default to rear
		} else if (weaponObj.facing && weaponObj.facing !== 'any') {
			actualFacing = weaponObj.facing; // Use fixed facing
		} else if (facing) {
			actualFacing = facing; // Use provided facing
		}
		
		vehicles = vehicles.map(v => {
			if (v.id === vehicleId) {
				// Generate a unique ID for this weapon instance
				// Make sure the nanoid is always at the end, even if the original weaponId contains underscores
				const weaponInstanceId = `${weaponId}_${nanoid(4)}`;
				return { 
					...v, 
					weapons: [...v.weapons, weaponInstanceId],
					weaponFacings: { 
						...(v.weaponFacings || {}), 
						[weaponInstanceId]: actualFacing 
					}
				};
			}
			return v;
		});
	}

	function removeWeapon(vehicleId: string, weaponIndex: number) {
		vehicles = vehicles.map(v => {
			if (v.id === vehicleId) {
				// Get the weapon ID to remove
				const weaponIdToRemove = v.weapons[weaponIndex];
				
				// Create a new facings object without the removed weapon
				const newFacings = { ...(v.weaponFacings || {}) };
				delete newFacings[weaponIdToRemove];
				
				return { 
					...v, 
					weapons: v.weapons.filter((_, idx) => idx !== weaponIndex),
					weaponFacings: newFacings
				};
			}
			return v;
		});
	}

	function addUpgrade(vehicleId: string, upgradeId: string) {
		const upgradeObj = upgrades.find(u => u.id === upgradeId);
		if (!upgradeObj) return; // Don't add if upgrade not found

		// Check if adding this upgrade would exceed the vehicle's build slots
		const vehicle = vehicles.find(v => v.id === vehicleId);
		if (!vehicle) return; // Don't add if vehicle not found

		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return; // Don't add if vehicle type not found

		// Validate electrical upgrades - only allow if sponsor supports them
		if (upgradeObj.electrical && !(currentSponsor?.electrical)) {
			console.warn(`Cannot add electrical upgrade ${upgradeObj.name} - current sponsor doesn't support electrical upgrades`);
			return; // Do not add the upgrade if it's electrical but sponsor doesn't support it
		}
		
		const currentBuildSlots = calculateUsedBuildSlots(vehicle);
		const upgradeSlots = upgradeObj.slots;
		
		// Skip buildSlot validation for free upgrades
		const isSpecialFreeUpgrade = ['grenades'].includes(upgradeObj.id) || upgradeSlots === 0;
		
		// Validate build slots unless it's a free upgrade or the vehicle has 0 build slots (unlimited)
		if (!isSpecialFreeUpgrade && vehicleType.buildSlots > 0 && currentBuildSlots + upgradeSlots > vehicleType.buildSlots) {
			console.warn(`Cannot add upgrade ${upgradeObj.name} - exceeds build slot limit`);
			return; // Do not add the upgrade if it would exceed build slots
		}
		
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, upgrades: [...v.upgrades, upgradeId] } :
			v
		);
	}

	function removeUpgrade(vehicleId: string, upgradeIndex: number) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, upgrades: v.upgrades.filter((_, idx) => idx !== upgradeIndex) } :
			v
		);
	}

	function addPerk(vehicleId: string, perkId: string) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, perks: [...v.perks, perkId] } :
			v
		);
	}

	function removePerk(vehicleId: string, perkIndex: number) {
		vehicles = vehicles.map(v =>
			v.id === vehicleId ?
			{ ...v, perks: v.perks.filter((_, idx) => idx !== perkIndex) } :
			v
		);
	}

	// Calculate max hull points including modifiers from upgrades and perks
	function calculateMaxHull(vehicle): number {
		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return 0;

		let maxHull = vehicleType.maxHull;

		// Add hull points from upgrades
		for (const upgradeId of vehicle.upgrades) {
			const upgrade = upgrades.find(u => u.id === upgradeId);
			if (upgrade) {
				// Use the hull property if present
				if (upgrade.hull) {
					maxHull += upgrade.hull;
				}
				// Keep backward compatibility for armor upgrade
				else if (upgradeId === 'armor') {
					maxHull += 1;
				}
			}
		}

		// Add hull points from perks (if any)
		for (const perkId of vehicle.perks) {
			// Add any perks that affect hull here
			// For example: if (perkId === 'fortified' || perkId === 'tank_commander') maxHull += 1;
		}

		return maxHull;
	}

	// Calculate handling with modifiers from upgrades
	function calculateHandling(vehicle): number {
		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return 0;

		let handling = vehicleType.handling || 4; // Default to 4 if not specified

		// Add handling modifiers from upgrades
		for (const upgradeId of vehicle.upgrades) {
			const upgrade = upgrades.find(u => u.id === upgradeId);
			if (upgrade && upgrade.handling) {
				handling += upgrade.handling;
			}
		}

		return handling;
	}

	// Calculate max gear with modifiers from upgrades
	function calculateMaxGear(vehicle): number {
		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return 0;

		let maxGear = vehicleType.maxGear;

		// Add gear modifiers from upgrades
		for (const upgradeId of vehicle.upgrades) {
			const upgrade = upgrades.find(u => u.id === upgradeId);
			if (upgrade && upgrade.gear) {
				maxGear += upgrade.gear;
			}
		}

		return maxGear;
	}

	// Calculate crew with modifiers from upgrades
	function calculateCrew(vehicle): number {
		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return 0;

		let crew = vehicleType.crew || 1; // Default to 1 if not specified

		// Add crew modifiers from upgrades
		for (const upgradeId of vehicle.upgrades) {
			const upgrade = upgrades.find(u => u.id === upgradeId);
			if (upgrade && upgrade.crew) {
				crew += upgrade.crew;
			}
		}

		// Ensure crew doesn't go below zero
		return Math.max(0, crew);
	}

	function calculateTotalAttackDice(vehicle): number {
		if (!vehicle || !vehicle.weapons || vehicle.weapons.length === 0) return 0;

		let totalAttackDice = 0;

		// Calculate total attack dice from all weapons
		for (const weaponInstanceId of vehicle.weapons) {
			const lastUnderscoreIndex = weaponInstanceId.lastIndexOf('_');
				const baseWeaponId = lastUnderscoreIndex !== -1 ? 
					weaponInstanceId.substring(0, lastUnderscoreIndex) : 
					weaponInstanceId;
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

	// Hazard token management
	function getHazardCount(vehicleId: string): number {
		return vehicleHazards[vehicleId] || 0;
	}

	function incrementHazard(vehicleId: string) {
		vehicleHazards = {
			...vehicleHazards,
			[vehicleId]: getHazardCount(vehicleId) + 1
		};
	}

	function decrementHazard(vehicleId: string) {
		if (getHazardCount(vehicleId) > 0) {
			vehicleHazards = {
				...vehicleHazards,
				[vehicleId]: getHazardCount(vehicleId) - 1
			};
		}
	}

	/* ---------- modals & menu state ---------- */
	// For settings and modals that need persistence
	let qrDataUrl: string | null = null;
	let showQRModal = false; // Whether to show the QR code modal
	let showImportModal = false;
	let showSettingsModal = false;
	let activeSettingsTab = 'general'; // Which tab to show in settings: 'general' or 'print'
	let quickSaving = false;
	
	// Update modal background color based on dark mode
	$: if (showSettingsModal) {
		setTimeout(() => {
			const modal = document.querySelector('.settings-modal-content');
			if (modal) {
				if (darkMode) {
					modal.style.backgroundColor = '#1f2937';
				} else {
					modal.style.backgroundColor = 'white';
				}
			}
		}, 0);
	}
	let showTeamsModal = false;
	let showMenu = false;
	let showShareMenu = false;
	
	// Add click outside handler for the share menu
	onMount(() => {
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
		
		// Load user settings from Firebase if user is logged in
		const unsubscribe = user.subscribe(async currentUser => {
			if (currentUser) {
				try {
					const result = await getUserSettings();
					if (result.success && result.settings) {
						enableSponsorships = result.settings.enableSponsorships;
						includeAdvanced = result.settings.includeAdvanced;
						darkMode = result.settings.darkMode;
						hasRules = result.settings.hasRules ?? DEFAULT_SETTINGS.hasRules;

						// Initialize new settings with defaults if not present
						showTeamSummary = result.settings.showTeamSummary !== undefined
							? result.settings.showTeamSummary
							: DEFAULT_SETTINGS.showTeamSummary;

						showGaslandsMath = result.settings.showGaslandsMath !== undefined
							? result.settings.showGaslandsMath
							: DEFAULT_SETTINGS.showGaslandsMath;

						// Initialize player map settings
						showOnPlayersMap = result.settings.showOnPlayersMap !== undefined
							? result.settings.showOnPlayersMap
							: DEFAULT_SETTINGS.showOnPlayersMap;

						allowContactFromPlayers = result.settings.allowContactFromPlayers !== undefined
							? result.settings.allowContactFromPlayers
							: DEFAULT_SETTINGS.allowContactFromPlayers;

						location = result.settings.location !== undefined
							? result.settings.location
							: DEFAULT_SETTINGS.location;

							// Initialize experimental features and updates settings
							showExperimentalFeatures = result.settings.showExperimentalFeatures !== undefined
								? result.settings.showExperimentalFeatures
								: DEFAULT_SETTINGS.showExperimentalFeatures;

							receiveUpdates = result.settings.receiveUpdates !== undefined
								? result.settings.receiveUpdates
								: DEFAULT_SETTINGS.receiveUpdates;
					}
				} catch (error) {
					console.error("Error loading settings:", error);
				}
			}
		});
		
		return () => {
			unsubscribe();
			document.removeEventListener('click', handleClickOutside);
		};
	});

	/* ---------- settings state ---------- */
	// let enableSponsorships = true;  // Already declared at the top
	// let includeAdvanced = true;     // Already declared at the top
	let maxCans = 50;
	let teamName = "My Gaslands Team";

	// Mode toggle for Edit/Play mode
	let playMode = false;

	// Function to check if user has acknowledged owning the rules
	function checkRulesAcknowledgment(action) {
		if (hasRules) {
			return true;
		} else {
			showRulesAcknowledgmentModal = true;
			rulesModalAction = action;
			return false;
		}
	}

	// Wrapper function for toggling play mode with rules check
	function togglePlayMode() {
		if (checkRulesAcknowledgment('playMode')) {
			playMode = !playMode;
		}
	}

	// Single print flag to prevent multiple prints
	let isPrinting = false;
	
	// Wrapper function for printing with rules check
	function printWithRulesCheck() {
		console.log('[printWithRulesCheck] Called');
		
		// Check if we have vehicles before proceeding
		if (!vehicles || vehicles.length === 0) {
			console.log('[printWithRulesCheck] No vehicles to print');
			alert('You need to add at least one vehicle before printing.');
			return;
		}
		
		// Check if we're already printing to prevent multiple prints
		if (isPrinting) {
			console.log('[printWithRulesCheck] Already printing, ignoring call');
			return;
		}
		
		// Check if user has acknowledged having rules
		if (hasRules) {
			// User has already acknowledged having the rules
			console.log('[printWithRulesCheck] Rules acknowledged, printing team');
			// Use the proper print service instead of window.print()
			isPrinting = true;
			printTeam()
				.then(() => {
					setTimeout(() => { isPrinting = false; }, 3000);
				})
				.catch(err => {
					console.error('[printWithRulesCheck] Error printing:', err);
					isPrinting = false;
				});
		} else {
			// Show the rules acknowledgment modal
			console.log('[printWithRulesCheck] Rules not acknowledged, showing modal');
			showRulesAcknowledgmentModal = true;
			rulesModalAction = 'printTeam';
		}
	}

	// Display settings
	let showTeamSummary = true;
	let showGaslandsMath = true;

	// For vehicle card collapse state
	let collapsedVehicles = new Set();
	// let darkMode = false;  // Already declared at the top

	// Save settings to Firebase when they change
	async function saveSettingsToFirebase() {
		if ($user) {
			try {
				await saveUserSettings({
					enableSponsorships,
					includeAdvanced,
					darkMode,
					showTeamSummary,
					showGaslandsMath,
					printStyle,
					hasRules,
					showExperimentalFeatures,
					receiveUpdates,
					showOnPlayersMap,
					allowContactFromPlayers,
					location,
					showEquipmentDescriptions,
					showPerkDescriptions
				});

				// Also save printStyle to localStorage for persistence
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem('printStyle', printStyle);
				}
			} catch (error) {
				console.error("Error saving settings:", error);
			}
		}
	}

	// Quick save team function
	async function quickSaveTeam() {
		if (!$user) {
			alert("Please log in to save your team.");
			return;
		}

		if (!teamName.trim()) {
			alert("Please enter a team name before saving.");
			return;
		}

		quickSaving = true;

		try {
			// First check if a team with this name already exists
			const teamsResult = await getUserTeams();
			if (teamsResult.success && teamsResult.teams) {
				const existingTeam = teamsResult.teams.find(team => team.teamName === teamName.trim());

				// If team exists, ask for confirmation before overwriting
				if (existingTeam) {
					const confirmOverwrite = confirm(`A team named "${teamName}" already exists. Do you want to overwrite it?`);
					if (!confirmOverwrite) {
						quickSaving = false;
						return; // User canceled the overwrite
					}

					// Will proceed to save and overwrite
				}
			}

			// Prepare draft data (similar to TeamsModal.svelte)
			const draftData = {
				teamName,
				sponsorId,
				vehicles,
				maxCans
			};

			// Save the team
			const result = await saveTeam(draftData, teamName);

			if (result.success) {
				alert("Team saved successfully!");
			} else {
				console.error("Failed to save team:", result.error);
				alert(`Failed to save team: ${result.error}`);
			}
		} catch (error) {
			console.error("Error saving team:", error);
			alert(`Error saving team: ${error instanceof Error ? error.message : "Unknown error"}`);
		} finally {
			quickSaving = false;
		}
	}

	/* ---------- menu actions ---------- */
	async function copyDraft() {
		await navigator.clipboard.writeText(encodeDraft(currentDraft));
		alert('Draft copied to clipboard!');
	}

	function shareLink() {
		const encoded = encodeDraft(currentDraft);
		goto(`?draft=${encoded}`, { replaceState: true });
		alert('Link updated in address bar. Copy the current URL to share your build.');
	}

	async function generateQRCode() {
		console.log('[generateQRCode] Generating QR code');
		try {
			// Generate QR code and show the modal
			qrDataUrl = await draftToDataURL(currentDraft);
			console.log('[generateQRCode] QR code generated');
			// Make sure qrDataUrl is shown
			showQRModal = true;
		} catch (error) {
			console.error('[generateQRCode] Error:', error);
		}
	}

	async function printTeam() {
		console.log("[printTeam] Print function called");
		
		// Check for vehicles again (defensive coding)
		if (!vehicles || vehicles.length === 0) {
			console.log("[printTeam] No vehicles to print");
			isPrinting = false;
			alert("You need to add at least one vehicle before printing.");
			return;
		}
		
		// First generate QR code for the team
		let qrCode;
		try {
			console.log("[printTeam] Generating QR code for team:", teamName);
			qrCode = await draftToDataURL(currentDraft);
			console.log("[printTeam] QR code generated, length:", qrCode?.length || 0);
		} catch (e) {
			console.error("[printTeam] Error generating QR code:", e);
			qrCode = null;
		}

		// Use our new standalone print service
		// This builds a modified draft with more information for printing
		const enhancedDraft = {
			...currentDraft,
			// Add extra data needed for printing
			teamName: teamName,
			totalCans: totalCans,
			maxCans: maxCans,
			sponsorName: currentSponsor?.name || 'No Sponsor',
			// Include sponsor perks information
			sponsor: currentSponsor,
			sponsorPerks: {
				perksClasses: currentSponsor?.perksClasses || [],
				classPerksList: classPerksList || [],
				sponsorPerksList: sponsorPerksList || []
			},
			// Add QR code explicitly - this should be a data URL string
			qrCode: qrCode,
			// Add vehicle data with more details including full objects
			vehicles: vehicles.map(v => ({
				...v,
				// Include calculated cost
				cost: validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || 0,
				// Include vehicle type details
				vehicleType: vehicleTypes.find(vt => vt.id === v.type),
				// Include stats
				stats: {
					hull: calculateMaxHull(v),
					handling: vehicleTypes.find(vt => vt.id === v.type)?.handling || 4,
					gear: vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 6,
					crew: vehicleTypes.find(vt => vt.id === v.type)?.crew || 1,
					weight: vehicleTypes.find(vt => vt.id === v.type)?.weight || 2
				},
				// Include full weapon objects with names
				weaponObjects: v.weapons.map(weaponId => {
					const lastUnderscoreIndex = weaponId.lastIndexOf('_');
				const baseWeaponId = lastUnderscoreIndex !== -1 ? 
					weaponId.substring(0, lastUnderscoreIndex) : 
					weaponId;
					const weapon = weapons.find(w => w.id === baseWeaponId);
					return {
						id: weaponId,
						name: weapon?.name || weaponId,
						facing: v.weaponFacings?.[weaponId] || weapon?.facing || 'front',
						attackDice: weapon?.attackDice || '-',
						cost: weapon?.cost || 0,
						specialRules: weapon?.specialRules || ''
					};
				}),
				// Include full upgrade objects with names
				upgradeObjects: v.upgrades.map(upgradeId => {
					const upgrade = upgrades.find(u => u.id === upgradeId);
					return {
						id: upgradeId,
						name: upgrade?.name || upgradeId,
						cost: upgrade?.cost || 0,
						specialRules: upgrade?.specialRules || ''
					};
				}),
				// Include full perk objects with names
				perkObjects: v.perks.map(perkId => {
					const perk = perks.find(p => p.id === perkId);
					return {
						id: perkId,
						name: perk?.name || perkId,
						level: perk?.level || 1,
						text: perk?.text || ''
					};
				})
			})),
			// Add print settings
			showEquipmentDescriptions: showEquipmentDescriptions,
			showPerkDescriptions: showPerkDescriptions
		};

		console.log("Printing team with options:", {
			printStyle,
			showEquipmentDescriptions,
			showPerkDescriptions,
			totalCans,
			maxCans
		});

		// Call the imported function with proper service name
		try {
			console.log("[printTeam] Calling printServiceFunc with style:", printStyle);
			await printServiceFunc(printStyle, enhancedDraft);
			console.log("[printTeam] Print completed successfully");
			return true;
		} catch (error) {
			console.error("[printTeam] Error calling print service:", error);
			isPrinting = false;
			alert("There was an error while printing. Please try again.");
			return false;
		}
	}

	// Explicitly declare this at the top level of component scope
	// to ensure it's available to be bound to the window object
	function importBuild() {
		console.log('[importBuild] Showing import modal');
		// Make sure modal is visible
		showImportModal = true;
		console.log('[importBuild] Import modal shown:', showImportModal);
	}

	function openSettings(tab = 'general') {
		console.log(`[openSettings] Opening settings modal with tab: ${tab}`);
		activeSettingsTab = tab;
		showSettingsModal = true;
		console.log(`[openSettings] showSettingsModal set to: ${showSettingsModal}`);
	}
	
	// Expose these functions to the global window object for use by the layout
	onMount(() => {
		if (typeof window !== 'undefined') {
			// Set up a custom event listener for menu commands
			window.addEventListener('gaslands-menu-action', (event) => {
				console.log('[Event] Received gaslands-menu-action event:', event.detail);
				const { action } = event.detail || {};
				
				if (action === 'importBuild') {
					console.log('[Event] Showing import modal from event');
					showImportModal = true;
				} else if (action === 'generateQRCode') {
					console.log('[Event] Showing QR modal from event');
					generateQRCode();
				} else if (action === 'printTeam') {
					console.log('[Event] Printing team from event');
					printWithRulesCheck();
				} else if (action === 'openSettings') {
					console.log('[Event] Opening settings from event with tab:', event.detail.tab || 'general');
					openSettings(event.detail.tab || 'general');
				}
			});
			
			// Make openSettings function globally available
			window.openSettings = openSettings;
			window.openSettingsFn = openSettings;
			console.log("[onMount] Defined window.openSettings and window.openSettingsFn");
			
			// Check localStorage for print settings request
			const openPrintSettingsFlag = localStorage.getItem('openPrintSettings');
			if (openPrintSettingsFlag) {
				// Clear the flag immediately
				localStorage.removeItem('openPrintSettings');
				console.log("Detected openPrintSettings flag in localStorage");
				
				// Use setTimeout to ensure DOM is fully loaded
				setTimeout(() => {
					openSettings('print');
				}, 200);
			}
			
			// Set up interval to periodically check localStorage
			const storageCheckInterval = setInterval(() => {
				const newFlag = localStorage.getItem('openPrintSettings');
				if (newFlag) {
					// Clear the flag immediately
					localStorage.removeItem('openPrintSettings');
					console.log("Detected openPrintSettings flag in localStorage (interval check)");
					openSettings('print');
				}
			}, 1000);
			
			// Clear interval when component is destroyed
			return () => {
				clearInterval(storageCheckInterval);
			};
			
			// Check URL parameters for settings tab request
			const urlParams = new URLSearchParams(window.location.search);
			if (urlParams.has('openSettingsTab')) {
				const tabToOpen = urlParams.get('openSettingsTab');
				console.log("Opening settings tab from URL parameter:", tabToOpen);
				// Use setTimeout to ensure DOM is fully loaded
				setTimeout(() => {
					openSettings(tabToOpen);
					// Clean up URL to prevent reopening on refresh
					window.history.replaceState({}, document.title, window.location.pathname);
				}, 100);
			}
		
			// Setup message listener for print window communication
			window.addEventListener('message', (event) => {
				if (event.data && event.data.type === 'openPrintSettings') {
					openSettings('print');
				}
			});
			
			// Directly assign functions from the component scope to the window
			window.copyDraftFn = copyDraft;
			window.shareLinkFn = shareLink;
			window.generateQRCodeFn = generateQRCode;
			window.importBuildFn = importBuild;
			window.printTeamFn = printWithRulesCheck;
			// Make sure we use the direct function reference, not a wrapper
			window.openSettingsFn = openSettings;

			// Also expose functions directly on the window object as a backup
			window.copyDraft = copyDraft;
			window.shareLink = shareLink;
			window.generateQRCode = generateQRCode;
			window.importBuild = importBuild;
			window.printTeam = printTeam;
			window.printWithRulesCheck = printWithRulesCheck;
			window.openTeamsModalFn = () => { showTeamsModal = true; };

			// Expose showExperimentalFeatures for the menu visibility
			Object.defineProperty(window, 'showExperimentalFeatures', {
				get: () => showExperimentalFeatures
			});

			// Add functions for the Teams Modal in the layout
			window.currentDraftFn = () => currentDraft;
			window.importDraftFn = (draft) => {
				if (draft) {
					sponsorId = draft.sponsor;
					vehicles = draft.vehicles;

					// Import team name if available
					if (draft.teamName) {
						teamName = draft.teamName;
					}

					// Import maxCans if available
					if (draft.maxCans) {
						maxCans = draft.maxCans;
					}

					// Import darkMode if available
					if (draft.darkMode !== undefined) {
						darkMode = draft.darkMode;
					}
				}
			};
		}

		return () => {
			// Clean up when component is destroyed
			if (typeof window !== 'undefined') {
				console.log("[onUnmount] Cleaning up global functions");
				// Clean up function references with Fn suffix
				window.copyDraftFn = undefined;
				window.shareLinkFn = undefined;
				window.generateQRCodeFn = undefined;
				window.importBuildFn = undefined;
				window.printTeamFn = undefined;
				window.openSettings = undefined;
				window.openSettingsFn = undefined;
				window.openTeamsModalFn = undefined;
				window.currentDraftFn = undefined;
				window.importDraftFn = undefined;
				
				// Clean up direct function references
				window.copyDraft = undefined;
				window.shareLink = undefined;
				window.generateQRCode = undefined;
				window.importBuild = undefined;
				window.printTeam = undefined;
				window.printWithRulesCheck = undefined;
				delete window.showExperimentalFeatures;
			}
		};
	});

	function importDraftString() {
		const draft = decodeDraft(importString.trim());
		if (draft) {
			sponsorId = draft.sponsor;
			vehicles = draft.vehicles as Veh[];
			
			// Import team name if available
			if (draft.teamName) {
				teamName = draft.teamName;
			}
			
			// Import maxCans if available
			if (draft.maxCans) {
				maxCans = draft.maxCans;
			}
			
			// Import darkMode if available
			if (draft.darkMode !== undefined) {
				darkMode = draft.darkMode;
			}
			
			importString = '';
			showImportModal = false;
		} else {
			alert('Invalid draft string');
		}
	}

	/* ---------- load from URL param (once) ---------- */
	if (typeof window !== 'undefined') {
		// First load settings from localStorage if available
		const savedDarkMode = localStorage.getItem('darkMode');
		if (savedDarkMode !== null) {
			darkMode = savedDarkMode === 'true';
		}

		// Then check for URL params (these override localStorage)
		const url = new URL(window.location.href);
		const encoded = url.searchParams.get('draft');
		if (encoded) {
			const imported = decodeDraft(encoded);
			if (imported) {
				sponsorId = imported.sponsor;
				vehicles = imported.vehicles as Veh[];
				
				// Import team name if available
				if (imported.teamName) {
					teamName = imported.teamName;
				}
				
				// Import maxCans if available
				if (imported.maxCans) {
					maxCans = imported.maxCans;
				}
				
				// Import darkMode if available
				if (imported.darkMode !== undefined) {
					darkMode = imported.darkMode;
				}
			}
		}
	}
	
	/* ---------- setting changes effects ---------- */
	// When enableSponsorships is disabled, set to "No Sponsor"
	$: if (!enableSponsorships) {
		const noSponsorId = sponsors.find(s => s.id === 'no_sponsor')?.id ?? '';
		sponsorId = noSponsorId;
	}
	
	// Remove any advanced vehicle types when includeAdvanced is disabled
	$: if (!includeAdvanced) {
		vehicles = vehicles.filter(v => {
			const vehicleType = vehicleTypes.find(vt => vt.id === v.type);
			return vehicleType && !vehicleType.advanced;
		});
	}
	
	// Remove any advanced weapons when includeAdvanced is disabled
	$: if (!includeAdvanced) {
		vehicles = vehicles.map(v => ({
			...v,
			weapons: v.weapons.filter(weaponInstanceId => {
				// Extract the base weapon ID from the instance ID (format: baseId_instanceHash)
				const lastUnderscoreIndex = weaponInstanceId.lastIndexOf('_');
				const baseWeaponId = lastUnderscoreIndex !== -1 ? 
					weaponInstanceId.substring(0, lastUnderscoreIndex) : 
					weaponInstanceId;
				const weapon = weapons.find(w => w.id === baseWeaponId);
				return weapon && !weapon.advanced;
			}),
			// Also clean up any facings for removed weapons
			weaponFacings: v.weaponFacings ? 
				Object.fromEntries(
					Object.entries(v.weaponFacings).filter(([weaponInstanceId]) => {
						const lastUnderscoreIndex = weaponInstanceId.lastIndexOf('_');
				const baseWeaponId = lastUnderscoreIndex !== -1 ? 
					weaponInstanceId.substring(0, lastUnderscoreIndex) : 
					weaponInstanceId;
						const weapon = weapons.find(w => w.id === baseWeaponId);
						return weapon && !weapon.advanced;
					})
				) : {}
		}));
	}
	
	// Remove any advanced upgrades when includeAdvanced is disabled
	$: if (!includeAdvanced) {
		vehicles = vehicles.map(v => ({
			...v,
			upgrades: v.upgrades.filter(upgradeId => {
				const upgrade = upgrades.find(u => u.id === upgradeId);
				return upgrade && !upgrade.advanced;
			})
		}));
	}
	
	// Remove perks when enableSponsorships is disabled
	$: if (!enableSponsorships) {
		vehicles = vehicles.map(v => ({
			...v,
			perks: []
		}));
	}
	
	// Save dark mode preference to localStorage when it changes
	$: if (typeof window !== 'undefined') {
		localStorage.setItem('darkMode', darkMode.toString());
		// Add dark mode classes to html element for global styling
		if (darkMode) {
			document.documentElement.classList.add('dark-mode');
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark-mode');
			document.documentElement.classList.remove('dark');
		}
	}

	/* ---------- draft & validation ---------- */
	$: currentDraft = { 
		sponsor: sponsorId, 
		vehicles,
		teamName,
		maxCans,
		darkMode
	} satisfies Draft;

	// Function to force validation to run immediately
	function forceValidation() {
		// Create a complete draft object to ensure validation runs correctly
		const updatedDraft: Draft = {
			sponsor: sponsorId,
			vehicles: vehicles.map(v => ({
				id: v.id,
				type: v.type,
				name: v.name,
				weapons: v.weapons,
				weaponFacings: v.weaponFacings || {},
				upgrades: v.upgrades || [],
				perks: v.perks || []
			})),
			maxCans: maxCans,
			teamName: teamName,
			darkMode: darkMode
		};

		// Update currentDraft to trigger the reactive validation
		currentDraft = updatedDraft;

		// Force immediate recalculation for UI responsiveness
		let tempTotal = 0;
		vehicles.forEach(vehicle => {
			// Calculate vehicle cost
			const vehicleCost = calculateVehicleCost(vehicle);

			// Find or create vehicle report
			let vehicleReport = validation.vehicleReports.find(r => r.vehicleId === vehicle.id);
			if (!vehicleReport) {
				vehicleReport = {
					vehicleId: vehicle.id,
					cans: vehicleCost,
					errors: []
				};
				validation.vehicleReports.push(vehicleReport);
			} else {
				vehicleReport.cans = vehicleCost;
			}

			tempTotal += vehicleCost;
		});

		// Update total cans in validation object
		validation.cans = tempTotal;

		// Ensure reactivity
		validation = { ...validation };
	}

	// Function to handle vehicle type changes
	function handleVehicleTypeChange(vehicleId, newVehicleType) {
		// Find the vehicle in the validation reports for updating UI immediately
		const vehicleReport = validation.vehicleReports.find(r => r.vehicleId === vehicleId);
		if (vehicleReport) {
			// Find the new vehicle type
			const vehicleType = vehicleTypes.find(vt => vt.id === newVehicleType);
			if (vehicleType) {
				// Update the total cans immediately by recalculating
				const vehicle = vehicles.find(v => v.id === vehicleId);
				if (vehicle) {
					// Manually update the total cans
					const oldCost = vehicleReport.cans;
					const newCost = calculateVehicleCost(vehicle);
					validation.cans = validation.cans - oldCost + newCost;

					// Update the vehicle report
					vehicleReport.cans = newCost;
				}
			}
		}

		// Also trigger the full validation
		forceValidation();
	}

	// Function to calculate vehicle cost for immediate updates
	function calculateVehicleCost(vehicle) {
		// Get the base cost from the vehicle type
		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
		if (!vehicleType) return 0;

		let totalCost = vehicleType.baseCost || 0;

		// Add weapon costs
		for (const weaponInstanceId of vehicle.weapons) {
			const lastUnderscoreIndex = weaponInstanceId.lastIndexOf('_');
				const baseWeaponId = lastUnderscoreIndex !== -1 ? 
					weaponInstanceId.substring(0, lastUnderscoreIndex) : 
					weaponInstanceId;
			const weaponObj = weapons.find(w => w.id === baseWeaponId);
			if (weaponObj && weaponObj.cost) {
				totalCost += weaponObj.cost;
			}
		}

		// Add upgrade costs
		for (const upgradeId of vehicle.upgrades) {
			const upgradeObj = upgrades.find(u => u.id === upgradeId);
			if (upgradeObj && upgradeObj.cost) {
				totalCost += upgradeObj.cost;
			}
		}

		// Add perk costs
		for (const perkId of vehicle.perks) {
			const perkObj = perks.find(p => p.id === perkId);
			if (perkObj && perkObj.level) {
				totalCost += perkObj.level; // Perk cost is its level
			}
		}

		return totalCost;
	}
	$: validateDraft(currentDraft).then((r) => {
		// Create a copy of the validation result
		const validationCopy = { ...r };

		// Replace the max cans error with custom max cans if it exists
		if (validationCopy.errors.length > 0) {
			validationCopy.errors = validationCopy.errors.map(err => {
				if (err.includes("cans limit") || err.includes("can limit")) {
					return `Team exceeds ${maxCans} cans limit`;
				}
				return err;
			});
		}

		// Check against custom max cans
		if (validationCopy.cans > maxCans && !validationCopy.errors.some(e => e.includes("cans limit"))) {
			validationCopy.errors.push(`Team exceeds ${maxCans} cans limit`);
		}

		// Update the validation object
		validation = validationCopy;

		// Explicitly update the totalCans value for display and debug
		console.log(`Team validation completed - Total cans: ${validationCopy.cans}`);
	});
	$: totalCans = validation.cans;
	$: teamErrors = validation.errors;

	/* ---------- filtered assets based on settings ---------- */
	// Trigger re-rendering when vehicles array changes its length
	$: vehicleCount = vehicles.length;

	// Filter weapons based on includeAdvanced setting and electrical property
	$: filteredWeapons = weapons.filter(w => {
		// Filter by advanced setting
		if (!includeAdvanced && w.advanced) return false;

		// Filter by electrical property
		if (w.electrical && !(currentSponsor?.electrical)) return false;

		return true;
	});

	// Filter upgrades based on includeAdvanced setting and electrical property
	$: filteredUpgrades = upgrades.filter(u => {
		// Filter by advanced setting
		if (!includeAdvanced && u.advanced) return false;

		// Filter by electrical property
		if (u.electrical && !(currentSponsor?.electrical)) return false;

		// Filter by sponsor restriction if applicable
		if (u.limited_sponsor && u.limited_sponsor !== currentSponsor?.id) return false;

		return true;
	});
	
	// Get available perks for the current sponsor
	$: currentSponsor = sponsors.find(s => s.id === sponsorId);

	// Filter perks based on class match (perksClasses)
	$: classPerksList = enableSponsorships
		? perks.filter(p => {
			// If sponsor has perksClasses and the perk has a class, do normal filtering
			if (currentSponsor?.perksClasses?.length > 0 && p.class) {
				return currentSponsor.perksClasses.some(
					sponsorClass => sponsorClass.toLowerCase() === p.class.toLowerCase()
				);
			}
			// If sponsor has perks directly specified, include perks matching those IDs
			else if (currentSponsor?.perks?.length > 0) {
				return currentSponsor.perks.includes(p.id);
			}
			// No matching criteria found
			return false;
		})
		: [];

	// Filter sponsor-specific perks (based on sponsor field)
	// Map of sponsor ID aliases for backward compatibility with perks.json
	const sponsorIdAliases = {
		'rus': ['rusty'], // Rusty's Bootleggers
		'thp': ['highway_patrol', 'highway patrol'], // The Highway Patrol
		'war': ['warden'], // The Warden
	};

	$: sponsorPerksList = enableSponsorships && currentSponsor
		? perks.filter(p => {
			// If the perk has a sponsor field, match it against the current sponsor
			if (p.sponsor) {
				const perkSponsorLower = p.sponsor.toLowerCase();
				const sponsorIdLower = currentSponsor.id.toLowerCase();
				const sponsorNameLower = currentSponsor.name.toLowerCase();

				// Get any aliases for this sponsor
				const aliases = sponsorIdAliases[sponsorIdLower] || [];

				// Match by sponsor ID, sponsor name, or any of the aliases
				return perkSponsorLower === sponsorIdLower ||
				       perkSponsorLower === sponsorNameLower ||
				       aliases.includes(perkSponsorLower);
			}
			return false;
		})
		: [];

	// All available perks (used for vehicles), filtered by electrical restrictions
	$: availablePerks = [...classPerksList, ...sponsorPerksList].filter(perk => {
		// Filter by electrical property
		if (perk.electrical && !(currentSponsor?.electrical)) return false;
		return true;
	});

	// For legacy support, also include perks with matching id
	$: legacyPerks = enableSponsorships
		? perks.filter(p => (currentSponsor?.perks && currentSponsor.perks.includes(p.id)))
		: [];

	/* ---------- import box ---------- */
	let importString = '';

	// Remove all duplicate settings declarations
	// let printStyle = localStorage.getItem('printStyle') || DEFAULT_SETTINGS.printStyle;
	// let enableSponsorships = true;
	// let includeAdvanced = true;
	// let darkMode = false;

	onMount(async () => {
		// Only try to load settings if user is authenticated
		if ($user) {
			const { success, settings } = await getUserSettings();
			if (success && settings) {
				includeAdvanced = settings.includeAdvanced;
				enableSponsorships = settings.enableSponsorships;
				darkMode = settings.darkMode;
				printStyle = settings.printStyle || 'classic';
				hasRules = settings.hasRules ?? DEFAULT_SETTINGS.hasRules;
				showEquipmentDescriptions = settings.showEquipmentDescriptions ?? DEFAULT_SETTINGS.showEquipmentDescriptions;
				showPerkDescriptions = settings.showPerkDescriptions ?? DEFAULT_SETTINGS.showPerkDescriptions;
			}
		} else {
			// Use default settings when not authenticated
			includeAdvanced = DEFAULT_SETTINGS.includeAdvanced;
			enableSponsorships = DEFAULT_SETTINGS.enableSponsorships;
			darkMode = DEFAULT_SETTINGS.darkMode;
			printStyle = DEFAULT_SETTINGS.printStyle || 'classic';
			hasRules = DEFAULT_SETTINGS.hasRules;
			showEquipmentDescriptions = DEFAULT_SETTINGS.showEquipmentDescriptions;
			showPerkDescriptions = DEFAULT_SETTINGS.showPerkDescriptions;
		}
	});

</script>

<svelte:head>
	<title>Gaslands Garage - Team Builder</title>
	<script>
		// Ensure modals have proper background in dark mode
		document.addEventListener('DOMContentLoaded', function() {
			function fixModalBackgrounds() {
				const isDarkMode = document.documentElement.classList.contains('dark-mode') ||
                                     document.documentElement.classList.contains('dark');
				const modals = document.querySelectorAll('.bg-white.dark\\:bg-gray-800, .settings-modal-content');
				modals.forEach(modal => {
					if (isDarkMode) {
						modal.style.backgroundColor = '#1f2937';
					} else {
						modal.style.backgroundColor = 'white';
					}
				});
			}
			
			// Run immediately and when dark mode changes
			fixModalBackgrounds();
			
			// Create a mutation observer to watch for dark mode class changes
			const observer = new MutationObserver(mutations => {
				mutations.forEach(mutation => {
					if (mutation.attributeName === 'class') {
						fixModalBackgrounds();
					}
				});
			});
			
			// Start observing
			observer.observe(document.documentElement, { attributes: true });
		});
	</script>
</svelte:head>

<!-- Menu removed - now in layout.svelte -->

<style>
/* Menu styles removed - now in layout.svelte */

/* Removed unused selector: no-card-padding */

/* Tooltip styles removed */

/* Vehicle type icon styles removed */

/* Weight class indicators removed */

/* Interactive dashboard styles removed */

/* Print styles have been moved to a separate file */
</style>

<section id="builder-ui" class="p-2 sm:p-4 md:p-6 bg-stone-100 min-h-screen w-full {darkMode ? 'dark' : ''}">
    <!-- Debug controls - Only visible in experimental mode -->
    {#if showExperimentalFeatures}
      <div class="fixed bottom-4 right-4 z-50 bg-gray-800 p-2 rounded-lg shadow-lg text-white text-xs">
        <div class="font-bold mb-1">Debug Controls</div>
        <div class="flex flex-col gap-1">
          <button
            class="bg-purple-600 hover:bg-purple-800 px-2 py-1 rounded"
            on:click={() => {
              console.log('Import Modal Debug Button clicked');
              showImportModal = true;
            }}
          >
            Show Import Modal
          </button>
          <button
            class="bg-blue-600 hover:bg-blue-800 px-2 py-1 rounded"
            on:click={() => {
              console.log('QR Modal Debug Button clicked');
              showQRModal = true;
            }}
          >
            Show QR Modal
          </button>
        </div>
      </div>
    {/if}
	<header class="mb-3 md:mb-4">
		<div class="text-3xl md:text-4xl font-extrabold text-stone-800 dark:text-gray-100 tracking-tight flex flex-wrap justify-between items-center">
			<div class="flex flex-col gap-2 w-full">
				<div class="flex items-center justify-between w-full gap-4">
					<div class="flex items-center gap-4">
						<b class="text-base font-bold whitespace-nowrap" style="min-width: 50px;">Name:</b>
						<input
							type="text"
							bind:value={teamName}
							class="bg-transparent border-2 border-amber-500 rounded-lg px-3 py-0.25 font-bold text-amber-700 dark:text-white focus:outline-none focus:border-amber-600 min-w-[127px] w-auto max-w-[167px] text-base dark-text-input"
							style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
							aria-label="Team Name"
						/>
					</div>
					<!-- Edit/Play Mode Toggle Button -->
					<button
						class="py-2 px-4 w-32 flex items-center justify-center rounded-md transition-colors amber-button"
						on:click={togglePlayMode}
					>
						<span class="w-3 h-3 rounded-full {playMode ? 'bg-green-500' : 'bg-amber-500'} transition-colors mr-2"></span>
						<span class="text-sm font-medium">{playMode ? 'Edit Team' : 'Play Mode'}</span>
					</button>
				</div>
				<div class="flex items-center justify-between w-full gap-4">
					<div class="flex items-center gap-4">
						<b class="text-base font-bold whitespace-nowrap">Cans: </b>
						<span class="font-extrabold text-amber-700 dark:text-amber-300 text-lg md:text-xl">{totalCans || 0}</span>
						<span class="text-lg font-bold text-amber-700 dark:text-amber-300">/</span>
						<input
							type="number"
							bind:value={maxCans}
							min="1"
							max="1000"
							class="bg-transparent border-2 border-amber-500 rounded-lg px-3 py-0.25 font-bold text-amber-700 dark:text-white focus:outline-none focus:border-amber-600 min-w-[80px] w-auto text-base dark-text-input"
							style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
							aria-label="Maximum Cans"
						/>
					</div>
					<!-- Quick Save Button -->
					<button
						class="py-2 px-4 w-32 flex items-center justify-center rounded-md transition-colors amber-button"
						on:click={quickSaveTeam}
						disabled={quickSaving}
					>
						{#if quickSaving}
							<div class="animate-spin mr-2 h-3 w-3 border-b-2 border-white rounded-full"></div>
							<span class="text-sm font-medium">Saving...</span>
						{:else}
							<span class="text-sm font-medium">Quick Save</span>
						{/if}
					</button>
				</div>

				{#if enableSponsorships}
				<div class="flex flex-col w-full mt-1">
					<div class="flex items-center gap-4">
						<b class="text-base font-bold whitespace-nowrap flex items-center" style="min-width: 147px;">Choose Your Sponsor:</b>
						<div class="relative flex-grow">
							<select
								id="sponsor-select"
								bind:value={sponsorId}
								class="form-select h-[32px] flex items-center"
								style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
							>
								{#each [...sponsors].sort((a, b) => {
									// Always put "No Sponsor" first
									if (a.id === 'no_sponsor') return -1;
									if (b.id === 'no_sponsor') return 1;
									// Then sort alphabetically
									return a.name.localeCompare(b.name);
								}) as s}
									<option value={s.id}>{s.name}</option>
								{/each}
							</select>
						</div>
					</div>

					{#if classPerksList.length > 0}
						<div class="text-sm text-stone-700 dark:text-gray-300 text-left mt-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-medium mr-2">Available Perks:</span>
								{#each classPerksList as perk}
									<Tooltip
										text={perk.name}
										content="{perk.name}{perk.cost ? ` (${perk.cost} cans)` : ''}: {perk.text}"
									/>
								{/each}
							</div>
						</div>
					{/if}

					{#if sponsorPerksList.length > 0}
						<div class="text-sm text-stone-700 dark:text-gray-300 text-left mt-2">
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-medium mr-2">Sponsor Perks:</span>
								{#each sponsorPerksList as perk}
									<Tooltip
										text={perk.name}
										content="{perk.name}{perk.cost ? ` (${perk.cost} cans)` : ''}: {perk.text}"
									/>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				{/if}
			</div>
		</div>
	</header>

	<!-- Info message when sponsorships are disabled -->
	{#if !enableSponsorships}
		<div class="bg-blue-50 p-5 rounded-lg shadow-md mb-6">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-lg font-medium text-blue-800">Sponsorships Disabled</h3>
					<div class="mt-2 text-sm text-blue-700">
						<p>You are building a team without a sponsor. Sponsorship perks are unavailable.
						Enable sponsorships in Settings to access sponsor-specific perks and abilities.</p>
					</div>
					<div class="mt-3">
						<button
							type="button"
							class="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
							on:click={openSettings}
						>
							Open Settings
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
	<!-- Vehicle list - Current count: {vehicles.length} -->
	<div class="mb-3">
		<div class="flex items-center justify-between mb-2">
			<div class="flex items-center gap-4">
				<h2 class="text-2xl font-bold text-stone-800 dark:text-gray-100">Vehicles</h2>
			</div>
			<button
				class="py-2 px-4 w-32 flex items-center justify-center rounded-md transition-colors amber-button"
				on:click={() => addVehicle()}
				disabled={playMode}
				class:opacity-50={playMode}
				class:cursor-not-allowed={playMode}
			>
				<span class="text-sm font-medium">+ Add Vehicle</span>
			</button>
		</div>

		{#if vehicles.length === 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
				<p class="text-stone-600 dark:text-gray-300 text-lg font-bold py-4 px-8">Your team has no vehicles yet. Get started by adding a vehicle to your team.</p>
			</div>

			<!-- About Gaslands Content when no vehicles -->
			<div class="mt-3 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
				<div class="flex justify-between items-center mb-6">
					<h3 class="text-xl font-bold text-stone-800 dark:text-white">Gaslands: The Post Apocalyptic Car Combat Game</h3>
				</div>

				<div class="space-y-6 text-stone-700 dark:text-gray-200">
					<h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">What You Need to Start Playing:</h4>
					<ul class="list-disc pl-5 space-y-2">
						<li><a href="https://amzn.to/4m7OQYa" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Rulebook</a> - The Gaslands Refuelled rulebook contains all the rules and scenarios.  <b>You must purchase the rulebook to use this website.</b>  It is available in printed and electronic formats.</li>
						<li><a href="https://creatoriq.cc/434pUIp" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Dice</a> - Special dice designed for the game.</li>
						<li><a href="https://amzn.to/4kaUcA2" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Regular 6-Sided Dice</a> - For resolving various game mechanics.</li>
						<li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Templates</a> - Movement templates for driving your vehicles.</li>
						<li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Vehicles</a> - Hotwheels or Matchbox cars that you can modify.</li>
					</ul>

					<h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">Recommended Resources:</h4>
					<div class="bg-stone-100 dark:bg-gray-700 p-4 rounded-lg">
						<div class="flex items-center gap-3 mb-2">
							<div class="w-full">
								<div class="flex justify-center">
									<iframe width="560" height="315" src="https://www.youtube.com/embed/CL66NMhWwHo?si=KltcYCh9RbCqU2HQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
				{#each vehicles as vehicle (vehicle.id)}
					<VehicleCard
						{vehicle}
						{vehicleTypes}
						{weapons}
						{upgrades}
						{perks}
						{currentSponsor}
						collapsed={collapsedVehicles.has(vehicle.id)}
						{playMode}
						{validation}
						{showTeamSummary}
						{showGaslandsMath}
						{totalCans}
						{maxCans}
						{filteredWeapons}
						{filteredUpgrades}
						filteredPerks={availablePerks}
						on:remove={e => removeVehicle(e.detail.id)}
						on:clone={e => cloneVehicle(e.detail.id)}
						on:toggleCollapse={e => toggleVehicleCollapse(e.detail.id)}
						on:addWeapon={e => addWeapon(e.detail.vehicleId, e.detail.weaponId, e.detail.facing)}
						on:removeWeapon={e => removeWeapon(e.detail.vehicleId, e.detail.weaponIndex)}
						on:addUpgrade={e => addUpgrade(e.detail.vehicleId, e.detail.upgradeId)}
						on:removeUpgrade={e => removeUpgrade(e.detail.vehicleId, e.detail.upgradeIndex)}
						on:addPerk={e => addPerk(e.detail.vehicleId, e.detail.perkId)}
						on:removePerk={e => removePerk(e.detail.vehicleId, e.detail.perkIndex)}
						on:incrementHazard={e => incrementHazard(e.detail.vehicleId)}
						on:decrementHazard={e => decrementHazard(e.detail.vehicleId)}
						on:vehicleTypeChanged={e => handleVehicleTypeChange(e.detail.id, e.detail.vehicleType)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<hr>

<!-- Totals / legality -->
{#if showTeamSummary && vehicles.length > 0}
<div class="bg-white p-5 rounded-lg shadow-md mb-6">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h2 class="text-xl font-bold text-stone-800">{teamName}</h2>
			<p class="text-sm text-stone-600">Team Summary</p>
		</div>
		<div class="text-lg font-bold">
			<span class="text-stone-600">Total:</span>
			<span class="text-amber-600 ml-1">{totalCans}/{maxCans} cans</span>
		</div>
	</div>

	<!-- Sponsor info (when enabled) -->
	{#if enableSponsorships && sponsorId}
		<div class="mb-4 bg-stone-100 p-3 rounded">
			<div class="flex flex-col text-left">
				<div class="flex items-center">
					<span class="font-medium text-stone-800">Sponsor:</span>
					<span class="font-bold text-amber-700 ml-2">{currentSponsor?.name || 'None'}</span>
				</div>

				{#if (currentSponsor?.perksClasses?.length) && classPerksList.length > 0}
					<div class="mt-2">
						<div>
							<span class="font-medium text-stone-800">Perks:</span>
						</div>
						<div class="text-stone-700 flex flex-wrap mt-1 gap-2">
							{#each classPerksList as perk, i}
								<Tooltip
									text="{perk.name}"
									content="{perk.name}{perk.cost ? ` (${perk.cost} cans)` : ''}: {perk.text}"
								/>
							{/each}
						</div>
					</div>
				{/if}

				{#if sponsorPerksList.length > 0}
					<div class="mt-3">
						<div>
							<span class="font-medium text-stone-800">Sponsor Perks:</span>
						</div>
						<div class="text-stone-700 flex flex-wrap mt-1 gap-2">
							{#each sponsorPerksList as perk, i}
								<Tooltip
									text="{perk.name}"
									content="{perk.name}{perk.cost ? ` (${perk.cost} cans)` : ''}: {perk.text}"
								/>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if teamErrors.length === 0}
		<div class="flex items-center bg-green-50 text-green-800 p-4 rounded-lg">
			<span class="mr-2 text-green-500">✓</span>
			<span class="font-medium">Your team is legal and ready to race!</span>
		</div>
	{:else}
		<div class="bg-red-50 text-red-800 p-4 rounded-lg">
			<div class="flex items-center mb-2">
				<span class="mr-2 text-red-500">!</span>
				<span class="font-medium">Your team has issues that need fixing:</span>
			</div>
			<ul class="list-disc ml-12 space-y-1">
				{#each teamErrors as err}
					<li>{err}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
{/if}
<!-- Gaslands Math -->
{#if showGaslandsMath && vehicles.length > 0}
<div class="mt-6 bg-stone-100 dark:bg-gray-700 p-4 rounded-lg">
	<h3 class="text-lg font-bold text-stone-800 dark:text-white mb-3">Gaslands Math:</h3>
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Hull (Min/Avg/Max/Total)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{#if vehicles.length > 0}
					{Math.min(...vehicles.map(v => calculateMaxHull(v)))} /
					{Math.round(vehicles.reduce((sum, v) => sum + calculateMaxHull(v), 0) / vehicles.length)} /
					{Math.max(...vehicles.map(v => calculateMaxHull(v)))} /
					{vehicles.reduce((total, v) => total + calculateMaxHull(v), 0)}
				{:else}
					0 / 0 / 0 / 0
				{/if}
			</div>
		</div>

		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Vehicle Attack Dice Per Turn (Min/Avg/Max/Total)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{#if vehicles.length > 0}
					{Math.min(...vehicles.map(v => calculateTotalAttackDice(v)))} /
					{Math.round(vehicles.reduce((sum, v) => sum + calculateTotalAttackDice(v), 0) / vehicles.length)} /
					{Math.max(...vehicles.map(v => calculateTotalAttackDice(v)))} /
					{vehicles.reduce((total, v) => total + calculateTotalAttackDice(v), 0)}
				{:else}
					0 / 0 / 0 / 0
				{/if}
			</div>
		</div>

		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Gear (Min/Avg/Max)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{#if vehicles.length > 0}
					{Math.min(...vehicles.map(v => vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0))} /
					{Math.round(vehicles.reduce((sum, v) => sum + (vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0), 0) / vehicles.length)} /
					{Math.max(...vehicles.map(v => vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0))}
				{:else}
					0 / 0 / 0
				{/if}
			</div>
		</div>
		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Weapons (Min/Avg/Max/Total)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{#if vehicles.length > 0}
					{Math.min(...vehicles.map(v => v.weapons.length))} /
					{Math.round(vehicles.reduce((sum, v) => sum + v.weapons.length, 0) / vehicles.length)} /
					{Math.max(...vehicles.map(v => v.weapons.length))} /
					{vehicles.reduce((total, v) => total + v.weapons.length, 0)}
				{:else}
					0 / 0 / 0 / 0
				{/if}
			</div>
		</div>
		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Total Vehicles</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{vehicles.length}
			</div>
		</div>
	</div>
</div>
{/if}

<!-- QR Modal -->
    {#if qrDataUrl && showQRModal}
      <div
        class="fixed inset-0 bg-black/90 z-50"
        role="dialog"
        aria-modal="true"
        aria-label="QR Code"
        tabindex="-1"
      >
        <!-- Adding a button to make the whole backdrop clickable/accessible -->
        <button
          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
          on:click={() => { showQRModal = false; }}
          on:keydown={e => e.key === 'Escape' && (showQRModal = false)}
          aria-label="Close modal background"
        ></button>
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-10 border-2 border-amber-500 z-10 fixed left-1/2 top-1/2 w-auto max-w-md overflow-y-auto transform -translate-x-1/2 -translate-y-1/2 max-h-[90vh]"
          role="document"
          style="box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: white;"
          data-modal-content
        >
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Team QR Code</h3>
            <button
              class="py-0.25 px-2 h-[32px] flex items-center justify-center rounded transition-colors text-sm amber-button"
              on:click={() => { showQRModal = false; }}
              aria-label="Close QR code modal"
              style="height: 32px !important; min-height: 32px !important;"
            >
              <span>Close</span>
            </button>
          </div>
          <div class="bg-white dark:bg-gray-700 p-6 rounded-lg border-2 border-stone-200 dark:border-gray-600">
            <img src={qrDataUrl} alt="team QR code" class="mx-auto w-64 h-64" />
          </div>
          <p class="mt-6 text-center text-stone-600 dark:text-amber-300 text-sm font-medium">
            Scan this QR code to share your team build
          </p>
          <div class="flex justify-end gap-4 mt-8 pt-4 border-t border-stone-200 dark:border-amber-900">
            <button
              class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm amber-button shadow-md"
              style="height: 32px !important; min-height: 32px !important;"
              on:click={() => (qrDataUrl = null)}
            >
              Close
            </button>
            <button
              class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm shadow-md"
              style="height: 32px !important; min-height: 32px !important; background-color: #2563eb !important; color: white !important;"
              on:click={() => {
                // Give the QR code another moment to ensure it's fully rendered
                setTimeout(() => window.print(), 100);
              }}
            >
              Print
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Import Modal -->
    {#if showImportModal}
      <div
        class="fixed inset-0 bg-black/90 z-50"
        role="dialog"
        aria-modal="true"
        aria-label="Import Build"
        tabindex="-1"
      >
        <!-- Adding a button to make the whole backdrop clickable/accessible -->
        <button
          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
          on:click={() => (showImportModal = false)}
          on:keydown={e => e.key === 'Escape' && (showImportModal = false)}
          aria-label="Close modal background"
        ></button>
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6 md:p-8 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
          role="document"
          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: white;"
          data-modal-content
        >
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Import Team Build</h3>
            <button
              class="py-0.25 px-2 h-[32px] flex items-center justify-center rounded transition-colors text-sm amber-button"
              on:click={() => (showImportModal = false)}
              aria-label="Close import modal"
              style="height: 32px !important; min-height: 32px !important;"
            >
              <span>Close</span>
            </button>
          </div>
          
          <div class="space-y-6">
            <p class="text-stone-600 dark:text-gray-200">
              Paste a team build code below to import a shared build
            </p>
            <div class="space-y-3">
              <label for="import-draft" class="sr-only">Import team build code</label>
              <textarea
                id="import-draft"
                bind:value={importString}
                class="w-full px-4 py-3 border-2 border-stone-300 dark:border-gray-600 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[120px] bg-white dark:bg-gray-700 text-stone-800 dark:text-white"
                placeholder="Paste encoded draft here"
              ></textarea>
            </div>
            <div class="flex justify-end gap-4 mt-8 pt-4 border-t border-stone-200 dark:border-amber-900">
              <button
                class="px-6 py-2 rounded-lg bg-stone-300 hover:bg-stone-400 text-stone-700 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-medium transition-colors shadow-md"
                on:click={() => (showImportModal = false)}
              >
                Cancel
              </button>
              <button
                class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm amber-button shadow-md"
                style="height: 32px !important; min-height: 32px !important;"
                on:click={importDraftString}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Settings Modal -->
    <SettingsMenu 
      bind:showSettingsModal={showSettingsModal}
      bind:activeSettingsTab={activeSettingsTab}
      bind:hasRules
      bind:enableSponsorships
      bind:includeAdvanced
      bind:darkMode
      bind:showTeamSummary
      bind:showGaslandsMath
      bind:printStyle
      bind:showEquipmentDescriptions
      bind:showPerkDescriptions
      bind:showExperimentalFeatures
      bind:showOnPlayersMap
      bind:allowContactFromPlayers
      bind:location
      bind:receiveUpdates
      saveSettingsToFirebase={saveSettingsToFirebase}
    />
    


</section>

{#if showRulesAcknowledgmentModal}
  <div
    class="fixed inset-0 bg-black/90 z-50"
    role="dialog"
    aria-modal="true"
    aria-label="Gaslands Rules Acknowledgment"
    tabindex="-1"
  >
    <button
      class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
      on:click={() => (showRulesAcknowledgmentModal = false)}
      on:keydown={e => e.key === 'Escape' && (showRulesAcknowledgmentModal = false)}
      aria-label="Close modal background"
    ></button>
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6 md:p-8 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
      role="document"
      style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-stone-800 dark:text-white">Gaslands Rules Required</h3>
        <button
          class="py-0.25 px-2 h-[32px] flex items-center justify-center rounded transition-colors text-sm amber-button"
          on:click={() => (showRulesAcknowledgmentModal = false)}
          aria-label="Close rules acknowledgment modal"
          style="height: 32px !important; min-height: 32px !important;"
        >
          <span>Close</span>
        </button>
      </div>

      <div class="space-y-4">
        <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30">
          <p class="text-stone-800 dark:text-white mb-4">
            To use the Play Mode or Print features of Gaslands Garage, you need to acknowledge that you own a copy of the <strong>Gaslands Refuelled</strong> rulebook.
          </p>

          <p class="text-stone-700 dark:text-gray-300 mb-4">
            This app is a companion to the tabletop game and is designed to be used alongside the official rules, not as a replacement.
          </p>

          <div class="flex items-center mb-4">
            <input
              type="checkbox"
              id="rules-acknowledgment"
              bind:checked={hasRules}
              class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
            />
            <label for="rules-acknowledgment" class="ml-3 text-stone-800 dark:text-white font-medium">
              I confirm that I own the Gaslands Refuelled rulebook
            </label>
          </div>

          <p class="text-stone-600 dark:text-gray-400 text-sm italic">
            You can purchase the rulebook from <a href="https://ospreypublishing.com/uk/gaslands-refuelled-9781472838445/" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Osprey Publishing</a> or other game retailers.
          </p>
        </div>

        {#if !$user}
          <div class="p-4 rounded-lg bg-stone-100 dark:bg-gray-700">
            <h4 class="font-medium text-stone-800 dark:text-white mb-2">Save your preferences</h4>
            <p class="text-stone-700 dark:text-gray-300 mb-3">
              Log in to save this preference so you won't be asked again.
            </p>

            <div class="flex justify-end">
              <button
                class="py-2 px-4 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                on:click={() => {
                  showRulesAcknowledgmentModal = false;
                  if (rulesModalAction === 'playMode' && hasRules) {
                    playMode = !playMode;
                  }
                  else if (rulesModalAction === 'printTeam' && hasRules) {
                    // Use the same wrapper function as used elsewhere
                    console.log('[Rules Modal] Printing after acknowledgment');
                    // Just set the flag - printWithRulesCheck will handle checking
                    isPrinting = false;
                    printWithRulesCheck();
                  }
                }}
              >
                Continue without logging in
              </button>
            </div>
          </div>
        {:else}
          <div class="flex justify-end">
            <button
              class="py-2 px-4 bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
              on:click={() => {
                saveSettingsToFirebase();
                showRulesAcknowledgmentModal = false;
                if (rulesModalAction === 'playMode' && hasRules) {
                  playMode = !playMode;
                }
                else if (rulesModalAction === 'printTeam' && hasRules) {
                  // Use the same wrapper function as used elsewhere
                  console.log('[Rules Modal] Printing after saving acknowledgment');
                  // Just set the flag - printWithRulesCheck will handle checking
                  isPrinting = false;
                  printWithRulesCheck();
                }
              }}
            >
              Save & Continue
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- No print view needed - using standalone print system -->
<!-- Hidden QR code for new print system to use -->
<img id="print-qr-code" src="" alt="QR Code" style="display: none;" />