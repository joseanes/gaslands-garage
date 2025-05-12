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
  
	console.log('vehicleTypes', vehicleTypes);
  
	/* ---------- settings ---------- */
	let includeAdvanced = true;
	let enableSponsorships = true;
	let darkMode = false;
	let printStyle = 'classic';

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
			}
		} else {
			// Use default settings when not authenticated
			includeAdvanced = DEFAULT_SETTINGS.includeAdvanced;
			enableSponsorships = DEFAULT_SETTINGS.enableSponsorships;
			darkMode = DEFAULT_SETTINGS.darkMode;
			printStyle = DEFAULT_SETTINGS.printStyle || 'classic';
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
	let sponsorId: string = sponsors[0]?.id ?? '';
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
		console.log('addVehicle called');
		// Make sure we have a valid vehicle type
		const vt = vehicleTypes.find((v) => v.id === type);
		if (!vt) {
			console.error("No valid vehicle type found", type, vehicleTypes);
			
			// Try to use the first available vehicle type
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
	// let enableSponsorships = true;  // Already declared at the top
	// let includeAdvanced = true;     // Already declared at the top
	let maxCans = 50;
	let teamName = "My Gaslands Team";

	// Mode toggle for Edit/Play mode
	let playMode = false;

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

		// Make sure the print view is properly set up
		const printView = document.querySelector('#gaslands-print-view');
		if (printView) {
			// Ensure proper display
			printView.style.display = "block";
			printView.style.position = "relative";
			printView.style.visibility = "visible";
		}

		// Apply the correct print format to the body element
		if (printStyle && typeof document !== 'undefined') {
			document.body.setAttribute('data-print-format', printStyle);
		}

		// Hide all other content to prevent it from showing in the print output
		document.querySelectorAll('body > *:not(#gaslands-print-view)').forEach(el => {
			el.classList.add('print-hide');
		});

		// Give the browser a moment to render the QR code into the DOM
		setTimeout(() => {
			try {
				window.print();
			} catch (err) {
				console.error("Error during printing:", err);
			}

			// After printing, restore the original display state
			if (typeof document !== 'undefined') {
				// Reset format attribute
				document.body.removeAttribute('data-print-format');
				
				// Unhide all content
				document.querySelectorAll('.print-hide').forEach(el => {
					el.classList.remove('print-hide');
				});
				
				// Hide the print view again
				if (printView) {
					printView.style.display = "none";
				}
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
		}, 1000); // Increased timeout to ensure proper rendering
	}690-		showImportModal = true;
691-	}
692-
693-	function openSettings() {
694-		showSettingsModal = true;
695-	}
696-	
697-	// Expose these functions to the global window object for use by the layout
698-	onMount(() => {
699-		if (typeof window !== 'undefined') {
700-			window.copyDraftFn = copyDraft;
701-			window.shareLinkFn = shareLink;
702-			window.generateQRCodeFn = generateQRCode;
703-			window.importBuildFn = importBuild;
704-			window.printTeamFn = printTeam;
705-			window.openSettingsFn = openSettings;
706-			window.openTeamsModalFn = () => { showTeamsModal = true; };
707-
708-			// Add functions for the Teams Modal in the layout
709-			window.currentDraftFn = () => currentDraft;
710-			window.importDraftFn = (draft) => {
711-				if (draft) {
712-					sponsorId = draft.sponsor;
713-					vehicles = draft.vehicles;
714-
715-					// Import team name if available
716-					if (draft.teamName) {
717-						teamName = draft.teamName;
718-					}
719-
720-					// Import maxCans if available
721-					if (draft.maxCans) {
722-						maxCans = draft.maxCans;
723-					}
724-
725-					// Import darkMode if available
726-					if (draft.darkMode !== undefined) {
727-						darkMode = draft.darkMode;
728-					}
729-				}
730-			};
731-		}
732-
733-		return () => {
734-			// Clean up when component is destroyed
735-			if (typeof window !== 'undefined') {
736-				window.copyDraftFn = undefined;
737-				window.shareLinkFn = undefined;
738-				window.generateQRCodeFn = undefined;
739-				window.importBuildFn = undefined;
740-				window.printTeamFn = undefined;
741-				window.openSettingsFn = undefined;
742-				window.openTeamsModalFn = undefined;
743-				window.currentDraftFn = undefined;
744-				window.importDraftFn = undefined;
745-			}
746-		};
747-	});
748-
749-	function importDraftString() {
750-		const draft = decodeDraft(importString.trim());
751-		if (draft) {
752-			sponsorId = draft.sponsor;
753-			vehicles = draft.vehicles as Veh[];
754-			
755-			// Import team name if available
756-			if (draft.teamName) {
757-				teamName = draft.teamName;
758-			}
759-			
760-			// Import maxCans if available
761-			if (draft.maxCans) {
762-				maxCans = draft.maxCans;
763-			}
764-			
765-			// Import darkMode if available
766-			if (draft.darkMode !== undefined) {
767-				darkMode = draft.darkMode;
768-			}
769-			
770-			importString = '';
771-			showImportModal = false;
772-		} else {
773-			alert('Invalid draft string');
774-		}
775-	}
776-
777-	/* ---------- load from URL param (once) ---------- */
778-	if (typeof window !== 'undefined') {
779-		// First load settings from localStorage if available
780-		const savedDarkMode = localStorage.getItem('darkMode');
781-		if (savedDarkMode !== null) {
782-			darkMode = savedDarkMode === 'true';
783-		}
784-
785-		// Then check for URL params (these override localStorage)
786-		const url = new URL(window.location.href);
787-		const encoded = url.searchParams.get('draft');
788-		if (encoded) {
789-			const imported = decodeDraft(encoded);
790-			if (imported) {
791-				sponsorId = imported.sponsor;
792-				vehicles = imported.vehicles as Veh[];
793-				
794-				// Import team name if available
795-				if (imported.teamName) {
796-					teamName = imported.teamName;
797-				}
798-				
799-				// Import maxCans if available
800-				if (imported.maxCans) {
801-					maxCans = imported.maxCans;
802-				}
803-				
804-				// Import darkMode if available
805-				if (imported.darkMode !== undefined) {
806-					darkMode = imported.darkMode;
807-				}
808-			}
809-		}
810-	}
811-	
812-	/* ---------- setting changes effects ---------- */
813-	// When enableSponsorships is disabled, clear sponsor selection
814-	$: if (!enableSponsorships) {
815-		sponsorId = '';
816-	}
817-	
818-	// Remove any advanced vehicle types when includeAdvanced is disabled
819-	$: if (!includeAdvanced) {
820-		vehicles = vehicles.filter(v => {
821-			const vehicleType = vehicleTypes.find(vt => vt.id === v.type);
822-			return vehicleType && !vehicleType.advanced;
823-		});
824-	}
825-	
826-	// Remove any advanced weapons when includeAdvanced is disabled
827-	$: if (!includeAdvanced) {
828-		vehicles = vehicles.map(v => ({
829-			...v,
830-			weapons: v.weapons.filter(weaponInstanceId => {
831-				// Extract the base weapon ID from the instance ID (format: baseId_instanceHash)
832-				const baseWeaponId = weaponInstanceId.split('_')[0];
833-				const weapon = weapons.find(w => w.id === baseWeaponId);
834-				return weapon && !weapon.advanced;
835-			}),
836-			// Also clean up any facings for removed weapons
837-			weaponFacings: v.weaponFacings ? 
838-				Object.fromEntries(
839-					Object.entries(v.weaponFacings).filter(([weaponInstanceId]) => {
840-						const baseWeaponId = weaponInstanceId.split('_')[0];
841-						const weapon = weapons.find(w => w.id === baseWeaponId);
842-						return weapon && !weapon.advanced;
843-					})
844-				) : {}
845-		}));
846-	}
847-	
848-	// Remove any advanced upgrades when includeAdvanced is disabled
849-	$: if (!includeAdvanced) {
850-		vehicles = vehicles.map(v => ({
851-			...v,
852-			upgrades: v.upgrades.filter(upgradeId => {
853-				const upgrade = upgrades.find(u => u.id === upgradeId);
854-				return upgrade && !upgrade.advanced;
855-			})
856-		}));
857-	}
858-	
859-	// Remove perks when enableSponsorships is disabled
860-	$: if (!enableSponsorships) {
861-		vehicles = vehicles.map(v => ({
862-			...v,
863-			perks: []
864-		}));
865-	}
866-	
867-	// Save dark mode preference to localStorage when it changes
868-	$: if (typeof window !== 'undefined') {
869-		localStorage.setItem('darkMode', darkMode.toString());
870-		// Add dark mode classes to html element for global styling
871-		if (darkMode) {
872-			document.documentElement.classList.add('dark-mode');
873-			document.documentElement.classList.add('dark');
874-		} else {
875-			document.documentElement.classList.remove('dark-mode');
876-			document.documentElement.classList.remove('dark');
877-		}
878-	}
879-
880-	/* ---------- draft & validation ---------- */
881-	$: currentDraft = { 
882-		sponsor: sponsorId, 
883-		vehicles,
884-		teamName,
885-		maxCans,
886-		darkMode
887-	} satisfies Draft;
888-
889-	// Function to force validation to run immediately
890-	function forceValidation() {
891-		// Force reactivity by creating a new currentDraft object
892-		currentDraft = { ...currentDraft };
893-	}
894-
895-	// Function to handle vehicle type changes
896-	function handleVehicleTypeChange(vehicleId, newVehicleType) {
897-		// Find the vehicle in the validation reports for updating UI immediately
898-		const vehicleReport = validation.vehicleReports.find(r => r.vehicleId === vehicleId);
899-		if (vehicleReport) {
900-			// Find the new vehicle type
901-			const vehicleType = vehicleTypes.find(vt => vt.id === newVehicleType);
902-			if (vehicleType) {
903-				// Update the total cans immediately by recalculating
904-				const vehicle = vehicles.find(v => v.id === vehicleId);
905-				if (vehicle) {
906-					// Manually update the total cans
907-					const oldCost = vehicleReport.cans;
908-					const newCost = calculateVehicleCost(vehicle);
909-					validation.cans = validation.cans - oldCost + newCost;
910-
911-					// Update the vehicle report
912-					vehicleReport.cans = newCost;
913-				}
914-			}
915-		}
916-
917-		// Also trigger the full validation
918-		forceValidation();
919-	}
920-
921-	// Function to calculate vehicle cost for immediate updates
922-	function calculateVehicleCost(vehicle) {
923-		// Get the base cost from the vehicle type
924-		const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
925-		if (!vehicleType) return 0;
926-
927-		let totalCost = vehicleType.baseCost || 0;
928-
929-		// Add weapon costs
930-		for (const weaponInstanceId of vehicle.weapons) {
931-			const baseWeaponId = weaponInstanceId.split('_')[0];
932-			const weaponObj = weapons.find(w => w.id === baseWeaponId);
933-			if (weaponObj && weaponObj.cost) {
934-				totalCost += weaponObj.cost;
935-			}
936-		}
937-
938-		// Add upgrade costs
939-		for (const upgradeId of vehicle.upgrades) {
940-			const upgradeObj = upgrades.find(u => u.id === upgradeId);
941-			if (upgradeObj && upgradeObj.cost) {
942-				totalCost += upgradeObj.cost;
943-			}
944-		}
945-
946-		// Add perk costs
947-		for (const perkId of vehicle.perks) {
948-			const perkObj = perks.find(p => p.id === perkId);
949-			if (perkObj && perkObj.level) {
950-				totalCost += perkObj.level; // Perk cost is its level
951-			}
952-		}
953-
954-		return totalCost;
955-	}
956-	$: validateDraft(currentDraft).then((r) => {
957-		// Create a copy of the validation result
958-		const validationCopy = { ...r };
959-		
960-		// Replace the max cans error with custom max cans if it exists
961-		if (validationCopy.errors.length > 0) {
962-			validationCopy.errors = validationCopy.errors.map(err => {
963-				if (err.includes("cans limit") || err.includes("can limit")) {
964-					return `Team exceeds ${maxCans} cans limit`;
965-				}
966-				return err;
967-			});
968-		}
969-		
970-		// Check against custom max cans
971-		if (validationCopy.cans > maxCans && !validationCopy.errors.some(e => e.includes("cans limit"))) {
972-			validationCopy.errors.push(`Team exceeds ${maxCans} cans limit`);
973-		}
974-		
975-		validation = validationCopy;
976-	});
977-	$: totalCans = validation.cans;
978-	$: teamErrors = validation.errors;
979-
980-	/* ---------- filtered assets based on settings ---------- */
981-	// Trigger re-rendering when vehicles array changes its length
982-	$: vehicleCount = vehicles.length;
983-
984-	// Filter weapons based on includeAdvanced setting
985-	$: filteredWeapons = includeAdvanced 
986-		? weapons 
987-		: weapons.filter(w => !w.advanced);
988-	
989-	// Filter upgrades based on includeAdvanced setting
990-	$: filteredUpgrades = includeAdvanced 
991-		? upgrades 
992-		: upgrades.filter(u => !u.advanced);
993-	
994-	// Get available perks for the current sponsor
995-	$: currentSponsor = sponsors.find(s => s.id === sponsorId);
996-	$: availablePerks = enableSponsorships
997-		? perks.filter(p => currentSponsor?.perks.includes(p.id))
998-		: [];
999-
1000-	/* ---------- import box ---------- */
1001-	let importString = '';
1002-
1003-	// Remove all duplicate settings declarations
1004-	// let printStyle = localStorage.getItem('printStyle') || DEFAULT_SETTINGS.printStyle;
1005-	// let enableSponsorships = true;
1006-	// let includeAdvanced = true;
1007-	// let darkMode = false;
1008-
1009-	onMount(async () => {
1010-		// Only try to load settings if user is authenticated
1011-		if ($user) {
1012-			const { success, settings } = await getUserSettings();
1013-			if (success && settings) {
1014-				includeAdvanced = settings.includeAdvanced;
1015-				enableSponsorships = settings.enableSponsorships;
1016-				darkMode = settings.darkMode;
1017-				printStyle = settings.printStyle || 'classic';
1018-			}
1019-		} else {
1020-			// Use default settings when not authenticated
1021-			includeAdvanced = DEFAULT_SETTINGS.includeAdvanced;
1022-			enableSponsorships = DEFAULT_SETTINGS.enableSponsorships;
1023-			darkMode = DEFAULT_SETTINGS.darkMode;
1024-			printStyle = DEFAULT_SETTINGS.printStyle || 'classic';
1025-		}
1026-	});
1027-
1028-</script>
1029-
1030-<svelte:head>
1031-	<title>Gaslands Garage - Team Builder</title>
1032-	<script>
1033-		// Ensure modals have proper background in dark mode
1034-		document.addEventListener('DOMContentLoaded', function() {
1035-			function fixModalBackgrounds() {
1036-				const isDarkMode = document.documentElement.classList.contains('dark-mode') ||
1037-                                     document.documentElement.classList.contains('dark');
1038-				const modals = document.querySelectorAll('.bg-white.dark\\:bg-gray-800, .settings-modal-content');
1039-				modals.forEach(modal => {
1040-					if (isDarkMode) {
1041-						modal.style.backgroundColor = '#1f2937';
1042-					} else {
1043-						modal.style.backgroundColor = 'white';
1044-					}
1045-				});
1046-			}
1047-			
1048-			// Run immediately and when dark mode changes
1049-			fixModalBackgrounds();
1050-			
1051-			// Create a mutation observer to watch for dark mode class changes
1052-			const observer = new MutationObserver(mutations => {
1053-				mutations.forEach(mutation => {
1054-					if (mutation.attributeName === 'class') {
1055-						fixModalBackgrounds();
1056-					}
1057-				});
1058-			});
1059-			
1060-			// Start observing
1061-			observer.observe(document.documentElement, { attributes: true });
1062-		});
1063-	</script>
1064-</svelte:head>
1065-
1066-<!-- Menu removed - now in layout.svelte -->
1067-
1068-<style>
1069-/* Menu styles removed - now in layout.svelte */
1070-
1071-.no-card-padding {
1072-	padding: 0 !important;
1073-}
1074-
1075-/* Tooltip styles */
1076-.tooltip {
1077-	position: relative;
1078-	display: inline-block;
1079-	cursor: help;
1080-	border-bottom: 1px dotted #666;
1081-}
1082-
1083-.tooltip:hover::after {
1084-	content: attr(title);
1085-	position: absolute;
1086-	bottom: 125%;
1087-	left: 50%;
1088-	transform: translateX(-50%);
1089-	background-color: rgba(0, 0, 0, 0.8);
1090-	color: white;
1091-	padding: 6px 10px;
1092-	border-radius: 4px;
1093-	font-size: 0.8rem;
1094-	white-space: nowrap;
1095-	z-index: 50;
1096-	text-align: center;
1097-	pointer-events: none;
1098-	min-width: 200px;
1099-	max-width: 300px;
1100-	white-space: normal;
1101-}
1102-
1103-.tooltip:hover::before {
1104-	content: "";
1105-	position: absolute;
1106-	bottom: 100%;
1107-	left: 50%;
1108-	transform: translateX(-50%);
1109-	border-width: 5px;
1110-	border-style: solid;
1111-	border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
1112-	z-index: 50;
1113-	pointer-events: none;
1114-}
1115-
1116-/* Vehicle type icon styles */
1117-.vehicle-type-icon {
1118-  width: 20px;
1119-  height: 20px;
1120-  background-size: contain;
1121-  background-repeat: no-repeat;
1122-  background-position: center;
1123-  display: inline-block;
1124-}
1125-
1126-.vehicle-type-car { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M5 13a2 2 0 0 1-2-2c0-1.1.9-2 2-2c1.1 0 2 .9 2 2c0 1.1-.9 2-2 2zm14 0a2 2 0 0 1-2-2c0-1.1.9-2 2-2c1.1 0 2 .9 2 2c0 1.1-.9 2-2 2zM19 11h-1l-1.71-7.67A2.5 2.5 0 0 0 13.92 1H10.08C8.77 1 7.66 1.94 7.29 3.33L5.6 11H5c-1.66 0-3 1.34-3 3v3h1.5v-1.5h17V17H22v-3c0-1.66-1.34-3-3-3zm-7-7.5h2.62l1.5 7.5H12V3.5zM8.38 3.5H11v7.5H6.9l1.48-7.5z'/%3E%3C/svg%3E"); }
1127-
1128-.vehicle-type-buggy { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z'/%3E%3C/svg%3E"); }
1129-
1130-.vehicle-type-performance_car { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M16 6l3 4h2c1.11 0 2 .89 2 2v3h-2c0 1.66-1.34 3-3 3s-3-1.34-3-3H9c0 1.66-1.34 3-3 3s-3-1.34-3-3H1v-3c0-1.11.89-2 2-2l3-4h10m-5.5 1.5H9V10H7.25V7.5H6v6h1.25V11.5H9v2.5h1.5v-6m7 0h-3v6H16v-2h1c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1m0 3H16v-1.5h1.5V10.5M6 13.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5m12 0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z'/%3E%3C/svg%3E"); }
1131-
1132-.vehicle-type-pickup { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M6 5H4v16c0 1.1.9 2 2 2h10v-2H6V5zm16 2h-8l-2-2H8v14h14V7zm-3 8H9v-2h10v2z'/%3E%3C/svg%3E"); }
1133-
1134-.vehicle-type-van { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18 4v7h-6V4h6m1-2h-8c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-10 9H5c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-5c0-.55-.45-1-1-1zM9 17H5v-3h4v3zm8-4v2h2v2h-5v-4h3z'/%3E%3C/svg%3E"); }
1135-
1136-.vehicle-type-monster_truck { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19 10c-1.1 0-2 .9-2 2h-1V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-4c0-1.1-.9-2-2-2h-3zm-9 7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7-6h3.5c.28 0 .5.22.5.5V13h-4v-2zm-5 0v2h-4V9.48c1.68.5 2.8 1.94 2.95 3.52H15zm3 6c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z'/%3E%3C/svg%3E"); }
1137-
1138-.vehicle-type-heavy_truck { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5-9l1.96 2.5H17V9.5h2.5zM6 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM20 8l-3-4H3c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h1c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1h-3z'/%3E%3C/svg%3E"); }
1139-
1140-.vehicle-type-bus { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z'/%3E%3C/svg%3E"); }
1141-
1142-.vehicle-type-war_rig { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z'/%3E%3C/svg%3E"); }
1143-
1144-.vehicle-type-tank { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z'/%3E%3C/svg%3E"); }
1145-
1146-/* Weight class indicators */
1147-.weight-class-indicator {
1148-  font-weight: bold;
1149-  padding: 2px 5px;
1150-  border-radius: 4px;
1151-  font-size: 0.9em;
1152-  text-align: center;
1153-  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
1154-}
1155-
1156-.weight-1 {
1157-  background-color: #a7f3d0;
1158-  color: #065f46;
1159-}
1160-
1161-.weight-2 {
1162-  background-color: #fde68a;
1163-  color: #92400e;
1164-}
1165-
1166-.weight-3 {
1167-  background-color: #fca5a5;
1168-  color: #991b1b;
1169-}
1170-
1171-.weight-4 {
1172-  background-color: #c7d2fe;
1173-  color: #312e81;
1174-}
1175-
1176-/* Interactive dashboard styles */
1177-.hull-checkbox, .crew-checkbox {
1178-  display: inline-block;
1179-  position: relative;
1180-  margin: 2px;
1181-}
1182-
1183-.hull-checkbox-input, .crew-checkbox-input {
1184-  position: absolute;
1185-  opacity: 0;
1186-  cursor: pointer;
1187-  height: 0;
1188-  width: 0;
1189-}
1190-
1191-.hull-checkbox-label {
1192-  display: block;
1193-  width: 20px;
1194-  height: 20px;
1195-  background-color: #fff;
1196-  border: 2px solid #333;
1197-  border-radius: 4px;
1198-  cursor: pointer;
1199-}
1200-
1201-.crew-checkbox-label {
1202-  display: block;
1203-  width: 20px;
1204-  height: 20px;
1205-  background-color: #fff;
1206-  border: 2px solid #333;
1207-  border-radius: 50%;
1208-  cursor: pointer;
1209-}
1210-
1211-.hull-checkbox-input:checked + .hull-checkbox-label {
1212-  background-color: #ef4444;
1213-  border-color: #991b1b;
1214-}
1215-
1216-.crew-checkbox-input:checked + .crew-checkbox-label {
1217-  background-color: #f59e0b;
1218-  border-color: #b45309;
1219-}
1220-
1221-.gear-range {
1222-  -webkit-appearance: none;
1223-  appearance: none;
1224-  height: 10px;
1225-  border-radius: 5px;
1226-  outline: none;
1227-}
1228-
1229-.gear-range::-webkit-slider-thumb {
1230-  -webkit-appearance: none;
1231-  appearance: none;
1232-  width: 24px;
1233-  height: 24px;
1234-  border-radius: 50%;
1235-  background: #f59e0b;
1236-  border: 2px solid #b45309;
1237-  cursor: pointer;
1238-  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
1239-}
1240-
1241-.gear-range::-moz-range-thumb {
1242-  width: 24px;
1243-  height: 24px;
1244-  border-radius: 50%;
1245-  background: #f59e0b;
1246-  border: 2px solid #b45309;
1247-  cursor: pointer;
1248-  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
1249-}
1250-
1251-/* Hide print view by default */
1252-#gaslands-print-view {
1253-  display: none;
1254-}
1255-
1256-/* Print styles */
1257-@media print {
1258-  /* Hide elements that shouldn't be printed */
1259-  .menu-bar,
1260-  button[aria-label="Remove vehicle"],
1261-  button[aria-label="Remove weapon"],
1262-  button[aria-label="Remove upgrade"],
1263-  button[aria-label="Remove perk"],
1264-  .relative select,
1265-  #import-draft,
1266-  .bg-red-50,
1267-  .bg-green-50,
1268-  .print-hide {
1269-    display: none !important;
1270-  }
1271-  
1272-  /* Page formatting */
1273-  @page { 
1274-    size: 8.5in 11in portrait; 
1275-    margin: 0.5cm;
1276-  }
1277-  
1278-  section {
1279-    background-color: white !important;
1280-    padding: 0 !important;
1281-    margin: 0 !important;
1282-  }
1283-  
1284-  /* Reset padding from header for print */
1285-  #builder-ui {
1286-    padding-top: 0 !important;
1287-  }
1288-  
1289-  /* Hide non-print components */
1290-  .bg-white, .bg-stone-100, #builder-ui, .p-4, .p-5, .p-6 {
1291-    display: none !important;
1292-  }
1293-  
1294-  /* General text formatting applied to print view container */
1295-  #gaslands-print-view { 
1296-    color: #000; 
1297-    font-family: Arial, sans-serif; 
1298-    display: block !important;
1299-  }
1300-  
1301-  /* Force background printing */
1302-  * { 
1303-    -webkit-print-color-adjust: exact !important; 
1304-    color-adjust: exact !important; 
1305-  }
1306-  
1307-  /* Print-specific styles */
1308-  @media print {
1309-    /* Print styles already covered in parent media query */
1310-  }
1311-  
1312-  /* Vehicle card styling */
1313-  .vehicle-card-print {
1314-    width: 320px;
1315-    height: 340px;
1316-    vertical-align: top;
1317-    padding: 16px;
1318-    border: 3px solid #000;
1319-    page-break-inside: avoid;
1320-    margin-bottom: 20px;
1321-    display: inline-block;
1322-    position: relative;
1323-    box-sizing: border-box;
1324-    background-color: #f8f8f8;
1325-    border-radius: 8px;
1326-    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
1327-  }
1328-  
1329-  /* Text styling */
1330-  .uppercase { text-transform: uppercase; }
1331-  .bold { font-weight: bold; }
1332-  
1333-  /* Hull boxes */
1334-  .hull-box {
1335-    width: 14px;
1336-    height: 14px;
1337-    background-color: #fff;
1338-    border: 2px solid #000;
1339-    display: inline-block;
1340-    margin: 2px;
1341-    border-radius: 2px;
1342-  }
1343-  
1344-  /* Vehicle card sections */
1345-  .card-header {
1346-    display: flex;
1347-    justify-content: space-between;
1348-    margin-bottom: 16px;
1349-    border-bottom: 2px solid #222;
1350-    padding-bottom: 8px;
1351-  }
1352-  
1353-  .card-title {
1354-    display: flex;
1355-    flex-direction: column;
1356-    gap: 4px;
1357-  }
1358-  
1359-  .card-name {
1360-    font-size: 1.3em;
1361-    font-weight: bold;
1362-    text-transform: uppercase;
1363-  }
1364-  
1365-  .vehicle-type-badge {
1366-    display: inline-block;
1367-    padding: 3px 8px;
1368-    border-radius: 4px;
1369-    color: white;
1370-    font-size: 0.8em;
1371-    font-weight: bold;
1372-    text-shadow: 0 1px 1px rgba(0,0,0,0.5);
1373-    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
1374-  }
1375-  
1376-  .card-cost {
1377-    display: flex;
1378-    flex-direction: column;
1379-    align-items: center;
1380-    justify-content: center;
1381-    border: 2px solid #000;
1382-    padding: 2px 12px;
1383-    border-radius: 6px;
1384-    background-color: #fff;
1385-    font-size: 0.8em;
1386-    font-weight: bold;
1387-  }
1388-  
1389-  .cost-value {
1390-    font-size: 2em;
1391-    font-weight: bold;
1392-    line-height: 1;
1393-  }
1394-  
1395-  /* Stats section */
1396-  .stats-grid {
1397-    margin-bottom: 16px;
1398-  }
1399-  
1400-  .stat-block {
1401-    margin-bottom: 8px;
1402-  }
1403-  
1404-  .stats-row {
1405-    display: flex;
1406-    justify-content: space-between;
1407-    flex-wrap: wrap;
1408-    margin-top: 8px;
1409-    padding-top: 8px;
1410-    border-top: 1px solid #ddd;
1411-  }
1412-  
1413-  .stat-label {
1414-    font-weight: bold;
1415-    font-size: 0.9em;
1416-    text-transform: uppercase;
1417-    margin-bottom: 2px;
1418-    color: #444;
1419-  }
1420-  
1421-  .stat-value {
1422-    font-size: 1.1em;
1423-    font-weight: bold;
1424-    text-align: center;
1425-    padding: 3px 8px;
1426-    background-color: #fff;
1427-    border: 1px solid #ccc;
1428-    border-radius: 3px;
1429-  }
1430-  
1431-  .hull-tracker {
1432-    display: flex;
1433-    flex-wrap: wrap;
1434-    max-width: 100%;
1435-    padding: 3px;
1436-    background-color: #fff;
1437-    border: 1px solid #ccc;
1438-    border-radius: 3px;
1439-  }
1440-  
1441-  /* Loadout sections */
1442-  .loadout {
1443-    font-size: 0.85em;
1444-  }
1445-  
1446-  .loadout-section {
1447-    margin-bottom: 10px;
1448-  }
1449-  
1450-  .section-header {
1451-    font-weight: bold;
1452-    text-transform: uppercase;
1453-    margin-bottom: 4px;
1454-    font-size: 0.9em;
1455-    padding: 2px 0;
1456-    border-bottom: 1px solid #aaa;
1457-  }
1458-  
1459-  .loadout-table {
1460-    width: 100%;
1461-    border-collapse: collapse;
1462-  }
1463-  
1464-  .loadout-table tr:nth-child(odd) {
1465-    background-color: rgba(0,0,0,0.05);
1466-  }
1467-  
1468-  .item-name {
1469-    font-weight: bold;
1470-    padding: 2px 4px;
1471-  }
1472-  
1473-  .item-facing {
1474-    text-align: center;
1475-    font-style: italic;
1476-    padding: 2px 4px;
1477-    width: 60px;
1478-  }
1479-  
1480-  .item-attack {
1481-    text-align: right;
1482-    font-weight: bold;
1483-    padding: 2px 4px;
1484-    width: 40px;
1485-  }
1486-  
1487-  .upgrade-list {
1488-    list-style-type: none;
1489-    padding: 0;
1490-    margin: 0;
1491-  }
1492-  
1493-  .upgrade-list li {
1494-    padding: 3px 4px;
1495-  }
1496-  
1497-  .upgrade-list li:nth-child(odd) {
1498-    background-color: rgba(0,0,0,0.05);
1499-  }
1500-  
1501-  .card-footer {
1502-    position: absolute;
1503-    bottom: 16px;
1504-    left: 16px;
1505-    right: 16px;
1506-    font-weight: bold;
1507-    border-top: 1px solid #aaa;
1508-    padding-top: 8px;
1509-    font-size: 0.9em;
1510-  }
1511-  
1512-  .perk-label {
1513-    text-transform: uppercase;
1514-    font-weight: bold;
1515-  }
1516-  
1517-  /* Team summary styling */
1518-  .sponsor-print-header {
1519-    text-align: center;
1520-    margin-bottom: 20px;
1521-    border-bottom: 2px solid black;
1522-    padding-bottom: 10px;
1523-  }
1524-  
1525-  .sponsor-print-header h1 {
1526-    font-size: 24pt;
1527-    margin-bottom: 5px;
1528-  }
1529-  
1530-  .print-card-grid {
1531-    display: grid;
1532-    grid-template-columns: 1fr 1fr;
1533-    gap: 25px;
1534-    page-break-inside: auto;
1535-  }
1536-  
1537-  .print-section {
1538-    page-break-inside: avoid;
1539-    margin-bottom: 20px;
1540-  }
1541-  
1542-  
1543-  .rotate90 {
1544-    display: inline-block;
1545-    transform: rotate(-90deg);
1546-    margin-right: 10px;
1547-    font-weight: bold;
1548-  }
1549-  
1550-  .vehicle-type {
1551-    font-size: 0.9em;
1552-    font-weight: bold;
1553-  }
1554-  
1555-  /* Perk details section below cards */
1556-  #perk-details-print {
1557-    margin-top: 30px;
1558-    border-top: 2px solid #999;
1559-    padding-top: 15px;
1560-  }
1561-  
1562-  #perk-details-print h2 {
1563-    font-size: 14pt;
1564-    margin-bottom: 10px;
1565-  }
1566-  
1567-  .perk-list {
1568-    column-count: 2;
1569-    column-gap: 30px;
1570-  }
1571-  
1572-  .perk-item {
1573-    margin-bottom: 10px;
1574-    break-inside: avoid;
1575-  }
1576-  
1577-  /* QR Code and footer styling */
1578-  .print-footer {
1579-    width: 100%;
1580-    margin-top: 30px;
1581-    border-top: 1px solid #ddd;
1582-    padding-top: 10px;
1583-    page-break-inside: avoid;
1584-    display: flex;
1585-    align-items: flex-end;
1586-  }
1587-  
1588-  .qr-code-container {
1589-    width: 120px;
1590-    text-align: center;
1591-  }
1592-  
1593-  .qr-code-image {
1594-    width: 100px;
1595-    height: 100px;
1596-    border: 1px solid black;
1597-    background-color: white;
1598-    margin: 0 auto 5px auto;
1599-  }
1600-  
1601-  .qr-code-placeholder {
1602-    width: 100px;
1603-    height: 100px;
1604-    border: 1px solid black;
1605-    background-color: white;
1606-    margin: 0 auto 5px auto;
1607-    text-align: center;
1608-    line-height: 100px;
1609-  }
1610-  
1611-  .qr-code-caption {
1612-    font-size: 8pt;
1613-  }
1614-  
1615-  .print-footer-text {
1616-    flex: 1;
1617-    font-size: 10pt;
1618-    color: #666;
1619-    text-align: center;
1620-  }
1621-}
1622-</style>
1623-
1624-<section id="builder-ui" class="p-4 md:p-6 bg-stone-100 min-h-screen w-full {darkMode ? 'dark' : ''}">
1625-	<header class="mb-6 md:mb-8">
1626-		<div class="text-3xl md:text-4xl font-extrabold text-stone-800 dark:text-gray-100 tracking-tight flex flex-wrap justify-between items-center">
1627-			<div class="flex flex-col gap-4 w-full">
1628-				<div class="flex items-center justify-between w-full gap-4">
1629-					<div class="flex items-center gap-4">
1630-						<b class="text-lg font-bold whitespace-nowrap">Team Name:</b>
1631-						<input
1632-							type="text"
1633-							bind:value={teamName}
1634-							class="bg-transparent border-2 border-amber-500 rounded-lg px-3 py-0.25 font-bold text-amber-700 dark:text-white focus:outline-none focus:border-amber-600 min-w-[200px] w-auto text-base dark-text-input"
1635-							style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
1636-							aria-label="Team Name"
1637-						/>
1638-					</div>
1639-					<!-- Edit/Play Mode Toggle Button -->
1640-					<button
1641-						class="form-button flex items-center gap-2 h-8"
1642-						on:click={() => playMode = !playMode}
1643-					>
1644-						<span class="w-3 h-3 rounded-full {playMode ? 'bg-green-500' : 'bg-amber-500'} transition-colors"></span>
1645-						<span class="text-sm font-medium">{playMode ? 'Edit Team' : 'Play Mode'}</span>
1646-					</button>
1647-				</div>
1648-				<div class="flex items-center justify-between w-full gap-4">
1649-					<div class="flex items-center gap-4">
1650-						<b class="text-lg font-bold whitespace-nowrap">Cans: </b>
1651-						<span class="font-extrabold text-amber-700 dark:text-amber-300 text-2xl md:text-3xl">{totalCans || 0}</span>
1652-						<span class="text-lg font-bold text-amber-700 dark:text-amber-300">/</span>
1653-						<input
1654-							type="number"
1655-							bind:value={maxCans}
1656-							min="1"
1657-							max="1000"
1658-							class="bg-transparent border-2 border-amber-500 rounded-lg px-3 py-0.25 font-bold text-amber-700 dark:text-white focus:outline-none focus:border-amber-600 min-w-[100px] w-auto text-base dark-text-input"
1659-							style="height: 32px !important; min-height: 32px !important; max-height: 32px !important;"
1660-							aria-label="Maximum Cans"
1661-						/>
1662-					</div>
1663-					<!-- Quick Save Button -->
1664-					<button
1665-						class="form-button flex items-center h-8"
1666-						on:click={quickSaveTeam}
1667-						disabled={quickSaving}
1668-					>
1669-						{#if quickSaving}
1670-							<div class="animate-spin mr-2 h-3 w-3 border-b-2 border-white rounded-full"></div>
1671-							Saving...
1672-						{:else}
1673-							Quick Save
1674-						{/if}
1675-					</button>
1676-				</div>
1677-			</div>
1678-		</div>
1679-	</header>
1680-
1681-	<!-- Sponsor selector (only shown if enableSponsorships is true) -->
1682-	{#if enableSponsorships}
1683-		<div class="bg-white p-5 rounded-lg shadow-md mb-6">
1684-			<div class="flex flex-wrap md:flex-nowrap items-start gap-4">
1685-				<div class="w-full md:w-1/3">
1686-					<div class="flex items-center gap-4">
1687-						<b class="text-lg font-bold whitespace-nowrap">
1688-							Choose Your Sponsor: &nbsp;&nbsp;
1689-						</b>
1690-						<div class="relative flex-grow">
1691-							<select
1692-								id="sponsor-select"
1693-								bind:value={sponsorId}
1694-								class="form-select"
1695-							>
1696-								{#each [...sponsors].sort((a, b) => a.name.localeCompare(b.name)) as s}
1697-    <option value={s.id}>{s.name}</option>
1698-  {/each}
1699-							</select>
1700-						</div>
1701-
1702-					</div>
1703-				</div>
1704-				<div class="w-full md:w-2/3 md:pt-8">
1705-					{#if currentSponsor?.perks?.length}
1706-						<div class="mt-2 text-sm text-stone-700 dark:text-gray-300">
1707-							<span class="font-medium">Available Perks:</span> 
1708-							<span class="inline ml-2">
1709-								{#each perks.filter(p => currentSponsor?.perks.includes(p.id)) as perk, i}
1710-								&nbsp;<span 
1711-										class="tooltip inline mr-1"
1712-										title="{perk.name} (Level {perk.level}): {perk.text}"
1713-									>
1714-										{perk.name}{i < perks.filter(p => currentSponsor?.perks.includes(p.id)).length - 1 ? ', ' : ''}
1715-									</span>
1716-								{/each}
1717-							</span>
1718-						</div>
1719-					{/if}
1720-				</div>
1721-			</div>
1722-		</div>
1723-	{:else}
1724-		<!-- Show info message when sponsorships are disabled -->
1725-		<div class="bg-blue-50 p-5 rounded-lg shadow-md mb-6">
1726-			<div class="flex items-start">
1727-				<div class="flex-shrink-0">
1728-					<svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
1729-						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
1730-					</svg>
1731-				</div>
1732-				<div class="ml-3">
1733-					<h3 class="text-lg font-medium text-blue-800">Sponsorships Disabled</h3>
1734-					<div class="mt-2 text-sm text-blue-700">
1735-						<p>You are building a team without a sponsor. Sponsorship perks are unavailable.
1736-						Enable sponsorships in Settings to access sponsor-specific perks and abilities.</p>
1737-					</div>
1738-					<div class="mt-3">
1739-						<button 
1740-							type="button" 
1741-							class="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
1742-							on:click={openSettings}
1743-						>
1744-							Open Settings
1745-						</button>
1746-					</div>
1747-				</div>
1748-			</div>
1749-		</div>
1750-	{/if}
1751-<hr>
1752-	<!-- Vehicle list - Current count: {vehicles.length} -->
1753-	<div class="mb-8">
1754-		<div class="flex items-center justify-between mb-4">
1755-			<div class="flex items-center gap-4">
1756-				<h2 class="text-2xl font-bold text-stone-800 dark:text-gray-100">Vehicles</h2>
1757-			</div>
1758-			<button
1759-				class="py-2 px-4 flex items-center justify-center rounded-md transition-colors amber-button"
1760-				on:click={() => addVehicle()}
1761-				disabled={playMode}
1762-				class:opacity-50={playMode}
1763-				class:cursor-not-allowed={playMode}
1764-			>
1765-				<span>+ Add Vehicle</span>
1766-			</button>
1767-		</div>
1768-
1769-		{#if vehicles.length === 0}
1770-			<div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
1771-				<p class="text-stone-600 dark:text-gray-300 text-lg font-bold mb-4">Your team has no vehicles yet. Get started by adding a vehicle to your team.</p>
1772-
1773-
1774-			</div>
1775-
1776-			<!-- About Gaslands Content when no vehicles -->
1777-			<div class="mt-10 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
1778-				<div class="flex justify-between items-center mb-6">
1779-					<h3 class="text-xl font-bold text-stone-800 dark:text-white">About Gaslands</h3>
1780-				</div>
1781-
1782-				<div class="space-y-6 text-stone-700 dark:text-gray-200">
1783-					<p>
1784-						Gaslands is a tabletop game of post-apocalyptic vehicular combat. Using converted Hot Wheels or Matchbox cars, it simulates a televised bloodsport where drivers compete in a variety of deadly scenarios. Gaslands puts players in control of custom battle cars, buggies, trucks, and other vehicles armed with machine guns, rockets, flamethrowers and more.
1785-					</p>
1786-
1787-					<h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">What You Need to Start Playing:</h4>
1788-					<ul class="list-disc pl-5 space-y-2">
1789-						<li><a href="https://amzn.to/4m7OQYa" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Rulebook</a> - The Gaslands Refuelled rulebook contains all the rules and scenarios</li>
1790-						<li><a href="https://creatoriq.cc/434pUIp" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Dice</a> - Special dice designed for the game</li>
1791-						<li><a href="https://amzn.to/4kaUcA2" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Regular 6-Sided Dice</a> - For resolving various game mechanics</li>
1792-						<li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Gaslands Templates</a> - Movement templates for driving your vehicles</li>
1793-						<li><a href="https://creatoriq.cc/3GR0qqD" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:underline">Vehicles</a> - Hotwheels or Matchbox cars that you can modify</li>
1794-					</ul>
1795-
1796-					<h4 class="font-bold text-stone-800 dark:text-white text-lg mb-3">Recommended Resources:</h4>
1797-					<div class="bg-stone-100 dark:bg-gray-700 p-4 rounded-lg">
1798-						<div class="flex items-center gap-3 mb-2">
1799-							<div class="w-full">
1800-								<div class="flex justify-center">
1801-									<iframe width="560" height="315" src="https://www.youtube.com/embed/CL66NMhWwHo?si=KltcYCh9RbCqU2HQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
1802-								</div>
1803-							</div>
1804-						</div>
1805-					</div>
1806-				</div>
1807-			</div>
1808-		{:else}
1809-			<div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
1810-				{#each vehicles as vehicle (vehicle.id)}
1811-					<VehicleCard
1812-						{vehicle}
1813-						{vehicleTypes}
1814-						{weapons}
1815-						{upgrades}
1816-						{perks}
1817-						{currentSponsor}
1818-						collapsed={collapsedVehicles.has(vehicle.id)}
1819-						{playMode}
1820-						{validation}
1821-						{showTeamSummary}
1822-						{showGaslandsMath}
1823-						{totalCans}
1824-						{maxCans}
1825-						{filteredWeapons}
1826-						{filteredUpgrades}
1827-						filteredPerks={perks.filter(p => currentSponsor?.perks.includes(p.id))}
1828-						on:remove={e => removeVehicle(e.detail.id)}
1829-						on:clone={e => cloneVehicle(e.detail.id)}
1830-						on:toggleCollapse={e => toggleVehicleCollapse(e.detail.id)}
1831-						on:addWeapon={e => addWeapon(e.detail.vehicleId, e.detail.weaponId, e.detail.facing)}
1832-						on:removeWeapon={e => removeWeapon(e.detail.vehicleId, e.detail.weaponIndex)}
1833-						on:addUpgrade={e => addUpgrade(e.detail.vehicleId, e.detail.upgradeId)}
1834-						on:removeUpgrade={e => removeUpgrade(e.detail.vehicleId, e.detail.upgradeIndex)}
1835-						on:addPerk={e => addPerk(e.detail.vehicleId, e.detail.perkId)}
1836-						on:removePerk={e => removePerk(e.detail.vehicleId, e.detail.perkIndex)}
1837-						on:incrementHazard={e => incrementHazard(e.detail.vehicleId)}
1838-						on:decrementHazard={e => decrementHazard(e.detail.vehicleId)}
1839-						on:vehicleTypeChanged={e => handleVehicleTypeChange(e.detail.id, e.detail.vehicleType)}
1840-					/>
1841-				{/each}
1842-			</div>
1843-		{/if}
1844-	</div>
1845-
1846-	<hr>
1847-
1848-<!-- Totals / legality -->
1849-{#if showTeamSummary && vehicles.length > 0}
1850-<div class="bg-white p-5 rounded-lg shadow-md mb-6">
1851-	<div class="flex items-center justify-between mb-4">
1852-		<div>
1853-			<h2 class="text-xl font-bold text-stone-800">{teamName}</h2>
1854-			<p class="text-sm text-stone-600">Team Summary</p>
1855-		</div>
1856-		<div class="text-lg font-bold">
1857-			<span class="text-stone-600">Total:</span>
1858-			<span class="text-amber-600 ml-1">{totalCans}/{maxCans} cans</span>
1859-		</div>
1860-	</div>
1861-
1862-	<!-- Sponsor info (when enabled) -->
1863-	{#if enableSponsorships && sponsorId}
1864-		<div class="mb-4 bg-stone-100 p-3 rounded">
1865-			<div class="flex flex-wrap items-center gap-2">
1866-				<span class="font-medium text-stone-800">Sponsor:</span>
1867-				<span class="font-bold text-amber-700">{currentSponsor?.name || 'None'}</span>
1868-				
1869-				{#if currentSponsor?.perks?.length}
1870-					<span class="mx-2 text-stone-400">|</span>
1871-					<span class="font-medium text-stone-800">Perks:</span>
1872-					<span class="text-stone-700 inline ml-2">
1873-						{#each perks.filter(p => currentSponsor?.perks.includes(p.id)) as perk, i}
1874-							<span class="tooltip inline" title="{perk.name} (Level {perk.level}): {perk.text}">
1875-								{perk.name}{i < perks.filter(p => currentSponsor?.perks.includes(p.id)).length - 1 ? ', ' : ''}
1876-							</span>
1877-						{/each}
1878-					</span>
1879-				{/if}
1880-			</div>
1881-		</div>
1882-	{/if}
1883-
1884-	{#if teamErrors.length === 0}
1885-		<div class="flex items-center bg-green-50 text-green-800 p-4 rounded-lg">
1886-			<span class="mr-2 text-green-500">✓</span>
1887-			<span class="font-medium">Your team is legal and ready to race!</span>
1888-		</div>
1889-	{:else}
1890-		<div class="bg-red-50 text-red-800 p-4 rounded-lg">
1891-			<div class="flex items-center mb-2">
1892-				<span class="mr-2 text-red-500">!</span>
1893-				<span class="font-medium">Your team has issues that need fixing:</span>
1894-			</div>
1895-			<ul class="list-disc ml-12 space-y-1">
1896-				{#each teamErrors as err}
1897-					<li>{err}</li>
1898-				{/each}
1899-			</ul>
1900-		</div>
1901-	{/if}
1902-</div>
1903-{/if}
1904-<!-- Gaslands Math -->
1905-{#if showGaslandsMath && vehicles.length > 0}
1906-<div class="mt-6 bg-stone-100 dark:bg-gray-700 p-4 rounded-lg">
1907-	<h3 class="text-lg font-bold text-stone-800 dark:text-white mb-3">Gaslands Math:</h3>
1908-	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
1909-		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
1910-			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Hull (Min/Avg/Max/Total)</div>
1911-			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
1912-				{#if vehicles.length > 0}
1913-					{Math.min(...vehicles.map(v => calculateMaxHull(v)))} /
1914-					{Math.round(vehicles.reduce((sum, v) => sum + calculateMaxHull(v), 0) / vehicles.length)} /
1915-					{Math.max(...vehicles.map(v => calculateMaxHull(v)))} /
1916-					{vehicles.reduce((total, v) => total + calculateMaxHull(v), 0)}
1917-				{:else}
1918-					0 / 0 / 0 / 0
1919-				{/if}
1920-			</div>
1921-		</div>
1922-
1923-		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
1924-			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Vehicle Attack Dice Per Turn (Min/Avg/Max/Total)</div>
1925-			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
1926-				{#if vehicles.length > 0}
1927-					{Math.min(...vehicles.map(v => calculateTotalAttackDice(v)))} /
1928-					{Math.round(vehicles.reduce((sum, v) => sum + calculateTotalAttackDice(v), 0) / vehicles.length)} /
1929-					{Math.max(...vehicles.map(v => calculateTotalAttackDice(v)))} /
1930-					{vehicles.reduce((total, v) => total + calculateTotalAttackDice(v), 0)}
1931-				{:else}
1932-					0 / 0 / 0 / 0
1933-				{/if}
1934-			</div>
1935-		</div>
1936-
1937-		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
1938-			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Gear (Min/Avg/Max)</div>
1939-			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
1940-				{#if vehicles.length > 0}
1941-					{Math.min(...vehicles.map(v => vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0))} /
1942-					{Math.round(vehicles.reduce((sum, v) => sum + (vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0), 0) / vehicles.length)} /
1943-					{Math.max(...vehicles.map(v => vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0))}
1944-				{:else}
1945-					0 / 0 / 0
1946-				{/if}
1947-			</div>
1948-		</div>
1949-		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
1950-			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Weapons (Min/Avg/Max/Total)</div>
1951-			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
1952-				{#if vehicles.length > 0}
1953-					{Math.min(...vehicles.map(v => v.weapons.length))} /
1954-					{Math.round(vehicles.reduce((sum, v) => sum + v.weapons.length, 0) / vehicles.length)} /
1955-					{Math.max(...vehicles.map(v => v.weapons.length))} /
1956-					{vehicles.reduce((total, v) => total + v.weapons.length, 0)}
1957-				{:else}
1958-					0 / 0 / 0 / 0
1959-				{/if}
1960-			</div>
1961-		</div>
1962-		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
1963-			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Total Vehicles</div>
1964-			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
1965-				{vehicles.length}
1966-			</div>
1967-		</div>
1968-	</div>
1969-</div>
1970-{/if}
1971-
1972-<!-- QR Modal -->
1973-    {#if qrDataUrl}
1974-      <div
1975-        class="fixed inset-0 bg-black/90 z-50"
1976-        role="dialog"
1977-        aria-modal="true"
1978-        aria-label="QR Code"
1979-        tabindex="-1"
1980-      >
1981-        <!-- Adding a button to make the whole backdrop clickable/accessible -->
1982-        <button
1983-          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
1984-          on:click={() => (qrDataUrl = null)}
1985-          on:keydown={e => e.key === 'Escape' && (qrDataUrl = null)}
1986-          aria-label="Close modal background"
1987-        ></button>
1988-        <div
1989-          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-10 border-2 border-amber-500 z-10 fixed left-1/2 top-1/2 w-auto max-w-md overflow-y-auto transform -translate-x-1/2 -translate-y-1/2 max-h-[90vh]"
1990-          role="document"
1991-          style="box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: white;"
1992-          data-modal-content
1993-        >
1994-          <div class="flex justify-between items-center mb-6">
1995-            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Team QR Code</h3>
1996-            <button
1997-              class="py-0.25 px-2 h-[32px] flex items-center justify-center rounded transition-colors text-sm amber-button"
1998-              on:click={() => (qrDataUrl = null)}
1999-              aria-label="Close QR code modal"
2000-              style="height: 32px !important; min-height: 32px !important;"
2001-            >
2002-              <span>Close</span>
2003-            </button>
2004-          </div>
2005-          <div class="bg-white dark:bg-gray-700 p-6 rounded-lg border-2 border-stone-200 dark:border-gray-600">
2006-            <img src={qrDataUrl} alt="team QR code" class="mx-auto w-64 h-64" />
2007-          </div>
2008-          <p class="mt-6 text-center text-stone-600 dark:text-amber-300 text-sm font-medium">
2009-            Scan this QR code to share your team build
2010-          </p>
2011-          <div class="flex justify-end gap-4 mt-8 pt-4 border-t border-stone-200 dark:border-amber-900">
2012-            <button
2013-              class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm amber-button shadow-md"
2014-              style="height: 32px !important; min-height: 32px !important;"
2015-              on:click={() => (qrDataUrl = null)}
2016-            >
2017-              Close
2018-            </button>
2019-            <button
2020-              class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm shadow-md"
2021-              style="height: 32px !important; min-height: 32px !important; background-color: #2563eb !important; color: white !important;"
2022-              on:click={() => {
2023-                // Give the QR code another moment to ensure it's fully rendered
2024-                setTimeout(() => window.print(), 100);
2025-              }}
2026-            >
2027-              Print
2028-            </button>
2029-          </div>
2030-        </div>
2031-      </div>
2032-    {/if}
2033-
2034-    <!-- Import Modal -->
2035-    {#if showImportModal}
2036-      <div
2037-        class="fixed inset-0 bg-black/90 z-50"
2038-        role="dialog"
2039-        aria-modal="true"
2040-        aria-label="Import Build"
2041-        tabindex="-1"
2042-      >
2043-        <!-- Adding a button to make the whole backdrop clickable/accessible -->
2044-        <button
2045-          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
2046-          on:click={() => (showImportModal = false)}
2047-          on:keydown={e => e.key === 'Escape' && (showImportModal = false)}
2048-          aria-label="Close modal background"
2049-        ></button>
2050-        <div
2051-          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6 md:p-8 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
2052-          role="document"
2053-          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: white;"
2054-          data-modal-content
2055-        >
2056-          <div class="flex justify-between items-center mb-6">
2057-            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Import Team Build</h3>
2058-            <button
2059-              class="py-0.25 px-2 h-[32px] flex items-center justify-center rounded transition-colors text-sm amber-button"
2060-              on:click={() => (showImportModal = false)}
2061-              aria-label="Close import modal"
2062-              style="height: 32px !important; min-height: 32px !important;"
2063-            >
2064-              <span>Close</span>
2065-            </button>
2066-          </div>
2067-          
2068-          <div class="space-y-6">
2069-            <p class="text-stone-600 dark:text-gray-200">
2070-              Paste a team build code below to import a shared build
2071-            </p>
2072-            <div class="space-y-3">
2073-              <label for="import-draft" class="sr-only">Import team build code</label>
2074-              <textarea
2075-                id="import-draft"
2076-                bind:value={importString}
2077-                class="w-full px-4 py-3 border-2 border-stone-300 dark:border-gray-600 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[120px] bg-white dark:bg-gray-700 text-stone-800 dark:text-white"
2078-                placeholder="Paste encoded draft here"
2079-              ></textarea>
2080-            </div>
2081-            <div class="flex justify-end gap-4 mt-8 pt-4 border-t border-stone-200 dark:border-amber-900">
2082-              <button
2083-                class="px-6 py-2 rounded-lg bg-stone-300 hover:bg-stone-400 text-stone-700 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-medium transition-colors shadow-md"
2084-                on:click={() => (showImportModal = false)}
2085-              >
2086-                Cancel
2087-              </button>
2088-              <button
2089-                class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm amber-button shadow-md"
2090-                style="height: 32px !important; min-height: 32px !important;"
2091-                on:click={importDraftString}
2092-              >
2093-                Import
2094-              </button>
2095-            </div>
2096-          </div>
2097-        </div>
2098-      </div>
2099-    {/if}
2100-    
2101-    <!-- Settings Modal -->
2102-    {#if showSettingsModal}
2103-      <div
2104-        class="fixed inset-0 bg-black/90 z-50"
2105-        role="dialog"
2106-        aria-modal="true"
2107-        aria-label="Settings"
2108-        tabindex="-1"
2109-      >
2110-        <!-- Adding a button to make the whole backdrop clickable/accessible -->
2111-        <button
2112-          class="absolute inset-0 w-full h-full border-0 bg-transparent cursor-pointer"
2113-          on:click={() => (showSettingsModal = false)}
2114-          on:keydown={e => e.key === 'Escape' && (showSettingsModal = false)}
2115-          aria-label="Close modal background"
2116-        ></button>
2117-        <div
2118-          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-6 md:p-8 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500 settings-modal-content"
2119-          role="document"
2120-          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
2121-        >
2122-          <div class="flex justify-between items-center mb-4">
2123-            <h3 class="text-lg font-bold text-stone-800 dark:text-white">Settings</h3>
2124-            <button
2125-              class="py-0.25 px-2 h-[32px] flex items-center justify-center rounded transition-colors text-sm amber-button"
2126-              on:click={() => (showSettingsModal = false)}
2127-              aria-label="Close settings modal"
2128-              style="height: 32px !important; min-height: 32px !important;"
2129-            >
2130-              <span>Close</span>
2131-            </button>
2132-          </div>
2133-          
2134-          <div class="space-y-8 px-4">
2135-            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
2136-              <div class="flex items-center">
2137-                <input 
2138-                  type="checkbox" 
2139-                  id="enable-sponsorships" 
2140-                  bind:checked={enableSponsorships}
2141-                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
2142-                />
2143-                <label for="enable-sponsorships" class="ml-3 text-stone-800 dark:text-white font-medium">
2144-                  Enable Sponsorships
2145-                </label>
2146-              </div>
2147-              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8">
2148-                If you prefer to build a team without using Sponsor or driver perks, uncheck this option.
2149-              </p>
2150-            </div>
2151-            
2152-            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
2153-              <div class="flex items-center">
2154-                <input 
2155-                  type="checkbox" 
2156-                  id="include-advanced" 
2157-                  bind:checked={includeAdvanced}
2158-                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
2159-                />
2160-                <label for="include-advanced" class="ml-3 text-stone-800 dark:text-white font-medium">
2161-                  Include Advanced
2162-                </label>
2163-              </div>
2164-              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8">
2165-                Enable this option to include advanced vehicles, weapons, and upgrades from the rulebook. When disabled, only basic options will be shown.
2166-              </p>
2167-            </div>
2168-            
2169-            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
2170-              <div class="flex items-center">
2171-                <input
2172-                  type="checkbox"
2173-                  id="dark-mode"
2174-                  bind:checked={darkMode}
2175-                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
2176-                />
2177-                <label for="dark-mode" class="ml-3 text-stone-800 dark:text-white font-medium">
2178-                  Dark Mode
2179-                </label>
2180-              </div>
2181-              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8">
2182-                Enable dark mode for better visibility in low-light conditions.
2183-              </p>
2184-            </div>
2185-
2186-            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
2187-              <div class="flex items-center">
2188-                <input
2189-                  type="checkbox"
2190-                  id="show-team-summary"
2191-                  bind:checked={showTeamSummary}
2192-                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
2193-                />
2194-                <label for="show-team-summary" class="ml-3 text-stone-800 dark:text-white font-medium">
2195-                  Show Team Summary
2196-                </label>
2197-              </div>
2198-              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8">
2199-                Show or hide the Team Summary section at the bottom of the page.
2200-              </p>
2201-            </div>
2202-
2203-            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
2204-              <div class="flex items-center">
2205-                <input
2206-                  type="checkbox"
2207-                  id="show-gaslands-math"
2208-                  bind:checked={showGaslandsMath}
2209-                  class="w-5 h-5 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
2210-                />
2211-                <label for="show-gaslands-math" class="ml-3 text-stone-800 dark:text-white font-medium">
2212-                  Show Gaslands Math
2213-                </label>
2214-              </div>
2215-              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8">
2216-                Show or hide the Gaslands Math section at the bottom of the page.
2217-              </p>
2218-            </div>
2219-
2220-            <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 space-y-3">
2221-              <h4 class="font-medium text-stone-800 dark:text-white mb-3">Print Style</h4>
2222-              <div class="space-y-2">
2223-                <div class="flex items-center">
2224-                  <input
2225-                    type="radio"
2226-                    id="print-style-classic"
2227-                    name="print-style"
2228-                    value="classic"
2229-                    bind:group={printStyle}
2230-                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
2231-                  />
2232-                  <label for="print-style-classic" class="ml-3 text-stone-800 dark:text-white">
2233-                    Classic
2234-                  </label>
2235-                </div>
2236-                <div class="flex items-center">
2237-                  <input
2238-                    type="radio"
2239-                    id="print-style-compact"
2240-                    name="print-style"
2241-                    value="compact"
2242-                    bind:group={printStyle}
2243-                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
2244-                  />
2245-                  <label for="print-style-compact" class="ml-3 text-stone-800 dark:text-white">
2246-                    Compact
2247-                  </label>
2248-                </div>
2249-                <div class="flex items-center">
2250-                  <input
2251-                    type="radio"
2252-                    id="print-style-dashboard"
2253-                    name="print-style"
2254-                    value="dashboard"
2255-                    bind:group={printStyle}
2256-                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
2257-                  />
2258-                  <label for="print-style-dashboard" class="ml-3 text-stone-800 dark:text-white">
2259-                    Dashboard
2260-                  </label>
2261-                </div>
2262-                <div class="flex items-center">
2263-                  <input
2264-                    type="radio"
2265-                    id="print-style-roster"
2266-                    name="print-style"
2267-                    value="roster"
2268-                    bind:group={printStyle}
2269-                    class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 focus:ring-amber-500"
2270-                  />
2271-                  <label for="print-style-roster" class="ml-3 text-stone-800 dark:text-white">
2272-                    Roster
2273-                  </label>
2274-                </div>
2275-              </div>
2276-              <p class="text-stone-600 dark:text-gray-200 text-sm ml-8">
2277-                Choose your preferred print layout style.
2278-              </p>
2279-            </div>
2280-
2281-            <div class="flex justify-end pt-4 mt-4 border-t border-stone-200 dark:border-amber-900">
2282-              <button
2283-                class="py-0.25 px-6 h-[32px] flex items-center justify-center rounded-lg transition-colors text-sm amber-button shadow-md"
2284-                style="height: 32px !important; min-height: 32px !important;"
2285-                on:click={() => {
2286-                  if ($user) saveSettingsToFirebase();
2287-                  showSettingsModal = false;
2288-                }}
2289-              >
2290-                Save & Close
2291-              </button>
2292-            </div>
2293-          </div>
2294-        </div>
2295-      </div>
2296-    {/if}
2297-    
2298-
2299-
2300-</section>
2301-
2302-<!-- Print-only view with vehicle cards -->
2303-<div id="gaslands-print-view">
2304-  <div class="sponsor-print-header">
2305-    <h1>Gaslands: {teamName}</h1>
2306-    <p>
2307-      Total: {totalCans}/{maxCans} cans 
2308-      {#if enableSponsorships && currentSponsor?.perks.length}
2309-        | Sponsor: {currentSponsor?.name || ''} 
2310-        | Perks: {perks.filter(p => currentSponsor?.perks.includes(p.id)).map(p => p.name).join(', ')}
2311-      {/if}
2312-    </p>
2313-  </div>
2314-  
2315-  <div class="print-card-grid">
2316-    {#each vehicles as v}
2317-      <div class="vehicle-card-print" style="border-color: {vehicleTypes.find(vt => vt.id === v.type)?.color || '#f59e0b'};">
2318-        <!-- Vehicle Card Header with Type & Cost -->
2319-        <div class="card-header">
2320-          <div class="card-title">
2321-            <div class="card-name">{v.name}</div>
2322-            <div class="vehicle-type-badge" style="background-color: {vehicleTypes.find(vt => vt.id === v.type)?.color || '#f59e0b'};">
2323-              {vehicleTypes.find(vt => vt.id === v.type)?.name || 'Unknown'}
2324-              {#if vehicleTypes.find(vt => vt.id === v.type)?.advanced} (Advanced){/if}
2325-            </div>
2326-          </div>
2327-          <div class="card-cost">
2328-            <div>Cost</div>
2329-            <div class="cost-value">{validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'}</div>
2330-            <div>cans</div>
2331-          </div>
2332-        </div>
2333-        
2334-        <!-- Stats Grid: A more structured layout -->
2335-        <div class="stats-grid">
2336-          <div class="stat-block">
2337-            <div class="stat-label">Hull</div>
2338-            <div class="hull-tracker">
2339-              {#if calculateMaxHull(v) > (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0)}
2340-                <span class="text-green-500 text-xs font-bold mr-1">(+{calculateMaxHull(v) - (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0)})</span>
2341-              {/if}
2342-              {#each Array(Math.min(10, calculateMaxHull(v))) as _, i}
2343-                <span class="hull-box"></span>
2344-              {/each}
2345-            </div>
2346-          </div>
2347-          
2348-          <div class="stats-row">
2349-            <div class="stat-block">
2350-              <div class="stat-label">Handling</div>
2351-              <div class="stat-value">{vehicleTypes.find(vt => vt.id === v.type)?.handling || 4}</div>
2352-            </div>
2353-            
2354-            <div class="stat-block">
2355-              <div class="stat-label">Gear</div>
2356-              <div class="stat-value">{vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 6}</div>
2357-            </div>
2358-            
2359-            <div class="stat-block">
2360-              <div class="stat-label">Crew</div>
2361-              <div class="stat-value">{vehicleTypes.find(vt => vt.id === v.type)?.crew || 1}</div>
2362-            </div>
2363-            
2364-            <div class="stat-block">
2365-              <div class="stat-label">Weight</div>
2366-              <div class="stat-value">
2367-                {vehicleTypes.find(vt => vt.id === v.type)?.weight === 1 ? 'Light' : 
2368-                vehicleTypes.find(vt => vt.id === v.type)?.weight === 2 ? 'Medium' : 
2369-                vehicleTypes.find(vt => vt.id === v.type)?.weight === 3 ? 'Heavy' : 'Massive'}
2370-              </div>
2371-            </div>
2372-          </div>
2373-        </div>
2374-        
2375-        <!-- Weapons & Upgrades in a clearer format -->
2376-        <div class="loadout">
2377-          {#if v.weapons.length > 0}
2378-            <div class="loadout-section">
2379-              <div class="section-header">Weapons</div>
2380-              <table class="loadout-table">
2381-                <tbody>
2382-                  {#each v.weapons as weaponId}
2383-                    {@const baseWeaponId = weaponId.split('_')[0]}
2384-                    {@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
2385-                    {@const facing = v.weaponFacings?.[weaponId] || weaponObj?.facing || 'front'}
2386-                    <tr>
2387-                      <td class="item-name">{weaponObj?.name || weaponId}</td>
2388-                      <td class="item-facing">{facing}</td>
2389-                      <td class="item-attack">{weaponObj?.attackDice || '-'}{weaponObj?.attackDice ? 'D' : ''}</td>
2390-                    </tr>
2391-                  {/each}
2392-                </tbody>
2393-              </table>
2394-            </div>
2395-          {/if}
2396-          
2397-          {#if v.upgrades.length > 0}
2398-            <div class="loadout-section">
2399-              <div class="section-header">Upgrades</div>
2400-              <ul class="upgrade-list">
2401-                {#each v.upgrades as upgradeId}
2402-                  <li>{upgrades.find(u => u.id === upgradeId)?.name || upgradeId}</li>
2403-                {/each}
2404-              </ul>
2405-            </div>
2406-          {/if}
2407-        </div>
2408-        
2409-        <!-- Perks at bottom -->
2410-        {#if v.perks.length > 0}
2411-          <div class="card-footer">
2412-            <span class="perk-label">Perks:</span> {v.perks.map(id => perks.find(p => p.id === id)?.name || "").join(', ')}
2413-          </div>
2414-        {/if}
2415-      </div>
2416-    {/each}
2417-  </div>
2418-  
2419-  <!-- Perk details section -->
2420-  <div id="perk-details-print">
2421-    <h2>Weapons & Upgrades Details</h2>
2422-    
2423-    <div class="print-section">
2424-      <h3>Weapons</h3>
2425-      <div class="perk-list">
2426-        {#each [...new Set(vehicles.flatMap(v => v.weapons))] as weaponId}
2427-          {@const baseWeaponId = weaponId.split('_')[0]}
2428-          {@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
2429-          {#if weaponObj}
2430-            <div class="perk-item">
2431-              <strong>{weaponObj.name}</strong> - 
2432-              {weaponObj.cost} cans
2433-              {#if weaponObj.unique}
2434-                (Unique)
2435-              {/if}
2436-            </div>
2437-          {/if}
2438-        {/each}
2439-      </div>
2440-    </div>
2441-    
2442-    <div class="print-section">
2443-      <h3>Upgrades</h3>
2444-      <div class="perk-list">
2445-        {#each [...new Set(vehicles.flatMap(v => v.upgrades))] as upgradeId}
2446-          {#if upgrades.find(u => u.id === upgradeId)}
2447-            <div class="perk-item">
2448-              <strong>{upgrades.find(u => u.id === upgradeId)?.name}</strong> - 
2449-              {upgrades.find(u => u.id === upgradeId)?.specialRules}
2450-            </div>
2451-          {/if}
2452-        {/each}
2453-      </div>
2454-    </div>
2455-    
2456-    {#if enableSponsorships}
2457-    <div class="print-section">
2458-      <h3>Perks</h3>
2459-      <div class="perk-list">
2460-        {#each [...new Set(vehicles.flatMap(v => v.perks))] as perkId}
2461-          {#if perks.find(p => p.id === perkId)}
2462-            <div class="perk-item">
2463-              <strong>{perks.find(p => p.id === perkId)?.name} (Level {perks.find(p => p.id === perkId)?.level})</strong> - 
2464-              {perks.find(p => p.id === perkId)?.text}
2465-            </div>
2466-          {/if}
2467-        {/each}
2468-      </div>
2469-    </div>
2470-    {/if}
2471-  </div>
2472-  
2473-  <!-- QR Code and footer -->
2474-  <div class="print-footer">
2475-    <div class="qr-code-container">
2476-      {#if qrDataUrl}
2477-        <img src={qrDataUrl} alt="QR Code" class="qr-code-image" />
2478-      {:else}
2479-        <!-- Hidden image element that will be updated when printing without showing the modal -->
2480-        <img id="print-qr-code" src="" alt="QR Code" class="qr-code-image" />
2481-        <!-- Placeholder is only shown when not printing -->
2482-        <div class="qr-code-placeholder print-hide">QR Code</div>
2483-      {/if}
2484-      <div class="qr-code-caption">Scan to load team</div>
2485-    </div>
2486-    <div class="print-footer-text">
2487-      Generated by Gaslands Garage on {new Date().toLocaleDateString()}
2488-    </div>
2489-  </div>
2490-</div>
