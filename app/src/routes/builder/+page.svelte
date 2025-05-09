<!-- Updated from the content provided by the user -->
<script lang="ts">
	import { nanoid } from 'nanoid';
	import { validateDraft } from '$lib/validate';
	import type { Draft, Validation } from '$lib/validate/model';
	import { encodeDraft, decodeDraft } from '$lib/draft/io';
	import { goto } from '$app/navigation';
	import { draftToDataURL } from '$lib/draft/qr';
	import Auth from '$lib/components/Auth.svelte';
	import TeamsModal from '$lib/components/TeamsModal.svelte';
	import { user } from '$lib/firebase';
import { getUserSettings, saveUserSettings, DEFAULT_SETTINGS } from '$lib/services/settings';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	/* ---------- server data ---------- */
	export let data: {
		sponsors: import('$lib/rules/types').Sponsor[];
		vehicleTypes: import('$lib/rules/types').Vehicle[];
		weapons: import('$lib/rules/types').Weapon[];
		upgrades: import('$lib/rules/types').Upgrade[];
		perks: import('$lib/rules/types').Perk[];
	};
	const { sponsors, vehicleTypes, weapons, upgrades, perks } = data;

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
	// Track hazard tokens and damage for each vehicle
	let vehicleHazards: Record<string, number> = {};
	let vehicleDamage: Record<string, number> = {};

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
				totalSlots += weaponObj.buildSlots || 1;
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
				totalSlots += upgradeObj.buildSlots || 1;
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
		
		// Apply weapon facing rules:
		// 1. Crew Fired weapons are always 360° (any)
		// 2. Dropped weapons are rear or side only (default to rear)
		// 3. Fixed facing weapons use their specified facing
		// 4. Otherwise use provided facing or default to front
		let actualFacing = 'front';
		
		if (weaponObj?.crewFired) {
			actualFacing = 'any'; // Crew fired weapons are always 360°
		} else if (weaponObj?.dropped) {
			actualFacing = 'rear'; // Dropped weapons default to rear
		} else if (weaponObj?.facing && weaponObj.facing !== 'any') {
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
	
	// Damage management
	function getDamage(vehicleId: string): number {
		return vehicleDamage[vehicleId] || 0;
	}
	
	function incrementDamage(vehicleId: string) {
		const vehicle = vehicles.find(v => v.id === vehicleId);
		if (!vehicle) return;
		
		const maxHull = vehicleTypes.find(vt => vt.id === vehicle.type)?.maxHull || 0;
		const currentDamage = getDamage(vehicleId);
		
		// Don't increment if already at max damage
		if (currentDamage >= maxHull) return;
		
		vehicleDamage = {
			...vehicleDamage,
			[vehicleId]: currentDamage + 1
		};
	}
	
	function decrementDamage(vehicleId: string) {
		if (getDamage(vehicleId) > 0) {
			vehicleDamage = {
				...vehicleDamage,
				[vehicleId]: getDamage(vehicleId) - 1
			};
		}
	}
	
	function getRemainingHull(vehicleId: string): number {
		const vehicle = vehicles.find(v => v.id === vehicleId);
		if (!vehicle) return 0;
		
		const maxHull = vehicleTypes.find(vt => vt.id === vehicle.type)?.maxHull || 0;
		const damage = getDamage(vehicleId);
		
		return Math.max(0, maxHull - damage);
	}

	/* ---------- modals & menu state ---------- */
	let qrDataUrl: string | null = null;
	let showImportModal = false;
	let showSettingsModal = false;
	
	// Dark mode is now handled through CSS classes instead of JavaScript
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
					darkMode
				});
			} catch (error) {
				console.error("Error saving settings:", error);
			}
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
		}
		
		// Give the browser a moment to render the QR code into the DOM
		setTimeout(() => {
			window.print();
		}, 300);
	}
	
	// Helper function to generate the print view HTML
	function generatePrintView(draft, qrCodeUrl) {
		// Generate HTML for each vehicle card
		const vehicleCards = draft.vehicles.map((vehicle, index) => {
			const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.type);
			if (!vehicleType) return '';
			
			// Get vehicle data
			const vehicleName = vehicle.name || `Vehicle ${index + 1}`;
			const hullBoxes = Array(vehicleType.maxHull).fill(0).map(() => `<div class="hull-box"></div>`).join('');
			
			// Get weapons
			const weapons = vehicle.weapons
				.map(weaponId => {
					const baseWeaponId = weaponId.split('_')[0];
					const weaponObj = weapons.find(w => w.id === baseWeaponId);
					return weaponObj ? 
						`<tr><td class="item-name">${weaponObj.name}</td><td class="item-facing">${vehicle.weaponFacings?.[weaponId] || 'front'}</td></tr>` 
						: '';
				})
				.join('');
				
			// Get upgrades
			const upgrades = (vehicle.upgrades || [])
				.map(upgradeId => {
					const upgradeObj = upgrades.find(u => u.id === upgradeId);
					return upgradeObj ? `<li>${upgradeObj.name}</li>` : '';
				})
				.join('');
				
			// Get perks
			const perks = vehicle.perks
				.map(perkId => {
					const perkObj = perks.find(p => p.id === perkId);
					return perkObj ? `<li>${perkObj.name}</li>` : '';
				})
				.join('');
				
			// Return the vehicle card HTML
			return `
				<div class="vehicle-card-print">
					<div class="card-header">
						<div class="card-title">
							<div class="card-name">${vehicleName}</div>
							<div class="vehicle-type">${vehicleType.name}</div>
						</div>
						<div class="card-cost">
							<span>CANS</span>
							<span class="cost-value">${vehicleBaseCost(vehicleType)}</span>
						</div>
					</div>
					
					<div class="stats-grid">
						<div class="stat-block">
							<div class="stat-label">Hull Points</div>
							<div class="hull-tracker">${hullBoxes}</div>
						</div>
						
						<div class="stats-row">
							<div>
								<div class="stat-label">Handling</div>
								<div class="stat-value">${vehicleType.handling || 4}</div>
							</div>
							<div>
								<div class="stat-label">Max Gear</div>
								<div class="stat-value">${vehicleType.maxGear}</div>
							</div>
							<div>
								<div class="stat-label">Crew</div>
								<div class="stat-value">${vehicleType.crew}</div>
							</div>
						</div>
					</div>
					
					<div class="loadout">
						${weapons ? `
							<div class="loadout-section">
								<div class="section-header">Weapons</div>
								<table class="loadout-table">
									${weapons}
								</table>
							</div>
						` : ''}
						
						${upgrades ? `
							<div class="loadout-section">
								<div class="section-header">Upgrades</div>
								<ul class="upgrade-list">
									${upgrades}
								</ul>
							</div>
						` : ''}
						
						${perks ? `
							<div class="loadout-section">
								<div class="section-header">Perks</div>
								<ul class="upgrade-list">
									${perks}
								</ul>
							</div>
						` : ''}
					</div>
				</div>
			`;
		}).join('');
		
		// Generate the complete print view
		return `
			<div class="sponsor-print-header">
				<h1>${draft.teamName || 'Gaslands Team'}</h1>
				<p>Total: ${validation.cans} cans | Sponsor: ${sponsor?.name || 'None'}</p>
			</div>
			
			<div class="print-card-grid">
				${vehicleCards}
			</div>
			
			<div class="print-footer">
				<div class="qr-code-container">
					<img src="${qrCodeUrl}" alt="QR Code" class="qr-code-image" />
					<div class="qr-code-caption">Scan to load team</div>
				</div>
				<div class="print-footer-text">
					Generated by Gaslands Garage on ${new Date().toLocaleDateString()}
				</div>
			</div>
		`;
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
		// Add dark mode class to html element for global styling
		if (darkMode) {
			document.documentElement.classList.add('dark-mode');
		} else {
			document.documentElement.classList.remove('dark-mode');
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
				const isDarkMode = document.documentElement.classList.contains('dark-mode');
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
  .bg-green-50 {
    display: none !important;
  }
  
  /* Show the print view */
  #gaslands-print-view {
    display: block !important;
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
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    background: white;
    overflow: auto;
    padding: 20px;
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
			<div class="flex items-center gap-2">
				<b>Team:</b>&nbsp;&nbsp;&nbsp; 
				<input 
					type="text" 
					bind:value={teamName}
					class="bg-transparent dark:bg-gray-700 border-b-2 border-amber-500 px-3 py-1 font-extrabold text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-600 min-w-[200px] w-auto text-2xl md:text-3xl" 
					aria-label="Team Name"
				/>&nbsp;&nbsp;

				<b>Total Cans:</b>&nbsp;&nbsp;&nbsp;
				<input 
					type="number" 
					bind:value={maxCans}
					min="1"
					max="1000"
					class="bg-transparent dark:bg-gray-700 border-b-2 border-amber-500 px-3 py-1 font-extrabold text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-600 w-[80px] text-center text-2xl md:text-3xl" 
					aria-label="Max Cans"
				/>
			</div>
		</div>
		<!-- <p class="text-stone-600 mt-2 text-sm md:text-base">Create a deadly team and dominate the wasteland</p> -->
	</header>
<hr>
	<!-- Sponsor selector (only shown if enableSponsorships is true) -->
	{#if enableSponsorships}
		<div class="bg-white p-5 rounded-lg shadow-md mb-6">
			<div class="flex flex-wrap md:flex-nowrap items-start gap-4">
				<div class="w-full md:w-1/3">
					<div class="flex items-center gap-4">
						<label for="sponsor-select" class="text-lg font-bold text-stone-800 whitespace-nowrap">
							Choose Your Sponsor: &nbsp;&nbsp;
						</label>
						<div class="relative flex-grow">
							<select
								id="sponsor-select"
								bind:value={sponsorId}
								class="w-full px-4 py-3 border-2 border-amber-200 rounded-lg bg-white appearance-none pr-10 text-stone-800 focus:outline-none focus:border-amber-500"
							>
								{#each sponsors as s}
									<option value={s.id}>{s.name}</option>
								{/each}
							</select>
						</div>

					</div>
				</div>
				<div class="w-full md:w-2/3 md:pt-8">
					Sponsor Source:&nbsp;&nbsp;
						{sponsors.find(s => s.id === sponsorId)?.source || "Unknown source"}
					
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
				<!-- Edit/Play Mode Toggle -->&nbsp;&nbsp;&nbsp;&nbsp;
				<div class="bg-stone-300 dark:bg-gray-700 p-1 rounded-full flex">
					<button
						class="px-3 py-1 rounded-full text-sm font-medium transition-colors {!playMode ? 'bg-amber-600 text-white' : 'text-stone-700 dark:text-gray-300 hover:bg-stone-400 dark:hover:bg-gray-600'}"
						on:click={() => playMode = false}
					>
						Edit Team
					</button>
					<button
						class="px-3 py-1 rounded-full text-sm font-medium transition-colors {playMode ? 'bg-green-600 text-white' : 'text-stone-700 dark:text-gray-300 hover:bg-stone-400 dark:hover:bg-gray-600'}"
						on:click={() => playMode = true}
					>
						Play Mode
					</button>
				</div>
			</div>
			<button
				class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-md flex items-center"
				on:click={() => addVehicle()}
				disabled={playMode}
				class:opacity-50={playMode}
				class:cursor-not-allowed={playMode}
			>
				<span class="mr-2">+</span>
				Add Vehicle
			</button>
		</div>

		{#if vehicles.length === 0}
			<div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
				<p class="text-stone-500 dark:text-gray-400 mt-4 text-lg">No vehicles yet. Add some vehicles to your team!</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
				{#each vehicles as v (v.id)}
					<div class="bg-stone-200 dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-2 no-card-padding" style="border-color: {vehicleTypes.find(vt => vt.id === v.type)?.color || '#f59e0b'}">
						<!-- Vehicle header -->
						<div class="flex items-center justify-between bg-stone-300 dark:bg-gray-700 p-5 border-b-2 border-gray-400 dark:border-gray-600">
							<div class="flex-1 min-w-0">
								<div class="flex flex-row gap-2 items-start">
									<div class="w-2/5">
										<label for="vehicle-type-{v.id}" class="block text-xs text-stone-600 dark:text-gray-300 mb-1 font-semibold uppercase">Vehicle Type</label>
										<select
											id="vehicle-type-{v.id}"
											bind:value={v.type}
											class="w-full p-2 border border-stone-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
											on:change={() => {
												const vt = vehicleTypes.find((t) => t.id === v.type)!;
												v.name = vt.name;
											}}
										>
											{#each filteredVehicleTypes as vt}
												<option value={vt.id}>{vt.name}</option>
											{/each}
										</select>
									</div>
									<div class="flex-1">
										<label for="vehicle-name-{v.id}" class="block text-xs text-stone-600 dark:text-gray-300 mb-1 font-semibold uppercase">Vehicle Name</label>
										<input
											id="vehicle-name-{v.id}"
											bind:value={v.name}
											class="w-full p-2 border border-stone-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
											placeholder="Vehicle name"
										/>
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2 self-start mt-6">
								<button
									class="p-2 h-8 w-8 flex items-center justify-center bg-amber-500 text-white hover:bg-amber-600 rounded-full transition-colors"
									on:click={() => toggleVehicleCollapse(v.id)}
									aria-label={collapsedVehicles.has(v.id) ? "Expand vehicle" : "Collapse vehicle"}
								>
									<span>{collapsedVehicles.has(v.id) ? "+" : "-"}</span>
									<span class="sr-only">{collapsedVehicles.has(v.id) ? "Expand vehicle" : "Collapse vehicle"}</span>
								</button>
								<button
									class="p-2 h-8 w-8 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
									on:click={() => removeVehicle(v.id)}
									aria-label="Remove vehicle"
								>
									<span>×</span>
									<span class="sr-only">Remove vehicle</span>
								</button>
							</div>
						</div>
						
						<!-- Collapsed view - Only shown when collapsed -->
						{#if collapsedVehicles.has(v.id)}
							<div class="p-4 flex items-center justify-between bg-stone-100 dark:bg-gray-800">
								<div class="flex items-center gap-4">
									<div class="vehicle-type-icon vehicle-type-{v.type}" title="{vehicleTypes.find(vt => vt.id === v.type)?.name || 'Unknown'}"></div>
									<div class="font-medium">
										{v.weapons.length} weapons | {v.upgrades.length} upgrades | Cost: {validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'} cans
									</div>
								</div>
								<div class="weight-class-indicator weight-{vehicleTypes.find(vt => vt.id === v.type)?.weight || 1}">
									{vehicleTypes.find(vt => vt.id === v.type)?.weight === 1 ? 'Light' : 
									vehicleTypes.find(vt => vt.id === v.type)?.weight === 2 ? 'Medium' : 
									vehicleTypes.find(vt => vt.id === v.type)?.weight === 3 ? 'Heavy' : 'Massive'}
								</div>
							</div>
						{/if}
						
						<!-- Vehicle details - Hidden when collapsed -->
						<div class="p-8" class:hidden={collapsedVehicles.has(v.id)}>
							
							<!-- Interactive dashboard elements - Always visible in Play Mode -->
							<div class="interactive-dashboard bg-stone-50 dark:bg-gray-700 border border-stone-300 dark:border-gray-600 rounded-lg p-4 mb-6" class:hidden={!playMode}>
								
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div class="hull-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600">
										<div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">Hull Points</div>
										<div class="flex flex-wrap gap-1">
											{#each Array(vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0) as _, i}
												<div class="hull-checkbox">
													<input type="checkbox" id="hull-{v.id}-{i}" class="hull-checkbox-input" />
													<label for="hull-{v.id}-{i}" class="hull-checkbox-label"></label>
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
												max="{vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 6}" 
												value="1" 
												class="gear-range w-full h-7 appearance-none bg-stone-200 dark:bg-gray-600 rounded-full" 
											/>
											<div class="gear-markers flex justify-between px-2 mt-1">
												{#each Array((vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 6)) as _, i}
													<span class="gear-number text-xs font-bold">{i+1}</span>
												{/each}
											</div>
										</div>
									</div>
									
									<div class="crew-hazard-row flex gap-4 col-span-1 md:col-span-2">
										<div class="crew-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600 flex-1">
											<div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">Crew: {vehicleTypes.find(vt => vt.id === v.type)?.crew || 1}</div>
											<div class="flex flex-wrap gap-1">
												{#each Array(vehicleTypes.find(vt => vt.id === v.type)?.crew || 1) as _, i}
													<div class="crew-checkbox">
														<input type="checkbox" id="crew-{v.id}-{i}" class="crew-checkbox-input" />
														<label for="crew-{v.id}-{i}" class="crew-checkbox-label"></label>
													</div>
												{/each}
											</div>
										</div>
										
										<div class="hazard-tracker p-3 bg-white dark:bg-gray-800 rounded-lg border border-stone-300 dark:border-gray-600 flex-1">
											<div class="tracker-label text-sm font-semibold text-stone-600 dark:text-gray-300 uppercase mb-2">Hazard Tokens</div>
											<div class="hazard-counter flex items-center justify-center gap-3">
												<button 
													class="counter-btn counter-minus w-8 h-8 bg-stone-200 dark:bg-gray-600 hover:bg-stone-300 dark:hover:bg-gray-500 rounded-full flex items-center justify-center font-bold text-xl"
													on:click={() => decrementHazard(v.id)}
												>-</button>
												<span class="counter-value text-2xl font-bold">{getHazardCount(v.id)}</span>
												<button 
													class="counter-btn counter-plus w-8 h-8 bg-stone-200 dark:bg-gray-600 hover:bg-stone-300 dark:hover:bg-gray-500 rounded-full flex items-center justify-center font-bold text-xl"
													on:click={() => incrementHazard(v.id)}
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
										{#each v.weapons as weaponId, i}
											{@const baseWeaponId = weaponId.split('_')[0]}
											{@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
											{@const facing = v.weaponFacings?.[weaponId] || 'front'}
											<div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
												<span class="font-bold text-stone-700 dark:text-gray-300">{weaponObj?.name || weaponId}</span>
												<span class="text-xs text-stone-500 dark:text-gray-400 ml-2">({facing})</span>
												{#if weaponObj?.specialRules}
													<div class="text-xs text-stone-500 dark:text-gray-400">{weaponObj.specialRules}</div>
												{/if}
											</div>
										{/each}
										
										{#each v.upgrades as upgradeId}
											{@const upgrade = upgrades.find(u => u.id === upgradeId)}
											<div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
												<span class="font-bold text-stone-700 dark:text-gray-300">{upgrade?.name || upgradeId}</span>
												{#if upgrade?.specialRules}
													<div class="text-xs text-stone-500 dark:text-gray-400">{upgrade.specialRules}</div>
												{/if}
											</div>
										{/each}
										
										{#each v.perks as perkId}
											{@const perk = perks.find(p => p.id === perkId)}
											<div class="text-sm py-1 border-b border-stone-200 dark:border-gray-700">
												<span class="font-bold text-stone-700 dark:text-gray-300">{perk?.name || perkId}</span>
												{#if perk?.text}
													<div class="text-xs text-stone-500 dark:text-gray-400">{perk.text}</div>
												{/if}
											</div>
										{/each}
										
										{#if v.weapons.length === 0 && v.upgrades.length === 0 && v.perks.length === 0}
											<div class="text-sm text-stone-500 dark:text-gray-400 italic">No weapons, upgrades, or perks</div>
										{/if}
									</div>
								</div>
							{/if}
							
							<!-- Weapons section - Hidden in Play Mode -->
							<div class="mb-4" class:hidden={playMode}>
								<h3 class="font-bold text-stone-800 dark:text-gray-200 mb-2 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
									<span class="bg-stone-300 dark:bg-gray-600 px-2 py-1 rounded-t mr-2">WEAPONS</span>
								</h3>
								
								{#if v.weapons.length === 0}
									<p class="text-stone-500 dark:text-gray-400 text-sm italic px-2">No weapons equipped.</p>
								{:else}
									<ul class="space-y-1 mb-3 border border-stone-300 dark:border-gray-600 rounded overflow-hidden divide-y divide-stone-300 dark:divide-gray-600">
										{#each v.weapons as weaponId, i}
											{@const baseWeaponId = weaponId.split('_')[0]}
											{@const weaponObj = weapons.find(w => w.id === baseWeaponId)}
											{@const facing = v.weaponFacings?.[weaponId] || 'front'}
											{@const isFixedFacing = weaponObj?.facing && weaponObj.facing !== 'any'}
											<li class="flex items-center justify-between bg-stone-50 px-3 py-2">
												<div class="flex items-center justify-between">
													<!-- Weapon details -->
													<div class="flex-1">
														<b><div class="text-stone-700 dark:text-gray-200 font-bold">
															{weaponObj?.name || weaponId}
															{#if weaponObj?.advanced}
																<span class="ml-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">(Advanced)</span>
															{/if}
														</div></b>
														<div class="text-stone-600 dark:text-gray-400 text-xs mt-1 flex flex-wrap gap-3">
															{#if weaponObj?.cost}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	{weaponObj.cost} cans&nbsp;
																</span>
															{/if}
															{#if weaponObj?.slots}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	{weaponObj.slots} {weaponObj.slots === 1 ? 'slot' : 'slots'}&nbsp;
																</span>
															{/if}
															{#if weaponObj?.range}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	Range: {weaponObj.range} range
																</span>
															{/if}
															{#if weaponObj?.attackDice != null}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	{weaponObj.attackDice}D attack dice
																</span>
															{/if}
															{#if weaponObj?.crewFired}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	Crew fired
																</span>
															{/if}
															{#if weaponObj?.dropped}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	Dropped
																</span>
															{/if}
															{#if weaponObj?.unique}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	Unique
																</span>
															{/if}
															{#if weaponObj?.source && weaponObj.source !== "Gaslands Refueled"}
																<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
																	{weaponObj.source}
																</span>
															{/if}
														</div>
														{#if weaponObj?.specialRules}
															<div class="text-stone-500 dark:text-gray-400 text-xs mt-2 w-full">Rules: {weaponObj.specialRules}</div>
														{/if}
														{#if weaponObj?.crewFired}
														<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
															&nbsp;Crew fired&nbsp;
														</span>
													{/if}
													{#if weaponObj?.dropped}
														<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
															&nbsp;Dropped&nbsp;
														</span>
													{/if}
													{#if weaponObj?.unique}
														<span class="px-2 py-0.5 bg-stone-200 dark:bg-gray-600 rounded">
															&nbsp;Unique&nbsp;
														</span>
													{/if}
													</div>
													<!-- Remove button -->
													<button
														class="p-1 h-6 w-6 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors ml-2 flex-shrink-0"
														on:click={() => removeWeapon(v.id, i)}
														aria-label="Remove weapon"
													>
														<span>×</span>
														<span class="sr-only">Remove weapon</span>
													</button>
												</div>
												
												<!-- Weapon facing controls -->
												<div class="mt-2 flex items-center">
													<span class="text-stone-600 dark:text-gray-300 text-xs font-semibold uppercase mr-2">Facing:</span>
													{#if isFixedFacing || weaponObj?.crewFired || weaponObj?.dropped}
														<!-- Disabled dropdown for fixed facing weapons, crew fired weapons, or dropped weapons -->
														<div class="relative inline-flex">
															<select 
																class="text-xs py-1 px-2 pr-8 border border-stone-300 dark:border-gray-600 rounded bg-stone-100 dark:bg-gray-800 text-stone-700 dark:text-gray-400 font-medium cursor-not-allowed appearance-none"
																value={weaponObj?.crewFired ? "any" : (weaponObj?.dropped ? (weaponObj?.facing || "rear") : weaponObj?.facing)}
																disabled
															>
																<option value={weaponObj?.crewFired ? "any" : (weaponObj?.dropped ? (weaponObj?.facing || "rear") : weaponObj?.facing)}>
																	{weaponObj?.crewFired ? "360° arc" : (weaponObj?.dropped ? `${weaponObj?.facing || "rear"} (dropped)` : `${weaponObj?.facing} (fixed)`)}
																</option>
															</select>
															<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-stone-500 dark:text-gray-400">
																<svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
																	<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" fill-rule="evenodd"></path>
																</svg>
															</div>
														</div>
													{:else}
														<!-- Enabled dropdown for variable facing weapons -->
														<div class="relative inline-flex">
															<select 
																class="text-xs py-1 px-2 pr-8 border border-stone-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-stone-700 dark:text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none"
																value={facing}
																on:change={e => {
																	const newFacing = e.target.value;
																	// Update the facing for this weapon
																	vehicles = vehicles.map(vehicle => {
																		if (vehicle.id === v.id) {
																			return {
																				...vehicle,
																				weaponFacings: {
																					...(vehicle.weaponFacings || {}),
																					[weaponId]: newFacing
																				}
																			};
																		}
																		return vehicle;
																	});
																}}
															>
																<option value="front">front</option>
																<option value="side">side</option>
																<option value="rear">rear</option>
																<option value="turret">turret</option>
																<option value="hull">hull</option>
																<option value="any">360° arc</option>
															</select>
															<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-stone-500 dark:text-gray-400">
																<svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
																	<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" fill-rule="evenodd"></path>
																</svg>
															</div>
														</div>
													{/if}
												</div>
											</li>
										{/each}
									</ul>
								{/if}
								
								<div class="relative">
									<label for="add-weapon-{v.id}" class="sr-only">Add a weapon</label>
									<select
										id="add-weapon-{v.id}"
										class="w-full p-2 border border-stone-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-stone-800 dark:text-gray-200 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const target = e.target as HTMLSelectElement;
											const weaponId = target.value;
											if (weaponId) {
												// The addWeapon function will now enforce facing rules automatically
												addWeapon(v.id, weaponId);
												target.value = ""; // Reset selection
											}
										}}
										disabled={!filteredWeapons.some(w => (w.buildSlots || 1) === 0) && calculateUsedBuildSlots(v) >= (vehicleTypes.find(vt => vt.id === v.type)?.buildSlots || 2)}
									>
										<option value="" disabled selected>+ Add weapon</option>
										{#each filteredWeapons as w}
											<option value={w.id} disabled={(w.buildSlots || 1) > 0 && calculateUsedBuildSlots(v) + (w.buildSlots || 1) > (vehicleTypes.find(vt => vt.id === v.type)?.buildSlots || 2)}>
												{w.name}
												{w.crewFired ? " (Crew Fired)" : ""}
												{w.dropped ? " (Dropped)" : ""}
												{(w.buildSlots || 1) === 0 ? " (Free)" : ""}
											</option>
										{/each}
									</select>
									<!-- Dropdown arrow removed -->
								</div>
							</div>
							
							<!-- Upgrades section - Hidden in Play Mode -->
							<div class="mb-4 mt-6" class:hidden={playMode}>
								<h3 class="font-bold text-stone-800 dark:text-gray-200 mb-2 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
									<span class="bg-stone-300 dark:bg-gray-600 px-2 py-1 rounded-t mr-2">UPGRADES</span>
								</h3>
								
								{#if v.upgrades.length === 0}
									<p class="text-stone-500 text-sm italic px-2">No upgrades installed.</p>
								{:else}
									<ul class="space-y-1 mb-3 border border-stone-300 rounded overflow-hidden divide-y divide-stone-300">
										{#each v.upgrades as upgradeId, i}
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
													class="p-1 h-6 w-6 ml-2 flex-shrink-0 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
													on:click={() => removeUpgrade(v.id, i)}
													aria-label="Remove upgrade"
												>
													<span>×</span>
													<span class="sr-only">Remove upgrade</span>
												</button>
											</li>
										{/each}
									</ul>
								{/if}
								
								<div class="relative">
									<label for="add-upgrade-{v.id}" class="sr-only">Add an upgrade</label>
									<select
										id="add-upgrade-{v.id}"
										class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const target = e.target as HTMLSelectElement;
											const upgradeId = target.value;
											if (upgradeId) {
												addUpgrade(v.id, upgradeId);
												target.value = ""; // Reset selection
											}
										}}
										disabled={!filteredUpgrades.some(u => (u.buildSlots || 1) === 0) && calculateUsedBuildSlots(v) >= (vehicleTypes.find(vt => vt.id === v.type)?.buildSlots || 2)}
									>
										<option value="" disabled selected>+ Add upgrade</option>
										{#each filteredUpgrades as u}
											<option value={u.id} disabled={(u.buildSlots || 1) > 0 && calculateUsedBuildSlots(v) + (u.buildSlots || 1) > (vehicleTypes.find(vt => vt.id === v.type)?.buildSlots || 2)}>
												{u.name}
												{(u.buildSlots || 1) === 0 ? " (Free)" : ""}
											</option>
										{/each}
									</select>
								</div>
							</div>
							
							<!-- Perks section - Hidden in Play Mode -->
							<div class="mb-4 mt-6" class:hidden={playMode}>
								<h3 class="font-bold text-stone-800 dark:text-gray-200 mb-2 flex items-center border-b border-stone-300 dark:border-gray-600 pb-1">
									<span class="bg-stone-300 dark:bg-gray-600 px-2 py-1 rounded-t mr-2">PERKS</span>

								</h3>
								
								{#if v.perks.length === 0}
									<p class="text-stone-500 dark:text-gray-400 text-sm italic px-2">No perks selected.</p>
								{:else}
									<ul class="space-y-1 mb-3 border border-stone-300 dark:border-gray-600 rounded overflow-hidden divide-y divide-stone-300 dark:divide-gray-600">
										{#each v.perks as perkId, i}
											{@const perk = perks.find(p => p.id === perkId)}
											<li class="flex items-center justify-between bg-stone-50 dark:bg-gray-700 px-3 py-2">
												<div class="flex-1">
													<b><span class="text-stone-700 dark:text-gray-200 font-bold block">{perk?.name || perkId}</span></b>
													<span class="text-stone-500 dark:text-gray-400 text-xs">{perk?.text || ""}</span>
												</div>
												<button
													class="p-1 h-6 w-6 ml-2 flex-shrink-0 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
													on:click={() => removePerk(v.id, i)}
													aria-label="Remove perk"
												>
													<span>×</span>
													<span class="sr-only">Remove perk</span>
												</button>
											</li>
										{/each}
									</ul>
								{/if}
								
								<div class="relative">
									<label for="add-perk-{v.id}" class="sr-only">Add a perk</label>
									<select
										id="add-perk-{v.id}"
										class="w-full p-2 border border-stone-300 rounded bg-white text-stone-800 appearance-none pr-10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
										on:change={e => {
											const target = e.target as HTMLSelectElement;
											const perkId = target.value;
											if (perkId) {
												addPerk(v.id, perkId);
												target.value = ""; // Reset selection
											}
										}}
										disabled={availablePerks.filter(p => !v.perks.includes(p.id)).length === 0}
									>
										<option value="" disabled selected>+ Add perk</option>
										{#each availablePerks as p}
											{#if !v.perks.includes(p.id)}
												<option value={p.id} title={p.text}>{p.name}</option>
											{/if}
										{/each}
									</select>
								</div>
							</div>
							
							<!-- Vehicle stats -->
							<div class="flex flex-wrap gap-2 text-sm bg-stone-100 dark:bg-gray-700 p-3 rounded mt-3">
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center flex-1 min-w-[70px]">
									<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Cost</span>
									<span class="font-bold text-lg dark:text-white">
										{validation.vehicleReports.find(r => r.vehicleId === v.id)?.cans || '?'}
									</span>
									<span class="text-xs">cans</span>
								</div>
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center">
								<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Type</span>
								<span class="font-bold text-base truncate block dark:text-white">
									{vehicleTypes.find(vt => vt.id === v.type)?.name || 'Unknown'}
								</span>
								{#if vehicleTypes.find(vt => vt.id === v.type)?.advanced}
									<span class="text-xs text-amber-600 dark:text-amber-400 font-semibold block">(Advanced)</span>
								{/if}
							</div>
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Hull</span>
									<span class="font-bold text-lg">
										{vehicleTypes.find(vt => vt.id === v.type)?.maxHull || '?'}
									</span>
									<span class="text-xs">points</span>
								</div>
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Weight</span>
									<span class="font-bold text-lg">
										{vehicleTypes.find(vt => vt.id === v.type)?.weight || '1'}
									</span>
								</div>
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Max Gear</span>
									<span class="font-bold text-lg">
										{vehicleTypes.find(vt => vt.id === v.type)?.maxGear || '?'}
									</span>
								</div>
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Build Slots</span>
									<span class="font-bold text-lg" class:text-red-600={calculateUsedBuildSlots(v) > (vehicleTypes.find(vt => vt.id === v.type)?.buildSlots || 2)}>
										{calculateUsedBuildSlots(v)} / {vehicleTypes.find(vt => vt.id === v.type)?.buildSlots || 2}
									</span>
								</div>
								<div class="bg-stone-300 dark:bg-gray-600 rounded p-2 text-center">
									<span class="block text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Perks</span>
									<span class="font-bold text-lg" class:text-red-600={v.perks.some(perkId => !currentSponsor?.perks.includes(perkId))}>
										{v.perks.length} / {availablePerks.length}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<hr>
<!-- Totals / legality -->
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
<!-- Gaslands Math -->
<div class="mt-6 bg-stone-100 dark:bg-gray-700 p-4 rounded-lg">
	<h3 class="text-lg font-bold text-stone-800 dark:text-white mb-3">Gaslands Math:</h3>
	<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Hull (Min/Avg/Max/Total)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{vehicles.reduce((total, v) => total + (vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0), 0)}
			</div>
		</div>

		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Gear (Min/Avg/Max/Total)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{vehicles.length > 0 ? Math.max(...vehicles.map(v => vehicleTypes.find(vt => vt.id === v.type)?.maxGear || 0)) : 0}
			</div>
		</div>
		<div class="bg-stone-200 dark:bg-gray-600 p-3 rounded-lg text-center">
			<div class="text-xs text-stone-600 dark:text-gray-300 uppercase font-semibold">Weapons (Min/Avg/Max/Total)</div>
			<div class="text-xl font-bold text-amber-600 dark:text-amber-400">
				{vehicles.reduce((total, v) => total + v.weapons.length, 0)}
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
 
</div>    <!-- QR Modal -->
    {#if qrDataUrl}
      <div
        class="fixed inset-0 bg-black z-50"
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
            <h3 class="text-lg font-bold text-stone-800 dark:text-white modal-heading">Team QR Code</h3>
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
          <p class="mt-6 text-center text-stone-600 dark:text-amber-300 text-sm font-medium modal-text">
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
        class="fixed inset-0 bg-black z-50"
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
          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-10 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500"
          role="document"
          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4);"
        >
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white modal-heading">Import Team Build</h3>
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
            <p class="text-stone-600 dark:text-gray-200 modal-text">
              Paste a team build code below to import a shared build
            </p>
            <div class="space-y-3">
              <label for="import-draft" class="sr-only">Import team build code</label>
              <textarea
                id="import-draft"
                bind:value={importString}
                class="w-full px-4 py-3 border-2 border-stone-300 dark:border-gray-600 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[120px] bg-white dark:bg-gray-700 text-stone-800 dark:text-white modal-input"
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
        class="fixed inset-0 bg-black z-50"
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
          class="bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.3)] p-10 w-11/12 sm:w-4/5 md:w-2/5 lg:w-1/3 mx-auto relative z-10 border-2 border-amber-500 settings-modal-content"
          role="document"
          style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow-y: auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 0 0 4px rgba(245,158,11,0.4), 0 10px 25px -5px rgba(0,0,0,0.4); background-color: white;"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-stone-800 dark:text-white modal-heading">Settings</h3>
            <button
              class="text-stone-400 hover:text-stone-600 dark:text-gray-300 dark:hover:text-white transition-colors"
              on:click={() => (showSettingsModal = false)}
              aria-label="Close settings modal"
            >
              <span class="text-2xl">×</span>
              <span class="sr-only">Close</span>
            </button>
          </div>
          
          <div class="space-y-10">
            <div class="space-y-2">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="enable-sponsorships" 
                  bind:checked={enableSponsorships}
                  class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="enable-sponsorships" class="ml-2 text-stone-800 dark:text-white font-medium">
                  Enable Sponsorships
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-6 modal-subtext">
                If you prefer to build a team without using Sponsor or driver perks, uncheck this option.
              </p>
            </div>
            
            <div class="space-y-2">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="include-advanced" 
                  bind:checked={includeAdvanced}
                  class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="include-advanced" class="ml-2 text-stone-800 dark:text-white font-medium">
                  Include Advanced
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-6">
                Enable this option to include advanced vehicles, weapons, and upgrades from the rulebook. When disabled, only basic options will be shown.
              </p>
            </div>
            
            <div class="space-y-2">
              <div class="flex items-center">
                <input 
                  type="checkbox" 
                  id="dark-mode" 
                  bind:checked={darkMode}
                  class="w-4 h-4 text-amber-600 bg-stone-100 dark:bg-gray-700 border-stone-300 dark:border-gray-600 rounded focus:ring-amber-500"
                />
                <label for="dark-mode" class="ml-2 text-stone-800 dark:text-white font-medium">
                  Dark Mode
                </label>
              </div>
              <p class="text-stone-600 dark:text-gray-200 text-sm ml-6">
                Enable dark mode for better visibility in low-light conditions.
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
    
    <!-- Teams Modal -->
    <TeamsModal 
      bind:showModal={showTeamsModal} 
      currentDraft={currentDraft} 
      importDraft={(draft) => {
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
      }}
    />


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
              {#each Array(Math.min(10, vehicleTypes.find(vt => vt.id === v.type)?.maxHull || 0)) as _, i}
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
      <!-- Print mode: always include both options but control visibility -->
      <img id="print-qr-code" src="" alt="QR Code" class="qr-code-image" />
      <div class="qr-code-caption">Scan to load team</div>
    </div>
    <div class="print-footer-text">
      Generated by Gaslands Garage on {new Date().toLocaleDateString()}
    </div>
  </div>
</div>