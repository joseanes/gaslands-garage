<!-- Updated from the content provided by the user - Refactored with VehicleCard component -->
<script lang="ts">
	import { nanoid } from 'nanoid';
	import { validateDraft } from '$lib/validate';
	import type { Draft, Validation } from '$lib/validate/model';
	import { encodeDraft, decodeDraft } from '$lib/draft/io';
	import { goto } from '$app/navigation';
	import { draftToDataURL } from '$lib/draft/qr';
	import Auth from '$lib/components/Auth.svelte';
	import VehicleCard from '$lib/components/VehicleCard.svelte';
	import { user } from '$lib/firebase';
import { getUserSettings, saveUserSettings, DEFAULT_SETTINGS } from '$lib/services/settings';
import { saveTeam, getUserTeams } from '$lib/services/team';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

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
  
  // Sort all data alphabetically
  $: sortedSponsors = [...sponsors].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedVehicleTypes = [...filteredVehicleTypes].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedWeapons = [...weapons].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedUpgrades = [...upgrades].sort((a, b) => a.name.localeCompare(b.name));
  $: sortedPerks = [...perks].sort((a, b) => a.name.localeCompare(b.name));

	/* ---------- UI state ---------- */
	let sponsorId: string = sponsors[0]?.id ?? '';
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

	function addVehicle(type = filteredVehicleTypes[0]?.id) {
		const vt = vehicleTypes.find((v) => v.id === type)!;
		vehicles = [
			...vehicles,
			{
				id: nanoid(6),
				type: vt.id,
				name: `New ${vt.name}`,
				weapons: [],
				weaponFacings: {},
				upgrades: [],
				perks: []
			}
		];
	}

	function removeVehicle(id: string) {
		vehicles = vehicles.filter((v) => v.id !== id);
		collapsedVehicles.delete(id);
		collapsedVehicles = collapsedVehicles; // Trigger reactivity
	}

	function cloneVehicle(id: string) {
		const sourceVehicle = vehicles.find(v => v.id === id);
		if (!sourceVehicle) return;

		// Generate new IDs for the cloned vehicle and its weapons
		const clonedVehicleId = nanoid(6);
		const clonedWeaponFacings: Record<string, string> = {};

		// Clone the weapons with new instance IDs
		const clonedWeapons = sourceVehicle.weapons.map(weaponId => {
			const baseParts = weaponId.split('_');
			const baseWeaponId = baseParts[0];
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

		// Force validation to run immediately
		currentDraft = {
			...currentDraft,
			vehicles
		};
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
		
		const currentBuildSlots = calculateUsedBuildSlots(vehicle);
		const weaponBuildSlots = weaponObj.buildSlots || weaponObj.slots || 1;
		
		// Skip buildSlot validation for free weapons
		const isSpecialFreeWeapon = ['handgun', 'molotov', 'grenades', 'ram', 'oil_slick', 'smokescreen'].includes(weaponObj.id) || weaponBuildSlots === 0;
		
		// Validate build slots unless it's a free weapon
		if (!isSpecialFreeWeapon && currentBuildSlots + weaponBuildSlots > vehicleType.buildSlots) {
			console.warn(`Cannot add weapon ${weaponObj.name} - exceeds build slot limit`);
			return; // Do not add the weapon if it would exceed build slots
		}
		
		// Apply weapon facing rules:
		// 1. Crew Fired weapons are always 360° (any)
		// 2. Dropped weapons are rear or side only (default to rear)
		// 3. Fixed facing weapons use their specified facing
		// 4. Otherwise use provided facing or default to front
		let actualFacing = 'front';
		
		if (weaponObj.crewFired) {
			actualFacing = 'any'; // Crew fired weapons are always 360°
		} else if (weaponObj.dropped) {
			actualFacing = 'rear'; // Dropped weapons default to rear
		} else if (weaponObj.facing && weaponObj.facing !== 'any') {
			actualFacing = weaponObj.facing; // Use fixed facing
		} else if (facing) {
			actualFacing = facing; // Use provided facing
		}
		
		vehicles = vehicles.map(v => {
			if (v.id === vehicleId) {
				// Generate a unique ID for this weapon instance
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
		
		const currentBuildSlots = calculateUsedBuildSlots(vehicle);
		const upgradeBuildSlots = upgradeObj.buildSlots || upgradeObj.slots || 1;
		
		// Skip buildSlot validation for free upgrades
		const isSpecialFreeUpgrade = ['grenades'].includes(upgradeObj.id) || upgradeBuildSlots === 0;
		
		// Validate build slots unless it's a free upgrade
		if (!isSpecialFreeUpgrade && currentBuildSlots + upgradeBuildSlots > vehicleType.buildSlots) {
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

	function calculateTotalAttackDice(vehicle): number {
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
	let showImportModal = false;
	let showSettingsModal = false;
	let printStyle = localStorage.getItem('printStyle') || DEFAULT_SETTINGS.printStyle;
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

						// Initialize new settings with defaults if not present
						showTeamSummary = result.settings.showTeamSummary !== undefined
							? result.settings.showTeamSummary
							: DEFAULT_SETTINGS.showTeamSummary;

						showGaslandsMath = result.settings.showGaslandsMath !== undefined
							? result.settings.showGaslandsMath
							: DEFAULT_SETTINGS.showGaslandsMath;
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
	let enableSponsorships = true;
	let includeAdvanced = true;
	let maxCans = 50;
	let teamName = "My Gaslands Team";

	// Mode toggle for Edit/Play mode
	let playMode = false;

	// Display settings
	let showTeamSummary = true;
	let showGaslandsMath = true;

	// For vehicle card collapse state
	let collapsedVehicles = new Set();
	let darkMode = false;

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
					printStyle
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
		// Generate QR code and show the modal
		qrDataUrl = await draftToDataURL(currentDraft);
	}

	async function printTeam() {
		// Generate a fresh QR code for printing without showing the modal
		const printQrCode = await draftToDataURL(currentDraft);

		// Get the hidden QR code element in the print view
		const hiddenQrImage = document.querySelector('#print-qr-code');
		if (hiddenQrImage) {
			// Set the QR code directly to this element without triggering the modal
			hiddenQrImage.src = printQrCode;

			// Make sure the image is visible (in case it was hidden)
			hiddenQrImage.style.display = "block";

			// Hide any placeholder that might be showing
			const placeholder = document.querySelector('.qr-code-placeholder');
			if (placeholder) {
				placeholder.style.display = "none";
			}
		}

		// Apply the correct print format to the body element
		if (printStyle && typeof document !== 'undefined') {
			document.body.setAttribute('data-print-format', printStyle);
		}

		// Give the browser a moment to render the QR code into the DOM
		setTimeout(() => {
			window.print();

			// After printing, reset the body attribute
			if (typeof document !== 'undefined') {
				document.body.removeAttribute('data-print-format');
			}

			// Reset the QR code display after printing
			if (hiddenQrImage) {
				setTimeout(() => {
					hiddenQrImage.style.display = 'none';
					// Show placeholder again
					const placeholder = document.querySelector('.qr-code-placeholder');
					if (placeholder) placeholder.style.display = 'block';
				}, 500);
			}
		}, 300);
	}

	function importBuild() {
		showImportModal = true;
	}

	function openSettings() {
		showSettingsModal = true;
	}
	
	// Expose these functions to the global window object for use by the layout
	onMount(() => {
		if (typeof window !== 'undefined') {
			window.copyDraftFn = copyDraft;
			window.shareLinkFn = shareLink;
			window.generateQRCodeFn = generateQRCode;
			window.importBuildFn = importBuild;
			window.printTeamFn = printTeam;
			window.openSettingsFn = openSettings;
			window.openTeamsModalFn = () => { showTeamsModal = true; };

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
				window.copyDraftFn = undefined;
				window.shareLinkFn = undefined;
				window.generateQRCodeFn = undefined;
				window.importBuildFn = undefined;
				window.printTeamFn = undefined;
				window.openSettingsFn = undefined;
				window.openTeamsModalFn = undefined;
				window.currentDraftFn = undefined;
				window.importDraftFn = undefined;
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
	// When enableSponsorships is disabled, clear sponsor selection
	$: if (!enableSponsorships) {
		sponsorId = '';
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
				const baseWeaponId = weaponInstanceId.split('_')[0];
				const weapon = weapons.find(w => w.id === baseWeaponId);
				return weapon && !weapon.advanced;
			}),
			// Also clean up any facings for removed weapons
			weaponFacings: v.weaponFacings ? 
				Object.fromEntries(
					Object.entries(v.weaponFacings).filter(([weaponInstanceId]) => {
						const baseWeaponId = weaponInstanceId.split('_')[0];
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
	let validation: Validation = { cans: 0, errors: [], vehicleReports: [] };

	// Function to force validation to run immediately
	function forceValidation() {
		// Force reactivity by creating a new currentDraft object
		currentDraft = { ...currentDraft };
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
		
		validation = validationCopy;
	});
	$: totalCans = validation.cans;
	$: teamErrors = validation.errors;
	
	/* ---------- filtered assets based on settings ---------- */
	// Filter vehicle types based on includeAdvanced setting
	$: filteredVehicleTypes = includeAdvanced 
		? vehicleTypes 
		: vehicleTypes.filter(v => !v.advanced);
	
	// Filter weapons based on includeAdvanced setting
	$: filteredWeapons = includeAdvanced 
		? weapons 
		: weapons.filter(w => !w.advanced);
	
	// Filter upgrades based on includeAdvanced setting
	$: filteredUpgrades = includeAdvanced 
		? upgrades 
		: upgrades.filter(u => !u.advanced);
	
	// Get available perks for the current sponsor
	$: currentSponsor = sponsors.find(s => s.id === sponsorId);
	$: availablePerks = enableSponsorships
		? perks.filter(p => currentSponsor?.perks.includes(p.id))
		: [];

	/* ---------- import box ---------- */
	let importString = '';
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

.no-card-padding {
	padding: 0 !important;
}

/* Tooltip styles */
.tooltip {
	position: relative;
	display: inline-block;
	cursor: help;
	border-bottom: 1px dotted #666;
}

.tooltip:hover::after {
	content: attr(title);
	position: absolute;
	bottom: 125%;
	left: 50%;
	transform: translateX(-50%);
	background-color: rgba(0, 0, 0, 0.8);
	color: white;
	padding: 6px 10px;
	border-radius: 4px;
	font-size: 0.8rem;
	white-space: nowrap;
	z-index: 50;
	text-align: center;
	pointer-events: none;
	min-width: 200px;
	max-width: 300px;
	white-space: normal;
}

.tooltip:hover::before {
	content: "";
	position: absolute;
	bottom: 100%;
	left: 50%;
	transform: translateX(-50%);
	border-width: 5px;
	border-style: solid;
	border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
	z-index: 50;
	pointer-events: none;
}

/* Vehicle type icon styles */
.vehicle-type-icon {
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  display: inline-block;
}

.vehicle-type-car { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M5 13a2 2 0 0 1-2-2c0-1.1.9-2 2-2c1.1 0 2 .9 2 2c0 1.1-.9 2-2 2zm14 0a2 2 0 0 1-2-2c0-1.1.9-2 2-2c1.1 0 2 .9 2 2c0 1.1-.9 2-2 2zM19 11h-1l-1.71-7.67A2.5 2.5 0 0 0 13.92 1H10.08C8.77 1 7.66 1.94 7.29 3.33L5.6 11H5c-1.66 0-3 1.34-3 3v3h1.5v-1.5h17V17H22v-3c0-1.66-1.34-3-3-3zm-7-7.5h2.62l1.5 7.5H12V3.5zM8.38 3.5H11v7.5H6.9l1.48-7.5z'/%3E%3C/svg%3E"); }

.vehicle-type-buggy { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z'/%3E%3C/svg%3E"); }

.vehicle-type-performance_car { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M16 6l3 4h2c1.11 0 2 .89 2 2v3h-2c0 1.66-1.34 3-3 3s-3-1.34-3-3H9c0 1.66-1.34 3-3 3s-3-1.34-3-3H1v-3c0-1.11.89-2 2-2l3-4h10m-5.5 1.5H9V10H7.25V7.5H6v6h1.25V11.5H9v2.5h1.5v-6m7 0h-3v6H16v-2h1c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1m0 3H16v-1.5h1.5V10.5M6 13.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5m12 0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z'/%3E%3C/svg%3E"); }

.vehicle-type-pickup { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M6 5H4v16c0 1.1.9 2 2 2h10v-2H6V5zm16 2h-8l-2-2H8v14h14V7zm-3 8H9v-2h10v2z'/%3E%3C/svg%3E"); }

.vehicle-type-van { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18 4v7h-6V4h6m1-2h-8c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-10 9H5c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-5c0-.55-.45-1-1-1zM9 17H5v-3h4v3zm8-4v2h2v2h-5v-4h3z'/%3E%3C/svg%3E"); }

.vehicle-type-monster_truck { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 10c-1.1 0-2 .9-2 2h-1V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-4c0-1.1-.9-2-2-2h-3zm-9 7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7-6h3.5c.28 0 .5.22.5.5V13h-4v-2zm-5 0v2h-4V9.48c1.68.5 2.8 1.94 2.95 3.52H15zm3 6c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z'/%3E%3C/svg%3E"); }

.vehicle-type-heavy_truck { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5-9l1.96 2.5H17V9.5h2.5zM6 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM20 8l-3-4H3c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h1c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1h-3z'/%3E%3C/svg%3E"); }

.vehicle-type-bus { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z'/%3E%3C/svg%3E"); }

.vehicle-type-war_rig { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z'/%3E%3C/svg%3E"); }

.vehicle-type-tank { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z'/%3E%3C/svg%3E"); }

/* Weight class indicators */
.weight-class-indicator {
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.9em;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.weight-1 {
  background-color: #a7f3d0;
  color: #065f46;
}

.weight-2 {
  background-color: #fde68a;
  color: #92400e;
}

.weight-3 {
  background-color: #fca5a5;
  color: #991b1b;
}

.weight-4 {
  background-color: #c7d2fe;
  color: #312e81;
}

/* Interactive dashboard styles */
.hull-checkbox, .crew-checkbox {
  display: inline-block;
  position: relative;
  margin: 2px;
}

.hull-checkbox-input, .crew-checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.hull-checkbox-label {
  display: block;
  width: 20px;
  height: 20px;
  background-color: #fff;
  border: 2px solid #333;
  border-radius: 4px;
  cursor: pointer;
}

.crew-checkbox-label {
  display: block;
  width: 20px;
  height: 20px;
  background-color: #fff;
  border: 2px solid #333;
  border-radius: 50%;
  cursor: pointer;
}

.hull-checkbox-input:checked + .hull-checkbox-label {
  background-color: #ef4444;
  border-color: #991b1b;
}

.crew-checkbox-input:checked + .crew-checkbox-label {
  background-color: #f59e0b;
  border-color: #b45309;
}

.gear-range {
  -webkit-appearance: none;
  appearance: none;
  height: 10px;
  border-radius: 5px;
  outline: none;
}

.gear-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f59e0b;
  border: 2px solid #b45309;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.gear-range::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f59e0b;
  border: 2px solid #b45309;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

/* Hide print view by default */
#gaslands-print-view {
  display: none;
}

/* Print styles */
@media print {
  /* Hide elements that shouldn't be printed */
  .menu-bar,
  button[aria-label="Remove vehicle"],
  button[aria-label="Remove weapon"],
  button[aria-label="Remove upgrade"],
  button[aria-label="Remove perk"],
  .relative select,
  #import-draft,
  .bg-red-50,
  .bg-green-50,
  .print-hide {
    display: none !important;
  }
  
  /* Page formatting */
  @page { 
    size: 8.5in 11in portrait; 
    margin: 0.5cm;
  }
  
  section {
    background-color: white !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  
  /* Reset padding from header for print */
  #builder-ui {
    padding-top: 0 !important;
  }
  
  /* Hide non-print components */
  .bg-white, .bg-stone-100, #builder-ui, .p-4, .p-5, .p-6 {
    display: none !important;
  }
  
  /* General text formatting applied to print view container */
  #gaslands-print-view { 
    color: #000; 
    font-family: Arial, sans-serif; 
    display: block !important;
  }
  
  /* Force background printing */
  * { 
    -webkit-print-color-adjust: exact !important; 
    color-adjust: exact !important; 
  }
  
  /* Print-specific styles */
  @media print {
    /* Print styles already covered in parent media query */
  }
  
  /* Vehicle card styling */
  .vehicle-card-print {
    width: 320px;
    height: 340px;
    vertical-align: top;
    padding: 16px;
    border: 3px solid #000;
    page-break-inside: avoid;
    margin-bottom: 20px;
    display: inline-block;
    position: relative;
    box-sizing: border-box;
    background-color: #f8f8f8;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
  
  /* Text styling */
  .uppercase { text-transform: uppercase; }
  .bold { font-weight: bold; }
  
  /* Hull boxes */
  .hull-box {
    width: 14px;
    height: 14px;
    background-color: #fff;
    border: 2px solid #000;
    display: inline-block;
    margin: 2px;
    border-radius: 2px;
  }
  
  /* Vehicle card sections */
  .card-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
    border-bottom: 2px solid #222;
    padding-bottom: 8px;
  }
  
  .card-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .card-name {
    font-size: 1.3em;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .vehicle-type-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    color: white;
    font-size: 0.8em;
    font-weight: bold;
    text-shadow: 0 1px 1px rgba(0,0,0,0.5);
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
  
  .card-cost {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px solid #000;
    padding: 2px 12px;
    border-radius: 6px;
    background-color: #fff;
    font-size: 0.8em;
    font-weight: bold;
  }
  
  .cost-value {
    font-size: 2em;
    font-weight: bold;
    line-height: 1;
  }
  
  /* Stats section */
  .stats-grid {
    margin-bottom: 16px;
  }
  
  .stat-block {
    margin-bottom: 8px;
  }
  
  .stats-row {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #ddd;
  }
  
  .stat-label {
    font-weight: bold;
    font-size: 0.9em;
    text-transform: uppercase;
    margin-bottom: 2px;
    color: #444;
  }
  
  .stat-value {
    font-size: 1.1em;
    font-weight: bold;
    text-align: center;
    padding: 3px 8px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
  }
  
  .hull-tracker {
    display: flex;
    flex-wrap: wrap;
    max-width: 100%;
    padding: 3px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
  }
  
  /* Loadout sections */
  .loadout {
    font-size: 0.85em;
  }
  
  .loadout-section {
    margin-bottom: 10px;
  }
  
  .section-header {
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 4px;
    font-size: 0.9em;
    padding: 2px 0;
    border-bottom: 1px solid #aaa;
  }
  
  .loadout-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .loadout-table tr:nth-child(odd) {
    background-color: rgba(0,0,0,0.05);
  }
  
  .item-name {
    font-weight: bold;
    padding: 2px 4px;
  }
  
  .item-facing {
    text-align: center;
    font-style: italic;
    padding: 2px 4px;
    width: 60px;
  }
  
  .item-attack {
    text-align: right;
    font-weight: bold;
    padding: 2px 4px;
    width: 40px;
  }
  
  .upgrade-list {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }
  
  .upgrade-list li {
    padding: 3px 4px;
  }
  
  .upgrade-list li:nth-child(odd) {
    background-color: rgba(0,0,0,0.05);
  }
  
  .card-footer {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    font-weight: bold;
    border-top: 1px solid #aaa;
    padding-top: 8px;
    font-size: 0.9em;
  }
  
  .perk-label {
    text-transform: uppercase;
    font-weight: bold;
  }
  
  /* Team summary styling */
  .sponsor-print-header {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid black;
    padding-bottom: 10px;
  }
  
  .sponsor-print-header h1 {
    font-size: 24pt;
    margin-bottom: 5px;
  }
  
  .print-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    page-break-inside: auto;
  }
  
  .print-section {
    page-break-inside: avoid;
    margin-bottom: 20px;
  }
  
  
  .rotate90 {
    display: inline-block;
    transform: rotate(-90deg);
    margin-right: 10px;
    font-weight: bold;
  }
  
  .vehicle-type {
    font-size: 0.9em;
    font-weight: bold;
  }
  
  /* Perk details section below cards */
  #perk-details-print {
    margin-top: 30px;
    border-top: 2px solid #999;
    padding-top: 15px;
  }
  
  #perk-details-print h2 {
    font-size: 14pt;
    margin-bottom: 10px;
  }
  
  .perk-list {
    column-count: 2;
    column-gap: 30px;
  }
  
  .perk-item {
    margin-bottom: 10px;
    break-inside: avoid;
  }
  
  /* QR Code and footer styling */
  .print-footer {
    width: 100%;
    margin-top: 30px;
    border-top: 1px solid #ddd;
    padding-top: 10px;
    page-break-inside: avoid;
    display: flex;
    align-items: flex-end;
  }
  
  .qr-code-container {
    width: 120px;
    text-align: center;
  }
  
  .qr-code-image {
    width: 100px;
    height: 100px;
    border: 1px solid black;
    background-color: white;
    margin: 0 auto 5px auto;
  }
  
  .qr-code-placeholder {
    width: 100px;
    height: 100px;
    border: 1px solid black;
    background-color: white;
    margin: 0 auto 5px auto;
    text-align: center;
    line-height: 100px;
  }
  
  .qr-code-caption {
    font-size: 8pt;
  }
  
  .print-footer-text {
    flex: 1;
    font-size: 10pt;
    color: #666;
    text-align: center;
  }
}
</style>

<section id="builder-ui" class="p-4 md:p-6 bg-stone-100 min-h-screen w-full {darkMode ? 'dark' : ''}">
	<header class="mb-6 md:mb-8">
		<div class="text-3xl md:text-4xl font-extrabold text-stone-800 dark:text-gray-100 tracking-tight flex flex-wrap justify-between items-center">
			<div class="flex flex-col gap-4">
				<div class="flex items-center gap-2 justify-between">
					<div class="flex items-center">
						<b class="text-lg font-bold whitespace-nowrap">Team Name:</b>&nbsp;&nbsp;&nbsp;
						<input
							type="text"
							bind:value={teamName}
							class="bg-transparent border-b-2 border-amber-500 px-3 py-1 font-extrabold text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-600 min-w-[200px] w-auto text-2xl md:text-3xl"
							aria-label="Team Name"
						/>
					</div>

					<!-- Edit/Play Mode Toggle Button -->
					<button
						class="flex items-center px-3 py-1 bg-stone-300 dark:bg-gray-700 rounded-full transition-colors shadow-sm gap-2 hover:bg-stone-400 dark:hover:bg-gray-600 ml-4"
						on:click={() => playMode = !playMode}
					>
						<span class="w-4 h-4 rounded-full {playMode ? 'bg-green-500' : 'bg-amber-500'} transition-colors"></span>
						<span class="text-sm font-medium">{playMode ? 'Edit Team' : 'Play Mode'}</span>
					</button>
				</div>
				<div class="flex items-center gap-2">
					<b class="text-lg font-bold whitespace-nowrap">Cans: </b>&nbsp;&nbsp;&nbsp;
					<span class="font-extrabold text-amber-700 dark:text-amber-300 text-2xl md:text-3xl mr-2">{totalCans || 0}</span>
					<span class="text-lg font-bold text-amber-700 dark:text-amber-300">/</span>
					<input
						type="number"
						bind:value={maxCans}
						min="1"
						max="1000"
						class="bg-transparent border-b-2 border-amber-500 px-3 py-1 font-extrabold text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-600 min-w-[100px] w-auto text-2xl md:text-3xl"
						aria-label="Maximum Cans"
					/>
					<button
						class="ml-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-sm transition-all shadow-md disabled:opacity-50 flex items-center"
						on:click={quickSaveTeam}
						disabled={quickSaving}
					>
						{#if quickSaving}
							<div class="animate-spin mr-2 h-4 w-4 border-b-2 border-white rounded-full"></div>
							Saving...
						{:else}
							Quick Save
						{/if}
					</button>
				</div>
			</div>
		</div>
		<!-- <p class="text-stone-600 mt-2 text-sm md:text-base">Create a deadly team and dominate the wasteland</p> -->
	</header>

	<!-- Sponsor selector (only shown if enableSponsorships is true) -->
	{#if enableSponsorships}
		<div class="bg-white p-5 rounded-lg shadow-md mb-6">
			<div class="flex flex-wrap md:flex-nowrap items-start gap-4">
				<div class="w-full md:w-1/3">
					<div class="flex items-center gap-4">
						<b class="text-lg font-bold whitespace-nowrap">
							Choose Your Sponsor: &nbsp;&nbsp;
						</b>
						<div class="relative flex-grow">
							<select
								id="sponsor-select"
								bind:value={sponsorId}
								class="form-select"
							>
								{#each [...sponsors].sort((a, b) => a.name.localeCompare(b.name)) as s}
    <option value={s.id}>{s.name}</option>
  {/each}
							</select>
						</div>

					</div>
				</div>
				<div class="w-full md:w-2/3 md:pt-8">
					{#if currentSponsor?.perks?.length}
						<div class="mt-2 text-sm text-stone-700 dark:text-gray-300">
							<span class="font-medium">Available Perks:</span> 
							<span class="inline ml-2">
								{#each perks.filter(p => currentSponsor?.perks.includes(p.id)) as perk, i}
								&nbsp;<span 
										class="tooltip inline mr-1"
										title="{perk.name} (Level {perk.level}): {perk.text}"
									>
										{perk.name}{i < perks.filter(p => currentSponsor?.perks.includes(p.id)).length - 1 ? ', ' : ''}
									</span>
								{/each}
							</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<!-- Show info message when sponsorships are disabled -->
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
<hr>
	<!-- Vehicle list -->
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-4">
				<h2 class="text-2xl font-bold text-stone-800 dark:text-gray-100">Vehicles</h2>
			</div>
			<button
				class="py-2 px-4 flex items-center justify-center bg-amber-500 text-white hover:bg-amber-600 rounded-md transition-colors"
				on:click={() => addVehicle()}
				disabled={playMode}
				class:opacity-50={playMode}
				class:cursor-not-allowed={playMode}
			>
				<span>+ Add Vehicle</span>
			</button>
		</div>

		{#if vehicles.length === 0}
			<div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
				<p class="text-stone-600 dark:text-gray-300 text-lg font-bold mb-4">Your team has no vehicles yet. Get started by adding a vehicle to your team.</p>


			</div>

			<!-- About Gaslands Content when no vehicles -->
			<div class="mt-10 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-2 border-amber-400">
				<div class="flex justify-between items-center mb-6">
					<h3 class="text-xl font-bold text-stone-800 dark:text-white">About Gaslands</h3>
				</div>

				<div class="space-y-6 text-stone-700 dark:text-gray-200">
					<p>
						Gaslands is a tabletop game of post-apocalyptic vehicular combat. Using converted Hot Wheels or Matchbox cars, it simulates a televised bloodsport where drivers compete in a variety of deadly scenarios. Gaslands puts players in control of custom battle cars, buggies, trucks, and other vehicles armed with machine guns, rockets, flamethrowers and more.
					</p>

					<h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">What You Need to Start Playing:</h4>
					<ul class="list-disc pl-5 space-y-2">
						<li><a href="https://amzn.to/4m7OQYa" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Rulebook</a> - The Gaslands Refuelled rulebook contains all the rules and scenarios</li>
						<li><a href="https://creatoriq.cc/434pUIp" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Dice</a> - Special dice designed for the game</li>
						<li><a href="https://amzn.to/4kaUcA2" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Regular 6-Sided Dice</a> - For resolving various game mechanics</li>
						<li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Templates</a> - Movement templates for driving your vehicles</li>
						<li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Vehicles</a> - Hotwheels or Matchbox cars that you can modify</li>
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
				{#each vehicles as v (v.id)}
					<VehicleCard
						vehicle={v}
						vehicleTypes={vehicleTypes}
						weapons={weapons}
						upgrades={upgrades}
						perks={perks}
						vehicleRules={vehicleRules}
						collapsed={collapsedVehicles.has(v.id)}
						usedBuildSlots={calculateUsedBuildSlots(v)}
						playMode={playMode}
						validationReport={validation.vehicleReports.find(r => r.vehicleId === v.id)}
						hazardCount={getHazardCount(v.id)}
						filteredWeapons={filteredWeapons}
						filteredUpgrades={filteredUpgrades}
						filteredPerks={perks.filter(p => currentSponsor?.perks.includes(p.id))}
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
						on:vehicleTypeChanged={() => forceValidation()}
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
			<div class="flex flex-wrap items-center gap-2">
				<span class="font-medium text-stone-800">Sponsor:</span>
				<span class="font-bold text-amber-700">{currentSponsor?.name || 'None'}</span>
				
				{#if currentSponsor?.perks?.length}
					<span class="mx-2 text-stone-400">|</span>
					<span class="font-medium text-stone-800">Perks:</span>
					<span class="text-stone-700 inline ml-2">
						{#each perks.filter(p => currentSponsor?.perks.includes(p.id)) as perk, i}
							<span class="tooltip inline" title="{perk.name} (Level {perk.level}): {perk.text}">
								{perk.name}{i < perks.filter(p => currentSponsor?.perks.includes(p.id)).length - 1 ? ', ' : ''}
							</span>
						{/each}
					</span>
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
    {#if qrDataUrl}
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
          on:click={() => (qrDataUrl = null)}
          on:keydown={e => e.key === 'Escape' && (qrDataUrl = null)}
          aria-label="Close modal background"
        ></button>
        <div 
          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-10 border-2 border-amber-500 z-10 fixed left-1/2 top-1/2 w-auto max-w-md overflow-y-auto transform -translate-x-1/2 -translate-y-1/2 max-h-[90vh]"
          role="document"
          style="box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
        >
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Team QR Code</h3>
            <button
              class="text-stone-400 hover:text-stone-600 dark:text-gray-300 dark:hover:text-white transition-colors"
              on:click={() => (qrDataUrl = null)}
              aria-label="Close QR code modal"
            >
              <span class="text-2xl">×</span>
              <span class="sr-only">Close</span>
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
              class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors shadow-md"
              on:click={() => (qrDataUrl = null)}
            >
              Close
            </button>
            <button
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md"
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
          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
        >
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Import Team Build</h3>
            <button
              class="text-stone-400 hover:text-stone-600 dark:text-gray-300 dark:hover:text-white transition-colors"
              on:click={() => (showImportModal = false)}
              aria-label="Close import modal"
            >
              <span class="text-2xl">×</span>
              <span class="sr-only">Close</span>
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
                class="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors shadow-md"
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
    {#if showSettingsModal}
      <div
        class="fixed inset-0 bg-black/90 z-50"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabindex="-1"
      >
        <!-- Adding a button to make the whole backdrop clickable/accessible -->
        <button
          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
          on:click={() => (showSettingsModal = false)}
          on:keydown={e => e.key === 'Escape' && (showSettingsModal = false)}
          aria-label="Close modal background"
        ></button>
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6 md:p-8 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500 settings-modal-content"
          role="document"
          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Settings</h3>
            <button
              class="text-stone-400 hover:text-stone-600 dark:text-gray-300 dark:hover:text-white transition-colors"
              on:click={() => (showSettingsModal = false)}
              aria-label="Close settings modal"
            >
              <span class="text-2xl">×</span>
              <span class="sr-only">Close</span>
            </button>
          </div>
          
          <div class="space-y-8 px-4">
            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="enable-sponsorships" 
                  bind:checked={enableSponsorships}
                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="enable-sponsorships" class="ml-3 text-stone-800 dark:text-white font-medium">
                  Enable Sponsorships
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8 border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                If you prefer to build a team without using Sponsor or driver perks, uncheck this option.
              </p>
            </div>
            
            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="include-advanced" 
                  bind:checked={includeAdvanced}
                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="include-advanced" class="ml-3 text-stone-800 dark:text-white font-medium">
                  Include Advanced
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8 border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                Enable this option to include advanced vehicles, weapons, and upgrades from the rulebook. When disabled, only basic options will be shown.
              </p>
            </div>
            
            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="dark-mode"
                  bind:checked={darkMode}
                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="dark-mode" class="ml-3 text-stone-800 dark:text-white font-medium">
                  Dark Mode
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8 border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                Enable dark mode for better visibility in low-light conditions.
              </p>
            </div>

            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="show-team-summary"
                  bind:checked={showTeamSummary}
                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="show-team-summary" class="ml-3 text-stone-800 dark:text-white font-medium">
                  Show Team Summary
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8 border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                Show or hide the Team Summary section at the bottom of the page.
              </p>
            </div>

            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="show-gaslands-math"
                  bind:checked={showGaslandsMath}
                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="show-gaslands-math" class="ml-3 text-stone-800 dark:text-white font-medium">
                  Show Gaslands Math
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8 border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                Show or hide the Gaslands Math section at the bottom of the page.
              </p>
            </div>

            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
              <h4 class="font-medium text-stone-800 dark:text-white mb-3">Print Style</h4>
              <div class="space-y-2">
                <div class="flex items-center">
                  <input
                    type="radio"
                    id="print-style-classic"
                    name="print-style"
                    value="classic"
                    bind:group={printStyle}
                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
                  />
                  <label for="print-style-classic" class="ml-3 text-stone-800 dark:text-white">
                    Classic
                  </label>
                </div>
                <div class="flex items-center">
                  <input
                    type="radio"
                    id="print-style-compact"
                    name="print-style"
                    value="compact"
                    bind:group={printStyle}
                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
                  />
                  <label for="print-style-compact" class="ml-3 text-stone-800 dark:text-white">
                    Compact
                  </label>
                </div>
                <div class="flex items-center">
                  <input
                    type="radio"
                    id="print-style-dashboard"
                    name="print-style"
                    value="dashboard"
                    bind:group={printStyle}
                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
                  />
                  <label for="print-style-dashboard" class="ml-3 text-stone-800 dark:text-white">
                    Dashboard
                  </label>
                </div>
                <div class="flex items-center">
                  <input
                    type="radio"
                    id="print-style-roster"
                    name="print-style"
                    value="roster"
                    bind:group={printStyle}
                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
                  />
                  <label for="print-style-roster" class="ml-3 text-stone-800 dark:text-white">
                    Roster
                  </label>
                </div>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8 border-l-2 border-amber-200 dark:border-amber-700 pl-3">
                Choose your preferred print layout style.
              </p>
            </div>

            <div class="flex justify-end pt-4 mt-4 border-t border-stone-200 dark:border-amber-900">
              <button
                class="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors shadow-md"
                on:click={() => {
                  if ($user) saveSettingsToFirebase();
                  showSettingsModal = false;
                }}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
    


</section>

<!-- Print-only view with vehicle cards -->
<div id="gaslands-print-view">
  <div class="sponsor-print-header">
    <h1>Gaslands: {teamName}</h1>
    <p>
      Total: {totalCans}/{maxCans} cans 
      {#if enableSponsorships && currentSponsor?.perks.length}
        | Sponsor: {currentSponsor?.name || ''} 
        | Perks: {perks.filter(p => currentSponsor?.perks.includes(p.id)).map(p => p.name).join(', ')}
      {/if}
    </p>
  </div>
  
  <div class="print-card-grid">
    {#each vehicles as v}
      <div class="vehicle-card-print" style="border-color: {vehicleTypes.find(vt => vt.id === v.type)?.color || '#f59e0b'};">
        <!-- Vehicle Card Header with Type & Cost -->
        <div class="card-header">
          <div class="card-title">
            <div class="card-name">{v.name}</div>
            <div class="vehicle-type-badge" style="background-color: {vehicleTypes.find(vt => vt.id === v.type)?.color || '#f59e0b'};">
              {vehicleTypes.find(vt => vt.id === v.type)?.name || 'Unknown'}
              {#if vehicleTypes.find(vt => vt.id === v.type)?.advanced} (Advanced){/if}
            </div>
          </div>
          <div class="card-cost">
            <div>Cost</div>
            <div class="cost-value">{validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'}</div>
            <div>cans</div>
          </div>
        </div>
        
        <!-- Stats Grid: A more structured layout -->
        <div class="stats-grid">
          <div class="stat-block">
            <div class="stat-label">Hull</div>
            <div class="hull-tracker">
              {#if calculateMaxHull(v) > (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0)}
                <span class="text-green-500 text-xs font-bold mr-1">(+{calculateMaxHull(v) - (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0)})</span>
              {/if}
              {#each Array(Math.min(10, calculateMaxHull(v))) as _, i}
                <span class="hull-box"></span>
              {/each}
            </div>
          </div>
          
          <div class="stats-row">
            <div class="stat-block">
              <div class="stat-label">Handling</div>
              <div class="stat-value">{vehicleTypes.find(vt => vt.id === v.type)?.handling || 4}</div>
            </div>
            
            <div class="stat-block">
              <div class="stat-label">Gear</div>
              <div class="stat-value">{vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 6}</div>
            </div>
            
            <div class="stat-block">
              <div class="stat-label">Crew</div>
              <div class="stat-value">{vehicleTypes.find(vt => vt.id === v.type)?.crew || 1}</div>
            </div>
            
            <div class="stat-block">
              <div class="stat-label">Weight</div>
              <div class="stat-value">
                {vehicleTypes.find(vt => vt.id === v.type)?.weight === 1 ? 'Light' : 
                vehicleTypes.find(vt => vt.id === v.type)?.weight === 2 ? 'Medium' : 
                vehicleTypes.find(vt => vt.id === v.type)?.weight === 3 ? 'Heavy' : 'Massive'}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Weapons & Upgrades in a clearer format -->
        <div class="loadout">
          {#if v.weapons.length > 0}
            <div class="loadout-section">
              <div class="section-header">Weapons</div>
              <table class="loadout-table">
                <tbody>
                  {#each v.weapons as weaponId}
                    {@const baseWeaponId = weaponId.split('_')[0]}
                    {@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
                    {@const facing = v.weaponFacings?.[weaponId] || weaponObj?.facing || 'front'}
                    <tr>
                      <td class="item-name">{weaponObj?.name || weaponId}</td>
                      <td class="item-facing">{facing}</td>
                      <td class="item-attack">{weaponObj?.attackDice || '-'}{weaponObj?.attackDice ? 'D' : ''}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          
          {#if v.upgrades.length > 0}
            <div class="loadout-section">
              <div class="section-header">Upgrades</div>
              <ul class="upgrade-list">
                {#each v.upgrades as upgradeId}
                  <li>{upgrades.find(u => u.id === upgradeId)?.name || upgradeId}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
        
        <!-- Perks at bottom -->
        {#if v.perks.length > 0}
          <div class="card-footer">
            <span class="perk-label">Perks:</span> {v.perks.map(id => perks.find(p => p.id === id)?.name || "").join(', ')}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  
  <!-- Perk details section -->
  <div id="perk-details-print">
    <h2>Weapons & Upgrades Details</h2>
    
    <div class="print-section">
      <h3>Weapons</h3>
      <div class="perk-list">
        {#each [...new Set(vehicles.flatMap(v => v.weapons))] as weaponId}
          {@const baseWeaponId = weaponId.split('_')[0]}
          {@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
          {#if weaponObj}
            <div class="perk-item">
              <strong>{weaponObj.name}</strong> - 
              {weaponObj.cost} cans
              {#if weaponObj.unique}
                (Unique)
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
    
    <div class="print-section">
      <h3>Upgrades</h3>
      <div class="perk-list">
        {#each [...new Set(vehicles.flatMap(v => v.upgrades))] as upgradeId}
          {#if upgrades.find(u => u.id === upgradeId)}
            <div class="perk-item">
              <strong>{upgrades.find(u => u.id === upgradeId)?.name}</strong> - 
              {upgrades.find(u => u.id === upgradeId)?.specialRules}
            </div>
          {/if}
        {/each}
      </div>
    </div>
    
    {#if enableSponsorships}
    <div class="print-section">
      <h3>Perks</h3>
      <div class="perk-list">
        {#each [...new Set(vehicles.flatMap(v => v.perks))] as perkId}
          {#if perks.find(p => p.id === perkId)}
            <div class="perk-item">
              <strong>{perks.find(p => p.id === perkId)?.name} (Level {perks.find(p => p.id === perkId)?.level})</strong> - 
              {perks.find(p => p.id === perkId)?.text}
            </div>
          {/if}
        {/each}
      </div>
    </div>
    {/if}
  </div>
  
  <!-- QR Code and footer -->
  <div class="print-footer">
    <div class="qr-code-container">
      {#if qrDataUrl}
        <img src={qrDataUrl} alt="QR Code" class="qr-code-image" />
      {:else}
        <!-- Hidden image element that will be updated when printing without showing the modal -->
        <img id="print-qr-code" src="" alt="QR Code" class="qr-code-image" />
        <!-- Placeholder is only shown when not printing -->
        <div class="qr-code-placeholder print-hide">QR Code</div>
      {/if}
      <div class="qr-code-caption">Scan to load team</div>
    </div>
    <div class="print-footer-text">
      Generated by Gaslands Garage on {new Date().toLocaleDateString()}
    </div>
  </div>
</div>